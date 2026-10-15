import { clampParameters, getTemplate, validateParameters } from '@/domain/catalog';
import type { ProductTemplate } from '@/domain/catalog/types';
import { BUYER_SEGMENTS } from '@/domain/buyers/segments';
import type { BuyerSegmentId } from '@/domain/buyers/segments';
import { isAiLive, serverConfig } from '@/lib/config';

import { generateValidated, type AiUsage } from './client';
import { AiError } from './errors';
import {
  mockAnalyzeMaterial,
  mockBuyerSegments,
  mockFeasibilityExplanation,
  mockGenerateCandidates,
  mockOpportunitySummary,
} from './mock';
import {
  buildBuyerSegmentPrompt,
  buildFeasibilityExplanationPrompt,
  buildOpportunitySummaryPrompt,
  BUYER_SYSTEM_INSTRUCTION,
  EXPLANATION_SYSTEM_INSTRUCTION,
} from './prompts/explanation';
import {
  buildDiscoveryPrompt,
  DISCOVERY_SYSTEM_INSTRUCTION,
} from './prompts/discovery';
import {
  buildMaterialAnalysisPrompt,
  MATERIAL_SYSTEM_INSTRUCTION,
} from './prompts/material';
import {
  AI_PROMPT_VERSION,
  BuyerSegmentSuggestionSchema,
  FeasibilityExplanationSchema,
  findUnsupportedClaims,
  MaterialAnalysisSchema,
  OpportunitySummarySchema,
  ProductCandidateSetSchema,
  type BuyerSegmentSuggestion,
  type FeasibilityExplanation,
  type MaterialAnalysis,
  type OpportunitySummary,
  type ProductCandidateSet,
} from './schemas';
import type {
  BuyerSegmentsInput,
  DiscoveryInput,
  FeasibilityExplanationInput,
  MaterialAnalysisInput,
  OpportunitySummaryInput,
} from './types';

export { AI_PROMPT_VERSION };

export interface AiMeta {
  readonly model: string;
  readonly mock: boolean;
  readonly attempts: number;
  readonly validationAttempts: number;
  readonly usage: AiUsage;
  readonly durationMs: number;
}

export interface MaterialAnalysisOutcome {
  readonly analysis: MaterialAnalysis;
  /**
   * Measurement-like phrases the model produced in free text. They are surfaced
   * as disregarded claims rather than being treated as detected facts.
   */
  readonly unsupportedClaims: readonly string[];
  readonly meta: AiMeta;
}

function mockMeta(model: string): AiMeta {
  return {
    model: `mock:${model}`,
    mock: true,
    attempts: 0,
    validationAttempts: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    durationMs: 0,
  };
}

function liveMeta(
  model: string,
  attempts: number,
  validationAttempts: number,
  usage: AiUsage,
  durationMs: number,
): AiMeta {
  return { model, mock: false, attempts, validationAttempts, usage, durationMs };
}

// ---------------------------------------------------------------- material

export async function analyzeMaterial(
  input: MaterialAnalysisInput,
): Promise<MaterialAnalysisOutcome> {
  const model = serverConfig.ai.materialModel;

  if (!isAiLive()) {
    const analysis = mockAnalyzeMaterial(input);
    return { analysis, unsupportedClaims: [], meta: mockMeta(model) };
  }

  if (input.images.length === 0) {
    throw new AiError('AI_INVALID_OUTPUT', 'Material analysis needs at least one photograph.', {
      retryable: false,
    });
  }

  const result = await generateValidated(
    {
      model,
      systemInstruction: MATERIAL_SYSTEM_INSTRUCTION,
      userText: buildMaterialAnalysisPrompt(input),
      images: input.images,
      temperature: 0.2,
      operation: 'material analysis',
    },
    MaterialAnalysisSchema,
  );

  return {
    analysis: result.value,
    unsupportedClaims: findUnsupportedClaims(result.value),
    meta: liveMeta(model, result.attempts, result.validationAttempts, result.usage, result.durationMs),
  };
}

// --------------------------------------------------------------- discovery

export type ResolvedCandidate =
  | {
      readonly kind: 'template';
      readonly templateId: string;
      readonly template: ProductTemplate;
      readonly parameters: Readonly<Record<string, number>>;
      readonly rationale: string;
      readonly targetSegments: readonly BuyerSegmentId[];
      readonly risks: readonly string[];
      readonly parameterIssues: readonly string[];
    }
  | {
      readonly kind: 'concept';
      readonly name: string;
      readonly description: string;
      readonly rationale: string;
      readonly risks: readonly string[];
    };

