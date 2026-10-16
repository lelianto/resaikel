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
