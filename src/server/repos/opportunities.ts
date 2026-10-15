import { nowIso } from '@/domain/common';
import type {
  CostEstimateDocument,
  FeasibilityResultDocument,
  OpportunityDocument,
} from '@/domain/opportunity/types';

import { adminDb, COLLECTIONS } from '../firebase/admin';

/**
 * Opportunity, feasibility and cost persistence.
 *
 * Feasibility results and cost estimates are keyed by the opportunity id, so a
 * re-evaluation overwrites in place and there is exactly one authoritative result
 * per opportunity rather than a growing history of near-duplicates.
 */

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 24;

export async function saveOpportunityDocuments(
  documents: readonly OpportunityDocument[],
): Promise<void> {
  if (documents.length === 0) return;
  const db = adminDb();
  const batch = db.batch();

  for (const document of documents) {
    const { id, ...rest } = document;
    batch.set(db.collection(COLLECTIONS.productOpportunities).doc(id), rest);
  }

  await batch.commit();
}

export async function getOpportunityDocument(
  orgId: string,
  opportunityId: string,
): Promise<OpportunityDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.productOpportunities)
    .doc(opportunityId)
    .get();

  if (!snapshot.exists) return null;

  const data = snapshot.data() as Omit<OpportunityDocument, 'id'>;
  if (data.orgId !== orgId) return null;

  return { ...data, id: snapshot.id };
}

export interface ListOpportunitiesOptions {
  readonly materialId?: string | null | undefined;
  readonly savedOnly?: boolean | undefined;
  readonly cursor?: string | null | undefined;
  readonly limit?: number | undefined;
}

export async function listOpportunityDocuments(
  orgId: string,
  options: ListOpportunitiesOptions = {},
): Promise<{ items: OpportunityDocument[]; nextCursor: string | null }> {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));
  const db = adminDb();

  if (options.savedOnly) {
    let query = db
      .collection(COLLECTIONS.productOpportunities)
      .where('orgId', '==', orgId)
      .where('saved', '==', true)
      .orderBy('savedAt', 'desc')
      .limit(limit + 1);

    if (options.cursor) query = query.startAfter(options.cursor);

    const snapshot = await query.get();
    const items = snapshot.docs.slice(0, limit).map((doc) => ({
      ...(doc.data() as Omit<OpportunityDocument, 'id'>),
      id: doc.id,
    }));
    const last = items.at(-1);

    return {
      items,
      nextCursor: snapshot.docs.length > limit && last ? (last.savedAt ?? null) : null,
    };
  }

  let query = db
    .collection(COLLECTIONS.productOpportunities)
    .where('orgId', '==', orgId)
    .orderBy('rank', 'asc')
    .orderBy('createdAt', 'desc')
    .limit(limit + 1);

  if (options.materialId) {
    query = db
      .collection(COLLECTIONS.productOpportunities)
      .where('orgId', '==', orgId)
      .where('materialId', '==', options.materialId)
      .orderBy('rank', 'asc')
      .limit(limit + 1);
  }

  if (options.cursor) query = query.startAfter(options.cursor);

  const snapshot = await query.get();
  const items = snapshot.docs.slice(0, limit).map((doc) => ({
    ...(doc.data() as Omit<OpportunityDocument, 'id'>),
    id: doc.id,
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor: snapshot.docs.length > limit && last ? last.createdAt : null,
  };
}

export async function countOpportunities(orgId: string, savedOnly = false): Promise<number> {
  const base = adminDb()
    .collection(COLLECTIONS.productOpportunities)
    .where('orgId', '==', orgId);

  const query = savedOnly ? base.where('saved', '==', true) : base;
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

export async function updateOpportunityDocument(
  orgId: string,
  opportunityId: string,
  patch: Partial<Omit<OpportunityDocument, 'id' | 'orgId'>>,
): Promise<OpportunityDocument | null> {
  const existing = await getOpportunityDocument(orgId, opportunityId);
  if (!existing) return null;

  const next = { ...patch, updatedAt: nowIso() };
  await adminDb()
    .collection(COLLECTIONS.productOpportunities)
    .doc(opportunityId)
    .set(next, { merge: true });

  return { ...existing, ...next };
}

/** Removes the opportunities and their engine outputs for a re-run material. */
export async function deleteOpportunitiesForMaterial(
  orgId: string,
  materialId: string,
): Promise<number> {
  const db = adminDb();
  const snapshot = await db
    .collection(COLLECTIONS.productOpportunities)
    .where('orgId', '==', orgId)
    .where('materialId', '==', materialId)
    .limit(50)
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    batch.delete(db.collection(COLLECTIONS.feasibilityResults).doc(doc.id));
    batch.delete(db.collection(COLLECTIONS.costEstimates).doc(doc.id));
  }
  await batch.commit();

  return snapshot.size;
}

export async function saveFeasibilityResult(
  document: FeasibilityResultDocument,
): Promise<void> {
  const { id, ...rest } = document;
  await adminDb().collection(COLLECTIONS.feasibilityResults).doc(id).set(rest);
}

export async function getFeasibilityResult(
  orgId: string,
  opportunityId: string,
): Promise<FeasibilityResultDocument | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.feasibilityResults)
    .doc(opportunityId)
    .get();

  if (!snapshot.exists) return null;

  const data = snapshot.data() as Omit<FeasibilityResultDocument, 'id'>;
  if (data.orgId !== orgId) return null;

  return { ...data, id: snapshot.id };
}

export async function saveCostEstimate(document: CostEstimateDocument): Promise<void> {
  const { id, ...rest } = document;
  await adminDb().collection(COLLECTIONS.costEstimates).doc(id).set(rest);
}

export async function getCostEstimate(
  orgId: string,
  opportunityId: string,
): Promise<CostEstimateDocument | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.costEstimates).doc(opportunityId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as Omit<CostEstimateDocument, 'id'>;
  if (data.orgId !== orgId) return null;

  return { ...data, id: snapshot.id };
}
