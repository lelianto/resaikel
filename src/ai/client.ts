import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { serverConfig } from '@/lib/config';

import { AiError } from './errors';
import { validateAiResponse } from './schemas';

/**
 * Thin, well-behaved wrapper over the official Google Gen AI SDK.
 *
 * Responsibilities, and nothing else:
 *  - build the request (text plus inline images)
 *  - enforce a hard timeout, and retry transient failures with backoff
 *  - parse a JSON object out of the response and validate it against a Zod schema
 *  - return token usage for cost logging
 *
 * The client is created lazily and cached per API key, so a hot route does not
 * construct a new SDK client per request. The API key never leaves this module.
 */

export interface AiImage {
  readonly mimeType: string;
  readonly dataBase64: string;
}

export interface GenerateJsonRequest {
  readonly model: string;
  readonly systemInstruction: string;
  readonly userText: string;
  readonly images?: readonly AiImage[];
  readonly temperature?: number;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  /** Label used in error details, e.g. "material analysis". */
  readonly operation: string;
}

export interface AiUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
}

export interface GenerateJsonResult {
  readonly text: string;
  readonly model: string;
  readonly attempts: number;
  readonly usage: AiUsage;
  readonly durationMs: number;
}

/**
 * SDK clients cached per API key, so a hot route does not build a new client
 * per request and so each configured key (primary plus fallbacks) keeps its own
 * cached client. The keys never leave this module.
 */
const clientCache = new Map<string, GoogleGenAI>();

function getClientFor(apiKey: string): GoogleGenAI {
  let client = clientCache.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    clientCache.set(apiKey, client);
  }
  return client;
}

function getApiKeys(): readonly string[] {
  const apiKeys = serverConfig.ai.apiKeys;
  if (apiKeys.length === 0) {
    throw new AiError('AI_NOT_CONFIGURED', 'GEMINI_API_KEY is not set.', { retryable: false });
  }
  return apiKeys;
}

const EMPTY_USAGE: AiUsage = { inputTokens: null, outputTokens: null, totalTokens: null };

function addMetric(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left + right;
}

/**
 * Adds usage from separate billable model calls.
 *
 * A missing SDK metric stays unknown: treating it as zero would under-report
 * usage and make quota or cost telemetry look more precise than it is.
 */
export function addAiUsage(left: AiUsage, right: AiUsage): AiUsage {
  return {
    inputTokens: addMetric(left.inputTokens, right.inputTokens),
    outputTokens: addMetric(left.outputTokens, right.outputTokens),
    totalTokens: addMetric(left.totalTokens, right.totalTokens),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Exponential backoff with jitter, so parallel jobs do not retry in lockstep. */
function backoffMs(attempt: number): number {
  const base = Math.min(8_000, 400 * 2 ** (attempt - 1));
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new AiError('AI_TIMEOUT', `The request exceeded ${timeoutMs} ms.`, { retryable: true }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface ErrorLike {
  status?: number;
  code?: string | number;
  name?: string;
  message?: string;
}

function classify(error: unknown, operation: string): AiError {
  if (error instanceof AiError) return error;

  const candidate = error as ErrorLike;
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined;
  const message = candidate?.message ?? 'Unknown AI failure';

  if (candidate?.name === 'AbortError' || /abort|timed? ?out|deadline/i.test(message)) {
    return new AiError('AI_TIMEOUT', `${operation} timed out.`, {
      retryable: true,
      causeDetail: message,
    });
  }

  if (status === 429 || /rate limit|resource_exhausted|quota/i.test(message)) {
    return new AiError('AI_RATE_LIMITED', `${operation} was rate limited.`, {
      retryable: true,
      causeDetail: message,
    });
  }

  if (status !== undefined && status >= 500) {
    return new AiError('AI_UNAVAILABLE', `${operation} failed upstream (${status}).`, {
      retryable: true,
      causeDetail: message,
    });
  }

  // 400/401/403/404 mean a bad request, key or model id. Retrying will not help.
  if (status !== undefined && status >= 400) {
    return new AiError('AI_UNAVAILABLE', `${operation} was rejected upstream (${status}).`, {
      retryable: false,
      causeDetail: message,
    });
  }

  return new AiError('AI_UNAVAILABLE', `${operation} failed.`, {
    retryable: false,
    causeDetail: message,
  });
}

function buildParts(request: GenerateJsonRequest): unknown[] {
  const parts: unknown[] = [{ text: request.userText }];
  for (const image of request.images ?? []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.dataBase64 } });
  }
  return parts;
}

/**
 * Whether a failure means this key is spent and the next one should be tried.
 * A rate limit (or exhausted quota) is the common case; a revoked, invalid or
 * disabled key is also worth failing over, since another key may still work.
 */
function shouldFailOverToNextKey(error: AiError): boolean {
  if (error.code === 'AI_RATE_LIMITED') return true;
  if (error.code !== 'AI_UNAVAILABLE') return false;
  const detail = (error.causeDetail ?? '').toLowerCase();
  return /api[_\s]?key|permission[_\s]?denied|unauthenticated|invalid.*credential|forbidden|\b401\b|\b403\b/.test(
    detail,
  );
}

async function callOnce(
  request: GenerateJsonRequest,
  client: GoogleGenAI,
): Promise<GenerateJsonResult> {
  const timeoutMs = request.timeoutMs ?? serverConfig.ai.timeoutMs;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: request.model,
        contents: [{ role: 'user', parts: buildParts(request) as never }],
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature ?? 0.4,
          responseMimeType: 'application/json',
          abortSignal: controller.signal,
        },
      }),
      timeoutMs,
    );

    const text = response.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new AiError('AI_INVALID_OUTPUT', 'The model returned an empty response.', {
        retryable: true,
      });
    }

    const metadata = response.usageMetadata;

    return {
      text,
      model: request.model,
      attempts: 1,
      usage: {
        inputTokens: metadata?.promptTokenCount ?? null,
        outputTokens: metadata?.candidatesTokenCount ?? null,
        totalTokens: metadata?.totalTokenCount ?? null,
      },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    throw classify(error, request.operation);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateJson(request: GenerateJsonRequest): Promise<GenerateJsonResult> {
  const maxAttempts = Math.max(1, request.maxAttempts ?? serverConfig.ai.maxAttempts);
  const apiKeys = getApiKeys();
  let lastError: AiError | null = null;

  // Outer loop: each configured key in order (primary first, then fallbacks).
  // When a key is rate limited or rejected it is abandoned for the rest of this
  // request and the next key is tried immediately, so one exhausted quota does
  // not fail the whole operation. The `attempts` count reported back is the
  // number of tries on the key that ultimately answered.
  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex += 1) {
    const client = getClientFor(apiKeys[keyIndex]!);
    const hasNextKey = keyIndex < apiKeys.length - 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await callOnce(request, client);
        return { ...result, attempts: attempt };
      } catch (error) {
        const classified = error instanceof AiError ? error : classify(error, request.operation);
        lastError = classified;

        // Exhausted or rejected key: stop retrying it and fall back to the next
        // key (if any) without burning this key's remaining backoff attempts.
        if (hasNextKey && shouldFailOverToNextKey(classified)) break;

        if (!classified.retryable || attempt === maxAttempts) throw classified;
        await delay(backoffMs(attempt));
      }
    }
  }

  throw (
    lastError ??
    new AiError('AI_UNAVAILABLE', `${request.operation} failed without a specific error.`)
  );
}

