import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Exercises the multi-key fallback in the AI client: when a key is rate limited
 * or rejected, the next configured key is tried. The Gen AI SDK and the env
 * config are both mocked so no network call is made and the key order is fixed.
 */

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    readonly apiKey: string;
    readonly models: { generateContent: (arg: unknown) => unknown };
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey;
      this.models = { generateContent: (arg: unknown) => generateContent(this.apiKey, arg) };
    }
  },
}));

vi.mock('@/lib/config', () => ({
  serverConfig: {
    ai: {
      apiKey: 'key-1',
      apiKeys: ['key-1', 'key-2', 'key-3'],
      timeoutMs: 1_000,
      maxAttempts: 1,
    },
  },
}));

import { generateJson } from '@/ai/client';
import { AiError } from '@/ai/errors';

function ok(payload: Record<string, unknown> = { ok: true }) {
  return {
    text: JSON.stringify(payload),
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
  };
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

const request = {
  model: 'gemini-test',
  systemInstruction: 'sys',
  userText: 'hi',
  operation: 'test op',
  maxAttempts: 1,
} as const;

/** The API key each call was made with, in order. */
function keysUsed(): string[] {
  return generateContent.mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
  generateContent.mockReset();
});

describe('generateJson key fallback', () => {
  it('falls over to the next key when the primary is rate limited', async () => {
    generateContent
      .mockImplementationOnce(() => {
        throw httpError(429, 'rate limit exceeded');
      })
      .mockImplementationOnce(() => ok({ answered: 'by key-2' }));

    const result = await generateJson(request);

    expect(JSON.parse(result.text)).toEqual({ answered: 'by key-2' });
    expect(keysUsed()).toEqual(['key-1', 'key-2']);
  });

  it('falls over when a key is rejected as invalid', async () => {
    generateContent
      .mockImplementationOnce(() => {
        throw httpError(403, 'API key not valid');
      })
      .mockImplementationOnce(() => ok());

    const result = await generateJson(request);

    expect(result.text).toContain('ok');
    expect(keysUsed()).toEqual(['key-1', 'key-2']);
  });

  it('tries every key before giving up when all are rate limited', async () => {
    generateContent.mockImplementation(() => {
      throw httpError(429, 'resource_exhausted');
    });

    await expect(generateJson(request)).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
    } satisfies Partial<AiError>);
    expect(keysUsed()).toEqual(['key-1', 'key-2', 'key-3']);
  });

  it('does not burn fallback keys on a non-key error', async () => {
    generateContent.mockImplementation(() => {
      throw httpError(400, 'invalid argument: bad model id');
    });

    await expect(generateJson(request)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(keysUsed()).toEqual(['key-1']);
  });
});