export interface CandidateOutcome {
  readonly candidates: readonly ResolvedCandidate[];
  readonly dropped: readonly { label: string; reason: string }[];
  readonly rejectedIdeas: readonly string[];
  readonly notes: readonly string[];
  readonly meta: AiMeta;
}

const UNSAFE_CLAIM_PATTERN =
  /\b(certified|certification|compliant|compliance|load[- ]?rat(?:ed|ing)|fire[- ]?rat(?:ed|ing)|food[- ]?safe|food[- ]?grade|guarantee[ds]?|structurally safe|warrant(?:y|ies))\b/i;

/** Claims a product cannot make on the strength of a photo and a template. */
export function findUnsafeClaims(texts: readonly string[]): string[] {
  return texts.filter((text) => UNSAFE_CLAIM_PATTERN.test(text));
}

/**
 * Validates a model candidate set against the supplied catalogue.
 *
 * This is the enforcement point for "no freely invented manufacturing specs":
 * an unknown template id, an out-of-range parameter and an unsafe claim are all
 * dropped here, and only surviving candidates reach the feasibility engine.
 *
 * Exported because it is the single place that decides what a model is allowed
 * to propose, and it is tested directly.
 */
export function resolveCandidateSet(
  set: ProductCandidateSet,
  allowed: readonly ProductTemplate[],
): { candidates: ResolvedCandidate[]; dropped: { label: string; reason: string }[] } {
  const allowedById = new Map(allowed.map((template) => [template.id, template]));
  const candidates: ResolvedCandidate[] = [];
  const dropped: { label: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const candidate of set.candidates) {
    const claimTexts = [candidate.rationale, ...candidate.risks];
    const unsafe = findUnsafeClaims(claimTexts);

    if (candidate.kind === 'concept') {
      const name = candidate.conceptName ?? 'Unnamed concept';
      const fingerprint = `concept:${name.trim().toLocaleLowerCase('en')}`;
      if (seen.has(fingerprint)) {
        dropped.push({ label: name, reason: 'Duplicate concept returned by the model.' });
        continue;
      }
      if (unsafe.length > 0) {
        dropped.push({
          label: name,
          reason: `Rejected for claiming something that cannot be substantiated: ${unsafe.join(', ')}.`,
        });
        continue;
      }
      seen.add(fingerprint);
      candidates.push({
        kind: 'concept',
        name,
        description: candidate.conceptDescription ?? 'No description was provided.',
        rationale: candidate.rationale,
        risks: [...candidate.risks],
      });
      continue;
    }

    const templateId = candidate.templateId;
    const template = templateId ? allowedById.get(templateId) : undefined;

    if (!template) {
      dropped.push({
        label: templateId ?? '(no template id)',
        reason: 'The model named a template that is not in the catalogue subset it was offered.',
      });
      continue;
    }

    const normalizedParameters = Object.entries(clampParameters(template, candidate.parameters))
      .sort(([left], [right]) => left.localeCompare(right));
    const fingerprint = `template:${template.id}:${JSON.stringify(normalizedParameters)}`;
    if (seen.has(fingerprint)) {
      dropped.push({ label: template.name, reason: 'Duplicate product variant returned by the model.' });
      continue;
    }

    if (unsafe.length > 0) {
      dropped.push({
        label: template.name,
        reason: `Rejected for claiming something that cannot be substantiated: ${unsafe.join(', ')}.`,
      });
      continue;
    }

    const parameterIssues = validateParameters(template, candidate.parameters)
      .filter((issue) => issue.severity !== 'ignored')
      .map((issue) => issue.message);

    const targetSegments = candidate.targetSegments
      .filter((id): id is BuyerSegmentId => id in BUYER_SEGMENTS)
      .filter((id) => template.targetSegments.includes(id));

    seen.add(fingerprint);
    candidates.push({
      kind: 'template',
      templateId: template.id,
      template,
      parameters: Object.fromEntries(normalizedParameters),
      rationale: candidate.rationale,
      targetSegments: targetSegments.length > 0 ? targetSegments : template.targetSegments,
      risks: [...template.risks, ...candidate.risks],
      parameterIssues,
    });
  }

  return { candidates, dropped };
}

