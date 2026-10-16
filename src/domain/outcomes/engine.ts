import type { ProductionOutcomeInput, ProductionOutcomeMetrics } from './types';

function roundRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round(numerator / denominator);
}

/** Pure arithmetic over values explicitly recorded as actuals by a user. */
export function computeProductionOutcome(input: ProductionOutcomeInput): ProductionOutcomeMetrics {
  const totalActualCostMinor = Object.values(input.costLines).reduce(
    (total, value) => total + value,
    0,
  );
  const actualGrossProfitMinor = input.actualRevenueMinor - totalActualCostMinor;

  return {
    totalActualCostMinor,
    actualGrossProfitMinor,
    actualGrossMarginBps: roundRatio(actualGrossProfitMinor * 10_000, input.actualRevenueMinor),
    averageRevenuePerSoldUnitMinor: roundRatio(
      input.actualRevenueMinor,
      input.quantitySold,
    ),
    averageCostPerManufacturedUnitMinor: roundRatio(
      totalActualCostMinor,
      input.quantityManufactured,
    ),
    sellThroughBps: roundRatio(input.quantitySold * 10_000, input.quantityManufactured),
  };
}
