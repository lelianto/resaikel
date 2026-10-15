import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import type { Material, MaterialPhoto, MaterialStatus } from '@/domain/materials/types';

import { adminDb, COLLECTIONS } from '../firebase/admin';
import type {
  AnalysisJobDocument,
  AnalysisJobError,
  AnalysisJobStatus,
  AnalysisUsage,
  MaterialDocument,
  MaterialPhotoDocument,
} from './types';

/**
 * Material, photograph and analysis-job persistence.
 *
 * Tenant isolation is enforced on every read: a document belonging to another
 * organisation is reported as not found, so probing an id reveals nothing.
 */

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

export async function createMaterialDocument(document: MaterialDocument): Promise<void> {
  const { id, ...rest } = document;
  await adminDb().collection(COLLECTIONS.materials).doc(id).set(rest);
}

export async function getMaterialDocument(
  orgId: string,
  materialId: string,
): Promise<MaterialDocument | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.materials).doc(materialId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as Omit<MaterialDocument, 'id'>;
  if (data.orgId !== orgId) return null;

  return { ...data, id: snapshot.id };
}

export interface ListMaterialsOptions {
  readonly status?: MaterialStatus | null | undefined;
  readonly cursor?: string | null | undefined;
  readonly limit?: number | undefined;
}

export async function listMaterialDocuments(
  orgId: string,
  options: ListMaterialsOptions = {},
): Promise<{ items: MaterialDocument[]; nextCursor: string | null }> {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));

  let query = adminDb()
    .collection(COLLECTIONS.materials)
    .where('orgId', '==', orgId)
    .orderBy('createdAt', 'desc')
    .limit(limit + 1);

  if (options.status) {
    query = adminDb()
      .collection(COLLECTIONS.materials)
      .where('orgId', '==', orgId)
      .where('status', '==', options.status)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);
  }

  // ISO-8601 strings sort lexicographically in the same order as instants, so the
  // cursor is the previous page's last `createdAt`.
  if (options.cursor) query = query.startAfter(options.cursor);

  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, limit);
  const items = docs.map((doc) => ({
    ...(doc.data() as Omit<MaterialDocument, 'id'>),
    id: doc.id,
  }));

  const hasMore = snapshot.docs.length > limit;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? last.createdAt : null,
  };
}

export async function countMaterials(orgId: string, status?: MaterialStatus): Promise<number> {
  const base = adminDb().collection(COLLECTIONS.materials).where('orgId', '==', orgId);
  const query = status ? base.where('status', '==', status) : base;
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

export async function updateMaterialDocument(
  orgId: string,
  materialId: string,
  patch: Partial<Omit<MaterialDocument, 'id' | 'orgId'>>,
): Promise<MaterialDocument | null> {
  const existing = await getMaterialDocument(orgId, materialId);
  if (!existing) return null;

  const next = { ...patch, updatedAt: nowIso() };
  await adminDb().collection(COLLECTIONS.materials).doc(materialId).set(next, { merge: true });
  return { ...existing, ...next };
}

export async function deleteMaterialDocument(orgId: string, materialId: string): Promise<void> {
  const existing = await getMaterialDocument(orgId, materialId);
  if (!existing) return;

  const db = adminDb();
  await db.collection(COLLECTIONS.materials).doc(materialId).delete();

  const photos = await db
    .collection(COLLECTIONS.materialPhotos)
    .where('materialId', '==', materialId)
    .limit(20)
    .get();

  const batch = db.batch();
  photos.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

// ------------------------------------------------------------------ photographs

export async function addMaterialPhotoDocument(photo: MaterialPhotoDocument): Promise<void> {
  const { id, ...rest } = photo;
  await adminDb().collection(COLLECTIONS.materialPhotos).doc(id).set(rest);
}

export async function listMaterialPhotoDocuments(
  orgId: string,
  materialId: string,
): Promise<MaterialPhotoDocument[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.materialPhotos)
    .where('orgId', '==', orgId)
    .where('materialId', '==', materialId)
    .orderBy('order', 'asc')
    .limit(20)
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<MaterialPhotoDocument, 'id'>),
    id: doc.id,
  }));
}

export async function getMaterialPhotoDocument(
  orgId: string,
  photoId: string,
): Promise<MaterialPhotoDocument | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.materialPhotos).doc(photoId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as Omit<MaterialPhotoDocument, 'id'>;
  if (data.orgId !== orgId) return null;

  return { ...data, id: snapshot.id };
}

export async function findPhotoByDigest(
  materialId: string,
  sha256: string,
): Promise<MaterialPhotoDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.materialPhotos)
    .where('materialId', '==', materialId)
    .where('sha256', '==', sha256)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { ...(doc.data() as Omit<MaterialPhotoDocument, 'id'>), id: doc.id };
}

export async function deleteMaterialPhotoDocument(orgId: string, photoId: string): Promise<void> {
  const photo = await getMaterialPhotoDocument(orgId, photoId);
  if (!photo) return;
  await adminDb().collection(COLLECTIONS.materialPhotos).doc(photoId).delete();
}

export function toDomainMaterial(
  document: MaterialDocument,
  photos: readonly MaterialPhotoDocument[],
): Material {
  const { photoCount: _count, primaryPhotoId: _primary, ...rest } = document;
  const domainPhotos: MaterialPhoto[] = photos.map((photo) => ({
    id: photo.id,
    orgId: photo.orgId,
    materialId: photo.materialId,
    storagePath: photo.storagePath,
    fileName: photo.fileName,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    sha256: photo.sha256,
    width: photo.width,
    height: photo.height,
    order: photo.order,
    createdAt: photo.createdAt,
  }));

  return { ...rest, photos: domainPhotos };
}

