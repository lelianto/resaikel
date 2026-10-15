import { createHash } from 'node:crypto';

/**
 * Cache keys for AI work.
 *
 * Analysis is billed per call, so an identical input must never be analysed
 * twice. The key is a hash of everything that could change the answer: the image
 * bytes, the prompt contract version, the model id and the text context.
 */

export function contentDigest(base64: string): string {
  return createHash('sha256').update(base64).digest('hex');
}

export interface AnalysisHashInput {
  readonly imageDigests: readonly string[];
  readonly promptVersion: string;
  readonly model: string;
  readonly context: string;
}

export function analysisInputHash(input: AnalysisHashInput): string {
  const canonical = JSON.stringify({
    // Sort so that reordering the photographs does not invalidate the cache.
    images: [...input.imageDigests].sort(),
    promptVersion: input.promptVersion,
    model: input.model,
    context: input.context.trim(),
  });

  return createHash('sha256').update(canonical).digest('hex');
}

/** Digest of the discovery inputs, excluding the candidate count. */
export function discoveryInputHash(input: {
  readonly materialId: string;
  readonly materialUpdatedAt: string;
  readonly templateIds: readonly string[];
  readonly promptVersion: string;
  readonly model: string;
}): string {
  const canonical = JSON.stringify({
    materialId: input.materialId,
    materialUpdatedAt: input.materialUpdatedAt,
    templates: [...input.templateIds].sort(),
    promptVersion: input.promptVersion,
    model: input.model,
  });

  return createHash('sha256').update(canonical).digest('hex');
}