/**
 * Pulls a single JSON object out of a model response, tolerating the code fences
 * models sometimes add despite instructions.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new AiError('AI_INVALID_OUTPUT', 'No JSON object was found in the response.');
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new AiError('AI_INVALID_OUTPUT', 'The response was not valid JSON.', {
      causeDetail: error instanceof Error ? error.message : undefined,
    });
  }
}

export interface ValidatedAiResult<T> {
  readonly value: T;
  readonly model: string;
  readonly attempts: number;
  readonly validationAttempts: number;
  readonly usage: AiUsage;
  readonly durationMs: number;
}

/**
 * Generates, parses and validates in one step, with a self-repair loop: on a
 * schema violation the specific problems are fed back and the model is asked once
 * more. Only a fully validated value is ever returned.
 */
export async function generateValidated<S extends z.ZodTypeAny>(
  request: GenerateJsonRequest,
  schema: S,
  options: { maxValidationAttempts?: number } = {},
): Promise<ValidatedAiResult<z.output<S>>> {
  const maxValidationAttempts = Math.max(1, options.maxValidationAttempts ?? 2);
  let lastIssues: string[] = [];
  let totalAttempts = 0;
  let totalUsage: AiUsage | null = null;
  let totalDurationMs = 0;

  for (let validationAttempt = 1; validationAttempt <= maxValidationAttempts; validationAttempt += 1) {
    const correction =
      lastIssues.length > 0
        ? [
            '',
            'Your previous response was rejected by schema validation.',
            'Fix exactly these problems and return the corrected JSON object only:',
            ...lastIssues.map((issue) => `- ${issue}`),
          ].join('\n')
        : '';

    const result = await generateJson({
      ...request,
      userText: `${request.userText}${correction}`,
    });

    totalAttempts += result.attempts;
    totalUsage = totalUsage ? addAiUsage(totalUsage, result.usage) : result.usage;
    totalDurationMs += result.durationMs;

    let parsed: unknown;
    try {
      parsed = extractJsonObject(result.text);
    } catch (error) {
      lastIssues =
        error instanceof AiError ? [...error.details, error.message] : ['Response was not JSON.'];
      continue;
    }

    const validated = validateAiResponse(schema, parsed);
    if (validated.ok && validated.value !== null) {
      return {
        value: validated.value,
        model: result.model,
        attempts: totalAttempts,
        validationAttempts: validationAttempt,
        usage: totalUsage ?? EMPTY_USAGE,
        durationMs: totalDurationMs,
      };
    }

    lastIssues = [...validated.issues];
  }

  throw new AiError(
    'AI_INVALID_OUTPUT',
    `The AI response for ${request.operation} did not match the required structure after ` +
      `${maxValidationAttempts} attempts. Nothing unvalidated was stored.`,
    { details: lastIssues },
  );
}
