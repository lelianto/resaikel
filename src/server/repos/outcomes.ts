import type { ProductionOutcomeDocument } from '@/domain/outcomes/types';

import { adminDb, COLLECTIONS } from '../firebase/admin';

export async function createProductionOutcome(
  document: ProductionOutcomeDocument,
): Promise<void> {
  const { id, ...data } = document;
  await adminDb().collection(COLLECTIONS.productionOutcomes).doc(id).create(data);
}

export async function listProductionOutcomes(
  orgId: string,
  opportunityId: string,
  limit = 20,
): Promise<ProductionOutcomeDocument[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.productionOutcomes)
    .where('orgId', '==', orgId)
    .where('opportunityId', '==', opportunityId)
    .orderBy('occurredAt', 'desc')
    .limit(Math.min(Math.max(limit, 1), 50))
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<ProductionOutcomeDocument, 'id'>),
    id: doc.id,
  }));
}

/**
 * Every recorded outcome for an organisation, for impact aggregation.
 *
 * This is a single-field `orgId` equality query, so it needs no composite index.
 * Ordering is done in memory by the caller after aggregation; the cap is a safety
 * bound, not a pagination window — the impact report is only honest if it sums
 * every outcome, so the cap is set well above any realistic single-org volume.
 */
export async function listOrgProductionOutcomes(
  orgId: string,
  cap = 500,
): Promise<ProductionOutcomeDocument[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.productionOutcomes)
    .where('orgId', '==', orgId)
    .limit(Math.min(Math.max(cap, 1), 1000))
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<ProductionOutcomeDocument, 'id'>),
    id: doc.id,
  }));
}
