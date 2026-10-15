import { z } from 'zod';

import { BUYER_SEGMENT_IDS } from '@/domain/buyers/segments';
import { MATERIAL_CATEGORIES, CONDITION_GRADES } from '@/domain/materials/types';

/**
 * Zod contracts for every AI response.
 *
 * Nothing produced by a language model reaches Firestore or the UI without
 * passing through one of these schemas. The schemas are also the guardrail: note
 * what is deliberately *absent* from `MaterialAnalysis` - there is no field for
 * weight, thickness, material composition, mechanical strength or certification,
 * because a photograph cannot establish any of them.
 *
 * Bump `AI_PROMPT_VERSION` whenever a prompt changes in a way that alters the
 * expected output, so cached analyses are not reused across incompatible
 * contracts.
 */

export const AI_PROMPT_VERSION = '2025-06-01.1';

const shortText = z.string().trim().min(1).max(160);
const sentence = z.string().trim().min(1).max(600);
const nullableSentence = sentence.nullable();

const tagList = z.array(z.string().trim().min(1).max(80)).max(20);

const confidence = z.number().min(0).max(1);

/**
 * Note: none of these schemas use `.default()`. Zod's defaults would make the
 * field optional on the way in, which both weakens the contract the model is
 * held to and splits the inferred input and output types. Every key listed in a
 * prompt contract is therefore required in the response; a missing key is a
 * validation failure, and the client's self-repair loop asks the model to fix it.
 */
export const MaterialAnalysisSchema = z.object({
  category: z.enum(MATERIAL_CATEGORIES),
  subtype: shortText.nullable(),
  color: shortText.nullable(),
  texture: shortText.nullable(),
  shape: shortText.nullable(),
  condition: z.enum(CONDITION_GRADES),
  contamination: tagList,
  defects: tagList,
  /** Ways this material must *not* be reused, given what is visible. */
  reuseRestrictions: z.array(sentence).max(12),
  /** What in the image supports the conclusion. Keeps the model accountable. */
  visibleEvidence: z.array(sentence).max(12),
  /** Facts a person must supply. Dimensions always belong here. */
  missingInformation: z.array(sentence).max(12),
  warnings: z.array(sentence).max(12),
  /** Per-field self-reported confidence. Never a single global safety score. */
  fieldConfidence: z.record(z.string().max(40), confidence),
  notes: nullableSentence,
});

export type MaterialAnalysis = z.infer<typeof MaterialAnalysisSchema>;

/** Fields a caller may ask the model to re-examine by name. */
export const MATERIAL_ANALYSIS_FIELDS = [
  'category',
  'subtype',
  'color',
  'texture',
  'shape',
  'condition',
  'contamination',
  'defects',
] as const;

export const ProductCandidateSchema = z
  .object({
    kind: z.enum(['template', 'concept']),
    /** Required when `kind` is `template`; must come from the supplied subset. */
    templateId: z.string().trim().min(1).max(80).nullable(),
    /** Only valid when `kind` is `template`. */
    parameters: z.record(z.string().max(40), z.number().finite()),
    conceptName: shortText.nullable(),
    conceptDescription: nullableSentence,
    rationale: sentence,
    targetSegments: z.array(z.string().trim().max(60)).max(8),
    risks: z.array(sentence).max(8),
  })
  .superRefine((candidate, ctx) => {
    if (candidate.kind === 'template' && !candidate.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A template candidate must name a templateId.',
        path: ['templateId'],
      });
    }
    if (candidate.kind === 'concept' && !candidate.conceptName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A concept candidate must be named.',
        path: ['conceptName'],
      });
    }
  });

export const ProductCandidateSetSchema = z.object({
  candidates: z.array(ProductCandidateSchema).min(1).max(8),
  /** Anything the model wanted to propose but could not justify. */
  rejectedIdeas: z.array(z.string().trim().min(1).max(160)).max(8),
  notes: z.array(sentence).max(8),
});

export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;
export type ProductCandidateSet = z.infer<typeof ProductCandidateSetSchema>;

export const FeasibilityExplanationSchema = z.object({
  summary: sentence,
  keyPoints: z.array(sentence).max(8),
  caveats: z.array(sentence).max(8),
  nextActions: z.array(sentence).max(8),
});

export type FeasibilityExplanation = z.infer<typeof FeasibilityExplanationSchema>;

export const BuyerSegmentSuggestionSchema = z.object({
  segments: z
    .array(
      z.object({
        segmentId: z.enum(BUYER_SEGMENT_IDS),
        fit: z.enum(['strong', 'plausible', 'weak']),
        rationale: sentence,
      }),
    )
    .max(12),
  channelNotes: z.array(sentence).max(8),
  caveats: z.array(sentence).max(8),
});

export type BuyerSegmentSuggestion = z.infer<typeof BuyerSegmentSuggestionSchema>;

export const OpportunitySummarySchema = z.object({
  headline: sentence,
  whyItWorks: z.array(sentence).max(8),
  assumptions: z.array(sentence).max(8),
  unknowns: z.array(sentence).max(8),
  nextSteps: z.array(sentence).max(8),
});

export type OpportunitySummary = z.infer<typeof OpportunitySummarySchema>;

/**
 * Measurement-like claims in free text. The structured schema has no dimension
 * fields, so this is defence in depth: any such phrase is reported to the user as
 * a disregarded claim rather than being presented as a detected fact.
 */
const FORBIDDEN_CLAIM_PATTERN =
  /\b\d+(?:[.,]\d+)?\s?(?:mm|cm|m\b|kg|g\b|gsm|mpa|n\/mm|psi|joules?|kn)\b/gi;

export function findUnsupportedClaims(analysis: MaterialAnalysis): string[] {
  const haystack = [
    analysis.notes ?? '',
    ...analysis.visibleEvidence,
    ...analysis.warnings,
    ...analysis.reuseRestrictions,
    analysis.subtype ?? '',
    analysis.texture ?? '',
    analysis.shape ?? '',
  ].join(' ');

  const matches = haystack.match(FORBIDDEN_CLAIM_PATTERN);
  if (!matches) return [];
  return [...new Set(matches.map((match) => match.trim()))];
}

/** Result of validating a raw model response. */
export interface AiValidationResult<T> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly issues: readonly string[];
}

export function validateAiResponse<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
): AiValidationResult<z.output<S>> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, value: parsed.data as z.output<S>, issues: [] };
  }

  return {
    ok: false,
    value: null,
    issues: parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}
