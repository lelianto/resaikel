import { describe, expect, it } from 'vitest';

import { aggregateCircularity } from '@/domain/outcomes/circularity';
import type { ProductionOutcomeDocument } from '@/domain/outcomes/types';

function outcome(overrides: Partial<ProductionOutcomeDocument> = {}): ProductionOutcomeDocument {
  return {
    id: 'outcome-1',
    orgId: 'org-1',
    schemaVersion: 1,
    opportunityId: 'opp-1',
    materialId: 'mat-1',
    productName: 'Shipping box',
    currency: 'IDR',
    materialQuantityUnit: 'sheet',
    estimatedMaxUnits: 10,
    estimatedUnitCostMinor: 50_000,
    quantityManufactured: 10,
    quantitySold: 8,
    materialConsumedQuantity: 3,
    remainingMaterialQuantity: 1,
    unusedWasteQuantity: 1,
    actualRevenueMinor: 1_600_000,
    totalActualCostMinor: 750_000,
    actualGrossProfitMinor: 850_000,
    costLines: {
      additionalMaterialsMinor: 0,
      labourMinor: 0,
      overheadMinor: 0,
      packagingMinor: 0,
      otherMinor: 0,
    },
    actualGrossMarginBps: 5313,
    averageRevenuePerSoldUnitMinor: 200_000,
    averageCostPerManufacturedUnitMinor: 75_000,
    sellThroughBps: 8000,
    notes: null,
    occurredAt: '2026-10-10T00:00:00.000Z',
    createdBy: 'user-1',
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('circularity aggregation', () => {
  it('returns zeros and nulls for no outcomes', () => {
    const summary = aggregateCircularity([]);

    expect(summary.recordedRuns).toBe(0);
    expect(summary.materialsReused).toBe(0);
    expect(summary.opportunitiesRealised).toBe(0);
    expect(summary.productsManufactured).toBe(0);
    expect(summary.productsSold).toBe(0);
    expect(summary.sellThroughBps).toBeNull();
    expect(summary.materialFlow).toEqual([]);
    expect(summary.economicResults).toEqual([]);
    expect(summary.firstRecordedAt).toBeNull();
    expect(summary.lastRecordedAt).toBeNull();
  });

  it('sums products and derives sell-through across runs', () => {
    const summary = aggregateCircularity([
      outcome({ id: 'a', quantityManufactured: 10, quantitySold: 8 }),
      outcome({ id: 'b', opportunityId: 'opp-2', quantityManufactured: 6, quantitySold: 3 }),
    ]);

    expect(summary.recordedRuns).toBe(2);
    expect(summary.productsManufactured).toBe(16);
    expect(summary.productsSold).toBe(11);
    // 11 / 16 = 68.75% = 6875 bps
    expect(summary.sellThroughBps).toBe(6875);
    expect(summary.opportunitiesRealised).toBe(2);
    expect(summary.materialsReused).toBe(1);
  });

  it('counts distinct materials and opportunities, not records', () => {
    const summary = aggregateCircularity([
      outcome({ id: 'a', materialId: 'mat-1', opportunityId: 'opp-1' }),
      outcome({ id: 'b', materialId: 'mat-1', opportunityId: 'opp-1' }),
      outcome({ id: 'c', materialId: 'mat-2', opportunityId: 'opp-2' }),
    ]);

    expect(summary.recordedRuns).toBe(3);
    expect(summary.materialsReused).toBe(2);
    expect(summary.opportunitiesRealised).toBe(2);
  });

  it('groups material flow by unit and never adds unlike units', () => {
    const summary = aggregateCircularity([
      outcome({ id: 'a', materialQuantityUnit: 'sheet', materialConsumedQuantity: 3, unusedWasteQuantity: 1, remainingMaterialQuantity: 2 }),
      outcome({ id: 'b', materialQuantityUnit: 'sheet', materialConsumedQuantity: 2, unusedWasteQuantity: 0, remainingMaterialQuantity: 1 }),
      outcome({ id: 'c', materialQuantityUnit: 'kg', materialConsumedQuantity: 4, unusedWasteQuantity: 1, remainingMaterialQuantity: 0 }),
    ]);

    expect(summary.materialFlow).toHaveLength(2);

    const sheet = summary.materialFlow.find((flow) => flow.unit === 'sheet');
    expect(sheet).toMatchObject({ reusedQuantity: 5, wasteQuantity: 1 });
    // waste ratio = 1 / (5 + 1) = 16.67% = 1667 bps
    expect(sheet?.wasteRatioBps).toBe(1667);

    const kg = summary.materialFlow.find((flow) => flow.unit === 'kg');
    expect(kg).toMatchObject({ reusedQuantity: 4, wasteQuantity: 1 });
    expect(kg?.wasteRatioBps).toBe(2000);
  });

  it('leaves the waste ratio null when nothing was processed in a unit', () => {
    const summary = aggregateCircularity([
      outcome({ materialQuantityUnit: 'm2', materialConsumedQuantity: 0, unusedWasteQuantity: 0, remainingMaterialQuantity: 5 }),
    ]);

    expect(summary.materialFlow[0]?.wasteRatioBps).toBeNull();
  });

  it('groups money by currency and never converts across them', () => {
    const summary = aggregateCircularity([
      outcome({ id: 'a', currency: 'IDR', actualRevenueMinor: 1_000_000, totalActualCostMinor: 600_000 }),
      outcome({ id: 'b', currency: 'IDR', actualRevenueMinor: 500_000, totalActualCostMinor: 200_000 }),
      outcome({ id: 'c', currency: 'USD', actualRevenueMinor: 10_000, totalActualCostMinor: 4_000 }),
    ]);

    expect(summary.economicResults).toHaveLength(2);

    const idr = summary.economicResults.find((result) => result.currency === 'IDR');
    expect(idr).toMatchObject({ revenueMinor: 1_500_000, costMinor: 800_000, grossProfitMinor: 700_000 });
    // 700000 / 1500000 = 46.67% = 4667 bps
    expect(idr?.grossMarginBps).toBe(4667);

    const usd = summary.economicResults.find((result) => result.currency === 'USD');
    expect(usd).toMatchObject({ revenueMinor: 10_000, costMinor: 4_000, grossProfitMinor: 6_000 });
  });

  it('tracks the earliest and latest recorded dates', () => {
    const summary = aggregateCircularity([
      outcome({ id: 'a', occurredAt: '2026-05-01T00:00:00.000Z' }),
      outcome({ id: 'b', occurredAt: '2026-09-15T00:00:00.000Z' }),
      outcome({ id: 'c', occurredAt: '2026-07-20T00:00:00.000Z' }),
    ]);

    expect(summary.firstRecordedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(summary.lastRecordedAt).toBe('2026-09-15T00:00:00.000Z');
  });
});
