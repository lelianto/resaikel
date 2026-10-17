import { AiError } from '@/ai/errors';
import { analysisInputHash } from '@/ai/cache';
import { AI_PROMPT_VERSION, type MaterialAnalysis } from '@/ai/schemas';
import { analyzeMaterial } from '@/ai/service';
import { isSupportedFamily, SUPPORTED_FAMILIES } from '@/domain/catalog';
import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import { newRequestId } from '@/domain/ids';
import type { AuthContext } from '@/domain/identity/types';
import { familyOf, MATERIAL_FAMILY_LABELS } from '@/domain/materials/types';
import type {
  MaterialAttributeKey,
  MaterialCategory,
  MaterialFamily,
  ProvenanceMap,
} from '@/domain/materials/types';
import { serverConfig } from '@/lib/config';

import { readObjectAsBase64 } from '../firebase/storage';
import { HttpError, toHttpError } from '../http/errors';
import {
  claimAnalysisJob,
  completeAnalysisJob,
  createAnalysisJobDocument,
  failAnalysisJob,
  findCachedAnalysisJob,
  findJobByInputHash,
  getAnalysisJobDocument,
  getMaterialDocument,
  listMaterialPhotoDocuments,
  updateMaterialDocument,
} from '../repos/materials';
import type { AnalysisJobDocument, MaterialDocument } from '../repos/types';

/**
 * Material analysis orchestration.
 *
 * The flow is deliberately pull-based and idempotent:
 *
 *  1. `POST /analyze` creates a `queued` job and returns 202 immediately. It does
 *     NOT return a promise detached from the response.
 *  2. The route then registers the worker with `after()`, which runs inside the
 *     request lifecycle rather than as an orphaned promise.
 *  3. `GET /analysis/:jobId` polls. If the job is still queued, or its claim went
 *     stale because a worker died, the poll re-claims and runs it here. The claim
 *     is a Firestore transaction, so two concurrent pollers cannot both run it.
 *
 * Identical input never re-bills: the job carries a hash of the images, the prompt
 * version, the model and the text context, and a completed job with a matching
 * hash is served instead.
 */

const MAX_IMAGES_PER_ANALYSIS = 4;

/** Fields the model may propose. A human-verified value always wins. */
const AI_OWNED_FIELDS: readonly MaterialAttributeKey[] = [
  'category',
  'subtype',
  'color',
  'texture',
  'shape',
  'condition',
  'contamination',
  'defects',
];

function isHumanVerified(map: ProvenanceMap, key: MaterialAttributeKey): boolean {
  const source = map[key]?.source;
  return source === 'user' || source === 'measured';
}

function buildContextString(material: MaterialDocument): string {
  return [material.title, material.origin ?? '', material.notes ?? ''].join('|');
}

function missingInformationFor(
  material: MaterialDocument,
  analysis: MaterialAnalysis,
): string[] {
  const items = new Set<string>(analysis.missingInformation);

  if (material.dimensions.lengthMm === null || material.dimensions.widthMm === null) {
    items.add('Measure the sheet length and width. A photograph cannot establish them.');
  }
  if (material.dimensions.thicknessMm === null) {
    items.add('Measure the sheet thickness if the product carries any load.');
  }
  if (material.attributes.category === 'unknown' && analysis.category === 'unknown') {
    items.add('Choose the material category; it could not be determined from the photographs.');
  }
  if (material.quantity.value <= 0) {
    items.add('Enter how much of this material is available.');
  }

  return [...items];
}

