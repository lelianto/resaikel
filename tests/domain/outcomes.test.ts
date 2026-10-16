import { describe, expect, it } from 'vitest';

import { computeProductionOutcome } from '@/domain/outcomes/engine';

describe('production outcome engine', () => {
  it('separates actual revenue and costs from the original estimate', () => {
    const outcome = computeProductionOutcome({
      quantityManufactured: 10,
      quantitySold: 8,
      materialConsumedQuantity: 3,
      remainingMaterialQuantity: 1,
      unusedWasteQuantity: 0.25,
      actualRevenueMinor: 1_600_000,
      costLines: {
        additionalMaterialsMinor: 200_000,
        labourMinor: 350_000,
        overheadMinor: 100_000,
        packagingMinor: 80_000,
        otherMinor: 20_000,
      },
    });

    expect(outcome.totalActualCostMinor).toBe(750_000);
    expect(outcome.actualGrossProfitMinor).toBe(850_000);
    expect(outcome.actualGrossMarginBps).toBe(5313);
    expect(outcome.averageRevenuePerSoldUnitMinor).toBe(200_000);
    expect(outcome.averageCostPerManufacturedUnitMinor).toBe(75_000);
    expect(outcome.sellThroughBps).toBe(8000);
  });

  it('keeps ratios null when their denominator is zero', () => {
    const outcome = computeProductionOutcome({
      quantityManufactured: 0,
      quantitySold: 0,
      materialConsumedQuantity: 0,
      remainingMaterialQuantity: 4,
      unusedWasteQuantity: 0,
      actualRevenueMinor: 0,
      costLines: {
        additionalMaterialsMinor: 0,
        labourMinor: 0,
        overheadMinor: 0,
        packagingMinor: 0,
        otherMinor: 0,
      },
    });

    expect(outcome.actualGrossMarginBps).toBeNull();
    expect(outcome.averageRevenuePerSoldUnitMinor).toBeNull();
    expect(outcome.averageCostPerManufacturedUnitMinor).toBeNull();
    expect(outcome.sellThroughBps).toBeNull();
  });

  it('allows an actual loss without disguising it as an estimate', () => {
    const outcome = computeProductionOutcome({
      quantityManufactured: 2,
      quantitySold: 1,
      materialConsumedQuantity: 1,
      remainingMaterialQuantity: 0,
      unusedWasteQuantity: 0.1,
      actualRevenueMinor: 100_000,
      costLines: {
        additionalMaterialsMinor: 50_000,
        labourMinor: 80_000,
        overheadMinor: 20_000,
        packagingMinor: 10_000,
        otherMinor: 0,
      },
    });

    expect(outcome.actualGrossProfitMinor).toBe(-60_000);
    expect(outcome.actualGrossMarginBps).toBe(-6000);
  });
});
