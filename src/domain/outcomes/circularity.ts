import type { ProductionOutcomeDocument } from './types';

/**
 * Circularity aggregation.
 *
 * Every number produced here is a sum or a ratio of values a person explicitly
 * recorded as an actual production outcome. Nothing is projected, modelled or
 * inferred: if no outcome has been recorded, every total is zero and every ratio
 * is `null`. This keeps the impact report inside the same discipline as the rest
 * of resaikel — measured, never guessed.
 *
 * Two things are deliberately **not** summed across the whole organisation:
 *
 * - Material quantities, because an outcome measured in sheets cannot be added to
 *   one measured in kilograms. They are grouped by unit instead.
 * - Money, because revenue in one currency cannot be added to revenue in another.
 *   It is grouped by ISO-4217 currency code instead.
 *
 * Remaining stock is deliberately **not** aggregated: it is a point-in-time level
 * recorded on each outcome, not an additive quantity, so summing it across runs
 * would be meaningless. Current availability belongs to the material inventory.
 */

export interface MaterialFlowByUnit {
  readonly unit: string;
  /** Material turned into product — the reuse that actually happened. */
  readonly reusedQuantity: number;
  /** Offcuts recorded as unusable waste. */
  readonly wasteQuantity: number;
  /**
   * Waste as a share of the material that was processed (reused + waste), in
   * basis points. `null` when nothing was processed in this unit, because a
   * ratio over zero is undefined rather than zero.
   */
  readonly wasteRatioBps: number | null;
}

export interface EconomicResultByCurrency {
  readonly currency: string;
  readonly revenueMinor: number;
  readonly costMinor: number;
  readonly grossProfitMinor: number;
  /** Gross margin in basis points, or `null` when there was no revenue. */
  readonly grossMarginBps: number | null;
}

export interface CircularitySummary {
  /** Number of recorded production outcomes. */
  readonly recordedRuns: number;
  /** Distinct materials that produced at least one outcome. */
  readonly materialsReused: number;
  /** Distinct saved opportunities that were actually produced. */
  readonly opportunitiesRealised: number;
  readonly productsManufactured: number;
  readonly productsSold: number;
  /** Units sold as a share of units made, in basis points. `null` when nothing was made. */
  readonly sellThroughBps: number | null;
  readonly materialFlow: readonly MaterialFlowByUnit[];
  readonly economicResults: readonly EconomicResultByCurrency[];
  /** ISO timestamp of the earliest / latest recorded outcome, or `null`. */
  readonly firstRecordedAt: string | null;
  readonly lastRecordedAt: string | null;
}

function ratioBps(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator * 10_000) / denominator);
}

/** Pure aggregation of recorded production outcomes into a circularity summary. */
export function aggregateCircularity(
  outcomes: readonly ProductionOutcomeDocument[],
): CircularitySummary {
  const materials = new Set<string>();
  const opportunities = new Set<string>();

  let productsManufactured = 0;
  let productsSold = 0;

  // Grouping preserves first-seen order so the report is stable and testable.
  const flowByUnit = new Map<string, { reused: number; waste: number }>();
  const moneyByCurrency = new Map<string, { revenue: number; cost: number }>();

  let firstRecordedAt: string | null = null;
  let lastRecordedAt: string | null = null;

  for (const outcome of outcomes) {
    materials.add(outcome.materialId);
    opportunities.add(outcome.opportunityId);

    productsManufactured += outcome.quantityManufactured;
    productsSold += outcome.quantitySold;

    const flow = flowByUnit.get(outcome.materialQuantityUnit) ?? { reused: 0, waste: 0 };
    flow.reused += outcome.materialConsumedQuantity;
    flow.waste += outcome.unusedWasteQuantity;
    flowByUnit.set(outcome.materialQuantityUnit, flow);

    const money = moneyByCurrency.get(outcome.currency) ?? { revenue: 0, cost: 0 };
    money.revenue += outcome.actualRevenueMinor;
    money.cost += outcome.totalActualCostMinor;
    moneyByCurrency.set(outcome.currency, money);

    if (firstRecordedAt === null || outcome.occurredAt < firstRecordedAt) {
      firstRecordedAt = outcome.occurredAt;
    }
    if (lastRecordedAt === null || outcome.occurredAt > lastRecordedAt) {
      lastRecordedAt = outcome.occurredAt;
    }
  }

  const materialFlow: MaterialFlowByUnit[] = [...flowByUnit.entries()].map(([unit, flow]) => ({
    unit,
    reusedQuantity: flow.reused,
    wasteQuantity: flow.waste,
    wasteRatioBps: ratioBps(flow.waste, flow.reused + flow.waste),
  }));

  const economicResults: EconomicResultByCurrency[] = [...moneyByCurrency.entries()].map(
    ([currency, money]) => {
      const grossProfitMinor = money.revenue - money.cost;
      return {
        currency,
        revenueMinor: money.revenue,
        costMinor: money.cost,
        grossProfitMinor,
        grossMarginBps: ratioBps(grossProfitMinor, money.revenue),
      };
    },
  );

  return {
    recordedRuns: outcomes.length,
    materialsReused: materials.size,
    opportunitiesRealised: opportunities.size,
    productsManufactured,
    productsSold,
    sellThroughBps: ratioBps(productsSold, productsManufactured),
    materialFlow,
    economicResults,
    firstRecordedAt,
    lastRecordedAt,
  };
}