/** Human-readable list of the families the catalogue can build from. */
function supportedFamiliesSentence(): string {
  const labels = SUPPORTED_FAMILIES.map((family) => MATERIAL_FAMILY_LABELS[family].toLowerCase());
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export function warningsFor(
  analysis: MaterialAnalysis,
  unsupportedClaims: readonly string[],
  mock: boolean,
  family: MaterialFamily,
): string[] {
  const warnings = [...analysis.warnings, ...analysis.reuseRestrictions];

  // Gate on what the catalogue can actually make, not on what the model can see.
  // `unknown` is handled by `missingInformation` (the user must pick a category).
  if (family !== 'unknown' && !isSupportedFamily(family)) {
    warnings.push(
      `This looks like ${MATERIAL_FAMILY_LABELS[family].toLowerCase()}. The platform can currently ` +
        `turn only ${supportedFamiliesSentence()} into products, so no product opportunities can be ` +
        'generated from it yet. You can still catalogue it.',
    );
  }

  if (unsupportedClaims.length > 0) {
    warnings.push(
      `The model mentioned measurements it cannot know (${unsupportedClaims.join(', ')}). They were ` +
        'discarded and are not recorded as facts.',
    );
  }
  if (mock) {
    warnings.push(
      'This result came from the offline mock adapter, not from a live model. Configure ' +
        'GEMINI_API_KEY to analyse real photographs.',
    );
  }

  return [...new Set(warnings)];
}

/**
 * Merges an analysis into the material, adopting AI values only where a person has
 * not already confirmed the field. This is what stops a re-run from silently
 * overwriting a measured dimension with a guess.
 */
function materialPatchFromAnalysis(input: {
  material: MaterialDocument;
  analysis: MaterialAnalysis;
  unsupportedClaims: readonly string[];
  mock: boolean;
  jobId: string;
  model: string;
}): Partial<Omit<MaterialDocument, 'id' | 'orgId'>> {
  const { material, analysis } = input;
  let provenance: ProvenanceMap = { ...material.provenance };

  const attributes = { ...material.attributes };
  const adopt = <T>(key: MaterialAttributeKey, value: T): void => {
    if (isHumanVerified(provenance, key)) return;
    provenance = {
      ...provenance,
      [key]: {
        source: 'ai',
        ...(analysis.fieldConfidence[key] !== undefined
          ? { confidence: analysis.fieldConfidence[key] }
          : {}),
        note: 'From photographic analysis. Requires human confirmation.',
        recordedAt: nowIso(),
      },
    };
    (attributes as Record<string, unknown>)[key] = value;
  };

  adopt('category', analysis.category);
  adopt('subtype', analysis.subtype);
  adopt('color', analysis.color);
  adopt('texture', analysis.texture);
  adopt('shape', analysis.shape);
  adopt('condition', analysis.condition);
  adopt('contamination', [...analysis.contamination]);
  adopt('defects', [...analysis.defects]);

  // Warn on the category that actually survived the merge: a human-confirmed
  // category wins over the model's, so the support check must use `attributes`.
  const family = familyOf(attributes.category);

  return {
    attributes,
    provenance,
    status: 'needs_confirmation',
    missingInformation: missingInformationFor(material, analysis),
    warnings: warningsFor(analysis, input.unsupportedClaims, input.mock, family),
    updatedAt: nowIso(),
  };
}

function categoryHintFor(material: MaterialDocument): MaterialCategory | undefined {
  // Only ever passed to the mock adapter. A live model must classify the material
  // itself, and a hint would bias it toward re-confirming a previous guess.
  if (material.attributes.category === 'unknown') return undefined;
  return isHumanVerified(material.provenance, 'category')
    ? material.attributes.category
    : undefined;
}

export interface StartAnalysisResult {
  readonly job: AnalysisJobDocument;
  readonly cached: boolean;
}

export async function startMaterialAnalysis(
  auth: AuthContext,
  materialId: string,
): Promise<StartAnalysisResult> {
  const material = await getMaterialDocument(auth.orgId, materialId);
  if (!material) {
    throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');
  }
  if (material.status === 'archived') {
    throw new HttpError('INVALID_INPUT', 'Restore this material before analysing it again.');
  }

  const photos = await listMaterialPhotoDocuments(auth.orgId, materialId);
  if (photos.length === 0) {
    throw new HttpError(
      'INVALID_INPUT',
      'Add at least one photograph before running an analysis.',
    );
  }

  const model = serverConfig.ai.materialModel;
  const inputHash = analysisInputHash({
    imageDigests: photos.map((photo) => photo.sha256),
    promptVersion: AI_PROMPT_VERSION,
    model,
    context: buildContextString(material),
  });

  // Reuse a completed analysis of the exact same input.
  const cachedJob = await findCachedAnalysisJob(auth.orgId, inputHash);
  if (cachedJob?.output) {
    await updateMaterialDocument(
      auth.orgId,
      materialId,
      materialPatchFromAnalysis({
        material,
        analysis: cachedJob.output,
        unsupportedClaims: cachedJob.unsupportedClaims,
        mock: cachedJob.mock,
        jobId: cachedJob.id,
        model: cachedJob.model,
      }),
    );
    return { job: cachedJob, cached: true };
  }

  // Reuse an in-flight job rather than starting a duplicate paid call.
  const inFlight = await findJobByInputHash(auth.orgId, materialId, inputHash);
  if (inFlight) return { job: inFlight, cached: false };

  const timestamp = nowIso();
  const job: AnalysisJobDocument = {
    id: newRequestId(),
    orgId: auth.orgId,
    schemaVersion: SCHEMA_VERSION,
    materialId,
    type: 'material_analysis',
    status: 'queued',
    inputHash,
    model,
    promptVersion: AI_PROMPT_VERSION,
    attempts: 0,
    validationAttempts: 0,
    claimedAt: null,
    startedAt: null,
    finishedAt: null,
    output: null,
    unsupportedClaims: [],
    error: null,
    usage: { inputTokens: null, outputTokens: null, totalTokens: null },
    mock: false,
    createdBy: auth.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await createAnalysisJobDocument(job);
  await updateMaterialDocument(auth.orgId, materialId, {
    status: 'analyzing',
    updatedAt: timestamp,
  });

  return { job, cached: false };
}

/**
 * Runs a queued job. Safe to call concurrently: only the caller that wins the
 * transactional claim does any work, and failures are recorded on the job rather
 * than thrown, so a background invocation never produces an unhandled rejection.
 */
export async function runAnalysisJob(jobId: string): Promise<void> {
  const claimed = await claimAnalysisJob(jobId, serverConfig.ai.jobStaleAfterMs);
  if (!claimed) return;

  try {
    const material = await getMaterialDocument(claimed.orgId, claimed.materialId);
    if (!material) throw new Error('The material no longer exists.');

    const photos = await listMaterialPhotoDocuments(claimed.orgId, claimed.materialId);
    const images: { dataBase64: string; mimeType: string }[] = [];

    for (const photo of photos.slice(0, MAX_IMAGES_PER_ANALYSIS)) {
      const object = await readObjectAsBase64(photo.storagePath);
      images.push(object);
    }

    const hint = categoryHintFor(material);

    const outcome = await analyzeMaterial({
      title: material.title,
      origin: material.origin,
      userNotes: material.notes,
      // Owner-declared measurements are deliberately NOT sent: dimensions are not
      // the model's to reason about, and supplying them invites it to restate them
      // as observations.
      knownMeasurements: null,
      photoCount: images.length,
      images,
      ...(hint !== undefined ? { categoryHint: hint } : {}),
    });

    await completeAnalysisJob(jobId, {
      output: outcome.analysis,
      unsupportedClaims: outcome.unsupportedClaims,
      usage: outcome.meta.usage,
      model: outcome.meta.model,
      validationAttempts: outcome.meta.validationAttempts,
      mock: outcome.meta.mock,
    });

    await updateMaterialDocument(
      claimed.orgId,
      claimed.materialId,
      materialPatchFromAnalysis({
        material,
        analysis: outcome.analysis,
        unsupportedClaims: outcome.unsupportedClaims,
        mock: outcome.meta.mock,
        jobId,
        model: outcome.meta.model,
      }),
    );
  } catch (error) {
    const httpError = toHttpError(error);
    await failAnalysisJob(jobId, {
      code: httpError.code,
      message: httpError.message,
      details: error instanceof AiError ? [...error.details] : [],
    });

    // Return the material to an editable state so the user is never stuck behind
    // a failed analysis.
    await updateMaterialDocument(claimed.orgId, claimed.materialId, {
      status: 'draft',
      updatedAt: nowIso(),
    });
  }
}

function isStale(job: AnalysisJobDocument): boolean {
  if (job.status === 'queued') return true;
  if (job.status !== 'running') return false;
  const claimedAt = job.claimedAt ? Date.parse(job.claimedAt) : 0;
  return Date.now() - claimedAt > serverConfig.ai.jobStaleAfterMs;
}

/** Reads a job, running it first if it looks abandoned. */
export async function getAnalysisJobForRequest(
  auth: AuthContext,
  jobId: string,
): Promise<AnalysisJobDocument> {
  const job = await getAnalysisJobDocument(auth.orgId, jobId);
  if (!job) throw new HttpError('JOB_NOT_FOUND', 'That analysis job does not exist.');

  if (!isStale(job)) return job;

  await runAnalysisJob(jobId);
  return (await getAnalysisJobDocument(auth.orgId, jobId)) ?? job;
}

export { AI_OWNED_FIELDS };
