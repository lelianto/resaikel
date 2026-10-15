import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import type { ProductCategory } from '@/domain/catalog/types';
import type { BuyerRequirement } from '@/domain/buyers/matching';
import type { BuyerKind } from '@/domain/buyers/segments';
import type { MarketEvidence } from '@/domain/market/types';
import type { MaterialFamily } from '@/domain/materials/types';

import { adminDb, COLLECTIONS } from '../firebase/admin';

/**
 * Market reference data and registered demand.
 *
 * `market_evidence` is shared reference data seeded into the environment; it is
 * readable by any signed-in user and writable by nobody through the client. The
 * MVP ships a curated sample set, every row of which is flagged `isSampleData`.
 */

export async function listMarketEvidence(
  category: ProductCategory,
): Promise<MarketEvidence[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.marketEvidence)
    .where('productCategory', '==', category)
    .limit(50)
    .get();

  return snapshot.docs.map((doc) => doc.data() as MarketEvidence);
}

export async function countMarketEvidence(): Promise<number> {
  const snapshot = await adminDb().collection(COLLECTIONS.marketEvidence).count().get();
  return snapshot.data().count;
}

export async function upsertMarketEvidence(rows: readonly MarketEvidence[]): Promise<void> {
  if (rows.length === 0) return;
  const db = adminDb();
  const batch = db.batch();

  for (const row of rows) {
    batch.set(db.collection(COLLECTIONS.marketEvidence).doc(row.id), row);
  }

  await batch.commit();
}

export interface BuyerRequirementDocument extends BuyerRequirement {
  readonly orgId: string;
  readonly schemaVersion: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateBuyerRequirementInput {
  readonly orgId: string;
  readonly uid: string;
  readonly buyerKind: BuyerKind;
  readonly businessName: string | null;
  readonly industry: string | null;
  readonly location: string | null;
  readonly country: string | null;
  readonly productCategories: readonly ProductCategory[];
  readonly materialFamilies: readonly MaterialFamily[];
  readonly minOrderQuantity: number | null;
  readonly budgetMinMinor: number | null;
  readonly budgetMaxMinor: number | null;
  readonly currency: string;
  readonly capacityNote: string | null;
  readonly consentToMatch: boolean;
}

export async function createBuyerRequirement(
  input: CreateBuyerRequirementInput,
): Promise<BuyerRequirementDocument> {
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.buyerRequirements).doc();
  const timestamp = nowIso();

  const document: Omit<BuyerRequirementDocument, 'id'> = {
    orgId: input.orgId,
    schemaVersion: SCHEMA_VERSION,
    buyerKind: input.buyerKind,
    businessName: input.businessName,
    industry: input.industry,
    location: input.location,
    country: input.country,
    productCategories: [...input.productCategories],
    materialFamilies: [...input.materialFamilies],
    minOrderQuantity: input.minOrderQuantity,
    budgetMinMinor: input.budgetMinMinor,
    budgetMaxMinor: input.budgetMaxMinor,
    currency: input.currency,
    capacityNote: input.capacityNote,
    consentToMatch: input.consentToMatch,
    // A record only counts as verified demand when its owner consented. Without
    // consent the platform has no standing to match on it.
    verified: input.consentToMatch,
    createdBy: input.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await ref.set(document);
  return { ...document, id: ref.id };
}

/**
 * Demand the platform may match against: consented, verified, and for a category
 * this product belongs to. Anything else is never loaded.
 */
export async function listMatchableRequirements(
  category: ProductCategory,
  limit = 25,
): Promise<BuyerRequirementDocument[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.buyerRequirements)
    .where('productCategories', 'array-contains', category)
    .where('consentToMatch', '==', true)
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<BuyerRequirementDocument, 'id'>),
    id: doc.id,
  }));
}

export async function listOrgBuyerRequirements(
  orgId: string,
): Promise<BuyerRequirementDocument[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.buyerRequirements)
    .where('orgId', '==', orgId)
    .orderBy('createdAt', 'desc')
    .limit(25)
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<BuyerRequirementDocument, 'id'>),
    id: doc.id,
  }));
}