// ----------------------------------------------------------------- analysis jobs

export async function createAnalysisJobDocument(document: AnalysisJobDocument): Promise<void> {
  const { id, ...rest } = document;
  await adminDb().collection(COLLECTIONS.analysisJobs).doc(id).set(rest);
}

/**
 * A queued or running job for the same input. Prevents a double-click from paying
 * for the same analysis twice.
 */
export async function findJobByInputHash(
  orgId: string,
  materialId: string,
  inputHash: string,
): Promise<AnalysisJobDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.analysisJobs)
    .where('orgId', '==', orgId)
    .where('materialId', '==', materialId)
    .where('inputHash', '==', inputHash)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;

  const job = { ...(doc.data() as Omit<AnalysisJobDocument, 'id'>), id: doc.id };
  return job.status === 'succeeded' ? null : job;
}

export async function getAnalysisJobDocument(
  orgId: string,
  jobId: string,
): Promise<AnalysisJobDocument | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.analysisJobs).doc(jobId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as Omit<AnalysisJobDocument, 'id'>;
  if (data.orgId !== orgId) return null;

  return { ...data, id: snapshot.id };
}

/** A completed job with the same input hash is reused instead of re-billing. */
export async function findCachedAnalysisJob(
  orgId: string,
  inputHash: string,
): Promise<AnalysisJobDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.analysisJobs)
    .where('orgId', '==', orgId)
    .where('type', '==', 'material_analysis')
    .where('inputHash', '==', inputHash)
    .where('status', '==', 'succeeded')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { ...(doc.data() as Omit<AnalysisJobDocument, 'id'>), id: doc.id };
}

/**
 * Atomically claims a job for execution.
 *
 * The transaction is what makes the worker idempotent: two concurrent pollers
 * cannot both run the same job, and a job abandoned by a dead worker is
 * re-claimable once its claim goes stale.
 */
export async function claimAnalysisJob(
  jobId: string,
  staleAfterMs: number,
): Promise<AnalysisJobDocument | null> {
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.analysisJobs).doc(jobId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;

    const data = snapshot.data() as Omit<AnalysisJobDocument, 'id'>;
    const now = nowIso();
    const claimAge = data.claimedAt ? Date.now() - Date.parse(data.claimedAt) : Number.POSITIVE_INFINITY;

    const claimable =
      data.status === 'queued' || (data.status === 'running' && claimAge > staleAfterMs);

    if (!claimable) return null;

    const patch = {
      status: 'running' as AnalysisJobStatus,
      claimedAt: now,
      startedAt: data.startedAt ?? now,
      updatedAt: now,
      attempts: data.attempts + 1,
    };

    transaction.set(ref, patch, { merge: true });
    return { ...data, ...patch, id: snapshot.id };
  });
}

export async function completeAnalysisJob(
  jobId: string,
  patch: {
    readonly output: NonNullable<AnalysisJobDocument['output']>;
    readonly unsupportedClaims: readonly string[];
    readonly usage: AnalysisUsage;
    readonly model: string;
    readonly validationAttempts: number;
    readonly mock: boolean;
  },
): Promise<void> {
  const timestamp = nowIso();
  await adminDb()
    .collection(COLLECTIONS.analysisJobs)
    .doc(jobId)
    .set(
      {
        status: 'succeeded' as AnalysisJobStatus,
        output: patch.output,
        unsupportedClaims: [...patch.unsupportedClaims],
        usage: patch.usage,
        model: patch.model,
        validationAttempts: patch.validationAttempts,
        mock: patch.mock,
        error: null,
        finishedAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );
}

export async function failAnalysisJob(
  jobId: string,
  error: AnalysisJobError,
): Promise<void> {
  const timestamp = nowIso();
  await adminDb()
    .collection(COLLECTIONS.analysisJobs)
    .doc(jobId)
    .set(
      {
        status: 'failed' as AnalysisJobStatus,
        error,
        finishedAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );
}

/** The most recent analysis job for a material, whatever its status. */
export async function getLatestAnalysisJob(
  orgId: string,
  materialId: string,
): Promise<AnalysisJobDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.analysisJobs)
    .where('orgId', '==', orgId)
    .where('materialId', '==', materialId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { ...(doc.data() as Omit<AnalysisJobDocument, 'id'>), id: doc.id };
}

/** Finds a job that is queued or whose claim has gone stale, so it can be recovered. */
export async function findRecoverableJob(
  orgId: string,
  materialId: string,
  staleAfterMs: number,
): Promise<AnalysisJobDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.analysisJobs)
    .where('orgId', '==', orgId)
    .where('materialId', '==', materialId)
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  for (const doc of snapshot.docs) {
    const job = { ...(doc.data() as Omit<AnalysisJobDocument, 'id'>), id: doc.id };
    if (job.status === 'queued') return job;
    if (job.status === 'running') {
      const age = job.claimedAt ? Date.now() - Date.parse(job.claimedAt) : Number.POSITIVE_INFINITY;
      if (age > staleAfterMs) return job;
    }
  }

  return null;
}

export function toMaterialSummaryFields(document: MaterialDocument): {
  readonly photoCount: number;
  readonly primaryPhotoId: string | null;
} {
  return { photoCount: document.photoCount, primaryPhotoId: document.primaryPhotoId };
}

export const MATERIAL_SCHEMA_VERSION = SCHEMA_VERSION;