export async function generateProductCandidates(input: DiscoveryInput): Promise<CandidateOutcome> {
  const model = serverConfig.ai.discoveryModel;
  const allowedIds = new Set(input.templates.map((template) => template.id));
  const live = isAiLive();

  let set: ProductCandidateSet;
  let meta: AiMeta;

  if (live) {
    const result = await generateValidated(
      {
        model,
        systemInstruction: DISCOVERY_SYSTEM_INSTRUCTION,
        userText: buildDiscoveryPrompt(input),
        temperature: 0.5,
        operation: 'product discovery',
      },
      ProductCandidateSetSchema,
    );
    set = result.value;
    meta = liveMeta(model, result.attempts, result.validationAttempts, result.usage, result.durationMs);
  } else {
    set = mockGenerateCandidates(input);
    meta = mockMeta(model);
  }

  const { candidates, dropped } = resolveCandidateSet(set, input.templates);

  if (candidates.length === 0) {
    if (dropped.length > 0) {
      throw new AiError(
        'AI_UNSAFE_RECOMMENDATION',
        'Every suggested product was rejected during validation, so none were saved.',
        { details: dropped.map((entry) => `${entry.label}: ${entry.reason}`) },
      );
    }
    throw new AiError('AI_INVALID_OUTPUT', 'No usable product candidates were produced.');
  }

  const notes = [
    // The mock already labels its own output, so the note is not added twice.
    ...set.notes,
    allowedIds.size === 0
      ? 'No templates were offered, so only a concept could be suggested.'
      : `${candidates.length} of ${allowedIds.size} offered template(s) were selected.`,
  ];

  return {
    candidates,
    dropped,
    rejectedIdeas: set.rejectedIdeas,
    notes,
    meta,
  };
}

// ------------------------------------------------------------- explanation

export async function explainFeasibility(
  input: FeasibilityExplanationInput,
): Promise<{ explanation: FeasibilityExplanation; meta: AiMeta }> {
  const model = serverConfig.ai.explanationModel;

  if (!isAiLive()) {
    return { explanation: mockFeasibilityExplanation(input), meta: mockMeta(model) };
  }

  const result = await generateValidated(
    {
      model,
      systemInstruction: EXPLANATION_SYSTEM_INSTRUCTION,
      userText: buildFeasibilityExplanationPrompt(input),
      temperature: 0.4,
      operation: 'feasibility explanation',
    },
    FeasibilityExplanationSchema,
  );

  return {
    explanation: result.value,
    meta: liveMeta(model, result.attempts, result.validationAttempts, result.usage, result.durationMs),
  };
}

export async function suggestBuyerSegments(
  input: BuyerSegmentsInput,
): Promise<{ suggestion: BuyerSegmentSuggestion; meta: AiMeta }> {
  const model = serverConfig.ai.explanationModel;

  if (!isAiLive()) {
    return { suggestion: mockBuyerSegments(input), meta: mockMeta(model) };
  }

  const result = await generateValidated(
    {
      model,
      systemInstruction: BUYER_SYSTEM_INSTRUCTION,
      userText: buildBuyerSegmentPrompt(input),
      temperature: 0.5,
      operation: 'buyer segmentation',
    },
    BuyerSegmentSuggestionSchema,
  );

  return {
    suggestion: result.value,
    meta: liveMeta(model, result.attempts, result.validationAttempts, result.usage, result.durationMs),
  };
}

export async function summarizeBusinessOpportunity(
  input: OpportunitySummaryInput,
): Promise<{ summary: OpportunitySummary; meta: AiMeta }> {
  const model = serverConfig.ai.explanationModel;

  if (!isAiLive()) {
    return { summary: mockOpportunitySummary(input), meta: mockMeta(model) };
  }

  const result = await generateValidated(
    {
      model,
      systemInstruction: EXPLANATION_SYSTEM_INSTRUCTION,
      userText: buildOpportunitySummaryPrompt(input),
      temperature: 0.5,
      operation: 'opportunity summary',
    },
    OpportunitySummarySchema,
  );

  return {
    summary: result.value,
    meta: liveMeta(model, result.attempts, result.validationAttempts, result.usage, result.durationMs),
  };
}

/** Exposed for tests and for the discovery service's template subset check. */
export function templateOrNull(templateId: string): ProductTemplate | null {
  return getTemplate(templateId);
}
