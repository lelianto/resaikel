import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeDb } from '../support/fake-firestore';

/**
 * Persistence-continuity integration test.
 *
 * The pure engines are unit-tested elsewhere. What this exercises is the layer the
 * audit flagged as unproven: the service guards, the repository read/write mapping
 * and the aggregation reading back exactly what the service wrote — the full
 * "save opportunity -> record outcome -> read back -> report impact" chain.
 *
 * Firestore is replaced by an in-memory fake (see ./support/fake-firestore), so
 * this runs anywhere. It deliberately does NOT cover security rules or indexes;
 * those still require the emulator.
 */
vi.mock('@/server/firebase/admin', async () => {
  const actual = await vi.importActual<typeof import('@/server/firebase/admin')>(
    '@/server/firebase/admin',
  );
  return { ...actual, adminDb: () => fakeDb };
});

const { COLLECTIONS } = await import('@/server/firebase/admin');
const { recordProductionOutcome } = await import('@/server/services/outcomes');
const { listOrgProductionOutcomes } = await import('@/server/repos/outcomes');
const { aggregateCircularity } = await import('@/domain/outcomes/circularity');

const AUTH = {
  uid: 'user-1',
  email: 'demo@resaikel.test',
  emailVerified: true,
  displayName: 'Demo',
  orgId: 'org-1',
  orgName: 'Demo Workshop',
  role: 'owner' as const,
  roles: [] as const,
  currency: 'IDR',
  country: 'ID',
  locale: 'id-ID',
  onboardingCompleted: true,
};

function seedOpportunity(id: string, overrides: Record<string, unknown> = {}): void {
  void fakeDb.collection(COLLECTIONS.productOpportunities).doc(id).set({
    orgId: 'org-1',
    saved: true,
    materialId: 'mat-1',
    productName: 'Reclaimed shipping box',
    summary: { currency: 'IDR', maxUnits: 12, unitCostMinor: 50_000 },
    ...overrides,
  });
}

function seedMaterial(id: string, overrides: Record<string, unknown> = {}): void {
  void fakeDb.collection(COLLECTIONS.materials).doc(id).set({
    orgId: 'org-1',
    quantity: { unit: 'sheet', value: 6 },
    ...overrides,
  });
}

const BASE_OUTCOME = {
  auth: AUTH,
  quantityManufactured: 6,
  quantitySold: 4,
  materialConsumedQuantity: 2,
  remainingMaterialQuantity: 3,
  unusedWasteQuantity: 0.5,
  actualRevenueMinor: 800_000,
  costLines: {
    additionalMaterialsMinor: 50_000,
    labourMinor: 200_000,
    overheadMinor: 60_000,
    packagingMinor: 30_000,
    otherMinor: 10_000,
  },
  occurredAt: '2026-09-01T00:00:00.000Z',
  notes: null,
};

describe('outcome to impact continuity', () => {
  beforeEach(() => {
    fakeDb.reset();
  });

  it('records an outcome, reads it back, and aggregates it into the impact report', async () => {
    seedOpportunity('opp-1');
    seedMaterial('mat-1');

    const recorded = await recordProductionOutcome({ ...BASE_OUTCOME, opportunityId: 'opp-1' });

    // The service computed the actuals rather than trusting the caller.
    expect(recorded.totalActualCostMinor).toBe(350_000);
    expect(recorded.actualGrossProfitMinor).toBe(450_000);
    expect(recorded.materialQuantityUnit).toBe('sheet');
    expect(recorded.orgId).toBe('org-1');

    // It is persisted and reads back through the repository unchanged.
    const stored = await listOrgProductionOutcomes('org-1');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.actualGrossProfitMinor).toBe(450_000);

    // And it flows into the circularity aggregate the dashboard renders.
    const summary = aggregateCircularity(stored);
    expect(summary.recordedRuns).toBe(1);
    expect(summary.productsManufactured).toBe(6);
    expect(summary.productsSold).toBe(4);
    expect(summary.materialFlow[0]).toMatchObject({
      unit: 'sheet',
      reusedQuantity: 2,
      wasteQuantity: 0.5,
    });
    expect(summary.economicResults[0]).toMatchObject({
      currency: 'IDR',
      revenueMinor: 800_000,
      grossProfitMinor: 450_000,
    });
  });

  it('accumulates multiple runs across opportunities into one report', async () => {
    seedOpportunity('opp-1', { materialId: 'mat-1' });
    seedOpportunity('opp-2', { materialId: 'mat-2', productName: 'Corner shelf' });
    seedMaterial('mat-1');
    seedMaterial('mat-2');

    await recordProductionOutcome({ ...BASE_OUTCOME, opportunityId: 'opp-1' });
    await recordProductionOutcome({
      ...BASE_OUTCOME,
      opportunityId: 'opp-1',
      occurredAt: '2026-09-20T00:00:00.000Z',
      quantityManufactured: 8,
      quantitySold: 8,
      materialConsumedQuantity: 1.5,
      unusedWasteQuantity: 0.25,
    });
    await recordProductionOutcome({
      ...BASE_OUTCOME,
      opportunityId: 'opp-2',
      occurredAt: '2026-10-05T00:00:00.000Z',
      quantityManufactured: 4,
      quantitySold: 2,
      materialConsumedQuantity: 3,
      unusedWasteQuantity: 1,
    });

    const summary = aggregateCircularity(await listOrgProductionOutcomes('org-1'));

    expect(summary.recordedRuns).toBe(3);
    expect(summary.opportunitiesRealised).toBe(2);
    expect(summary.materialsReused).toBe(2);
    expect(summary.productsManufactured).toBe(18);
    expect(summary.productsSold).toBe(14);
    // 14 / 18 = 77.78% = 7778 bps
    expect(summary.sellThroughBps).toBe(7778);
    // reused 2 + 1.5 + 3 = 6.5, waste 0.5 + 0.25 + 1 = 1.75
    expect(summary.materialFlow[0]).toMatchObject({ reusedQuantity: 6.5, wasteQuantity: 1.75 });
  });

  it('refuses to record against an unsaved opportunity', async () => {
    seedOpportunity('opp-1', { saved: false });
    seedMaterial('mat-1');

    await expect(
      recordProductionOutcome({ ...BASE_OUTCOME, opportunityId: 'opp-1' }),
    ).rejects.toThrow(/save this opportunity/i);

    expect(await listOrgProductionOutcomes('org-1')).toHaveLength(0);
  });

  it('refuses to record against a missing opportunity', async () => {
    await expect(
      recordProductionOutcome({ ...BASE_OUTCOME, opportunityId: 'ghost' }),
    ).rejects.toThrow(/does not exist/i);
  });

  it('refuses to record when the source material is gone', async () => {
    seedOpportunity('opp-1', { materialId: 'mat-missing' });

    await expect(
      recordProductionOutcome({ ...BASE_OUTCOME, opportunityId: 'opp-1' }),
    ).rejects.toThrow(/material no longer exists/i);
  });

  it('does not leak another organisation’s outcomes', async () => {
    seedOpportunity('opp-1');
    seedMaterial('mat-1');
    await recordProductionOutcome({ ...BASE_OUTCOME, opportunityId: 'opp-1' });

    expect(await listOrgProductionOutcomes('org-1')).toHaveLength(1);
    expect(await listOrgProductionOutcomes('other-org')).toHaveLength(0);
  });
});
