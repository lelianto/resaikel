import { describe, expect, it } from 'vitest';

import { buildCostAssumptions, computeCost, defaultCostAssumptions } from '@/domain/cost/engine';
import { SAMPLE_COST_ASSUMPTIONS, type CostAssumptions } from '@/domain/cost/types';

/** A stripped-back assumption set so every expectation can be hand-checked. */
function base(overrides: Partial<CostAssumptions> = {}): CostAssumptions {
  return {
    currency: 'IDR',
    batchSize: 10,
    materialCostPerUnitMinor: 100,
    additionalMaterialsPerUnitMinor: 50,
    labourMinutesPerUnit: 60,
    labourRatePerHourMinor: 6000,
    machineMinutesPerUnit: 0,
    machineRatePerHourMinor: 0,
    electricityKwhPerUnit: 0,
    electricityTariffPerKwhMinor: 0,
    cuttingFinishingPerUnitMinor: 0,
    packagingPerUnitMinor: 0,
    transportPerBatchMinor: 0,
    defectAllowancePercent: 0,
    overheadPerBatchMinor: 0,
    platformFeePercent: 0,
    targetMarginPercent: 0,
    ...overrides,
  };
}

describe('computeCost', () => {
  it('prices an hour of labour exactly', () => {
    const estimate = computeCost({ assumptions: base() });
    expect(estimate.unitCostMinor).toBe(6150);
    expect(estimate.batchCostMinor).toBe(61_500);
    expect(estimate.minViablePricePerUnitMinor).toBe(6150);
  });

  it('converts a partial hour of labour with one rational step', () => {
    const estimate = computeCost({
      assumptions: base({ labourMinutesPerUnit: 25, labourRatePerHourMinor: 60_000 }),
    });
    // 25/60 * 60000 = 25000
    const labour = estimate.lineItems.find((line) => line.id === 'labour');
    expect(labour?.perUnitMinor).toBe(25_000);
  });

  it('flags a discrepant result rather than silently rounding a cost down', () => {
    // 10/60 * 10000 = 1666.66 -> half-up 1667
    const estimate = computeCost({
      assumptions: base({
        labourMinutesPerUnit: 10,
        labourRatePerHourMinor: 10_000,
        materialCostPerUnitMinor: 0,
        additionalMaterialsPerUnitMinor: 0,
      }),
    });
    expect(estimate.lineItems.find((line) => line.id === 'labour')?.perUnitMinor).toBe(1667);
  });

  it('computes electricity from kWh and tariff', () => {
    const estimate = computeCost({
      assumptions: base({
        electricityKwhPerUnit: 0.5,
        electricityTariffPerKwhMinor: 2000,
      }),
    });
    expect(estimate.lineItems.find((line) => line.id === 'electricity')?.perUnitMinor).toBe(1000);
  });

  it('spreads a fixed batch cost upwards so it is never understated', () => {
    const estimate = computeCost({
      assumptions: base({ batchSize: 3, overheadPerBatchMinor: 100 }),
    });
    const overhead = estimate.lineItems.find((line) => line.id === 'overhead');
    expect(overhead?.perUnitMinor).toBe(34);
    expect(overhead?.batchMinor).toBe(100);
  });

  it('applies the defect allowance to the variable cost only', () => {
    const estimate = computeCost({
      assumptions: base({ defectAllowancePercent: 5 }),
    });
    // variable = 100 + 50 + 6000 = 6150 -> 5% = 307.5 -> 308
    expect(estimate.variableCostPerUnitMinor).toBe(6150);
    expect(estimate.lineItems.find((line) => line.id === 'defect_allowance')?.perUnitMinor).toBe(308);
    expect(estimate.unitCostMinor).toBe(6458);
  });

  it('derives a minimum viable price that covers fee and margin', () => {
    const estimate = computeCost({
      assumptions: base({ platformFeePercent: 10, targetMarginPercent: 20 }),
    });
    // 6150 / (1 - 0.30) = 8785.71 -> 8786
    expect(estimate.minViablePricePerUnitMinor).toBe(8786);
  });

  it('excludes the platform fee from production cost', () => {
    const estimate = computeCost({
      assumptions: base({ platformFeePercent: 10 }),
      priceBands: {
        currency: 'IDR',
        lowMinor: 6000,
        referenceMinor: 8000,
        highMinor: 10_000,
        sampleSize: 4,
      },
    });

    const fee = estimate.lineItems.find((line) => line.id === 'platform_fee');
    expect(fee?.excludedFromUnitCost).toBe(true);
    expect(fee?.perUnitMinor).toBe(800);
    // unit cost is unchanged by the fee
    expect(estimate.unitCostMinor).toBe(6150);
  });

  it('refuses to produce a price when fee plus margin consume the whole price', () => {
    const estimate = computeCost({
      assumptions: base({ platformFeePercent: 60, targetMarginPercent: 40 }),
    });
    expect(estimate.minViablePricePerUnitMinor).toBeNull();
    expect(estimate.warnings.join(' ')).toMatch(/no selling price can cover/);
  });

  it('builds revenue scenarios and a margin in basis points', () => {
    const estimate = computeCost({
      assumptions: base({ batchSize: 10 }),
      priceBands: {
        currency: 'IDR',
        lowMinor: 6000,
        referenceMinor: 12_300,
        highMinor: 15_000,
        sampleSize: 4,
      },
    });

    expect(estimate.scenarios).toHaveLength(3);
    const reference = estimate.scenarios.find((scenario) => scenario.id === 'reference');
    expect(reference?.contributionPerUnitMinor).toBe(6150);
    expect(reference?.contributionMarginBps).toBe(5000);
    expect(reference?.batchRevenueMinor).toBe(123_000);
    expect(reference?.batchContributionMinor).toBe(61_500);

    const low = estimate.scenarios.find((scenario) => scenario.id === 'low');
    expect(low?.contributionPerUnitMinor).toBe(-150);
  });

  it('computes break-even from fixed batch costs and reference contribution', () => {
    const estimate = computeCost({
      assumptions: base({ overheadPerBatchMinor: 100_000 }),
      priceBands: {
        currency: 'IDR',
        lowMinor: 6000,
        referenceMinor: 12_300,
        highMinor: 15_000,
        sampleSize: 4,
      },
    });

    expect(estimate.fixedBatchCostMinor).toBe(100_000);
    expect(estimate.breakEvenUnits).toBe(17); // ceil(100000 / 6150)
  });

  it('omits scenarios when there is no market evidence', () => {
    const estimate = computeCost({ assumptions: base(), priceBands: null });
    expect(estimate.scenarios).toHaveLength(0);
    expect(estimate.priceBandsAvailable).toBe(false);
    expect(estimate.notes.join(' ')).toMatch(/no usable market evidence/i);
  });

  it('explains the derivation of every line item', () => {
    const estimate = computeCost({ assumptions: base({ defectAllowancePercent: 5 }) });
    expect(estimate.lineItems.length).toBe(11);
    for (const line of estimate.lineItems) {
      expect(line.basis.length).toBeGreaterThan(10);
      expect(line.editableAssumptionKeys.length).toBeGreaterThan(0);
    }
    expect(estimate.lineItems.find((line) => line.id === 'labour')?.basis).toMatch(
      /60 min\/unit at 6000\/hour/,
    );
  });

  it('warns about assumptions that would flatter the result', () => {
    const estimate = computeCost({
      assumptions: base({
        materialCostPerUnitMinor: 0,
        labourRatePerHourMinor: 0,
        defectAllowancePercent: 0,
      }),
    });

    const warnings = estimate.warnings.join(' ');
    expect(warnings).toMatch(/Labour is valued at zero/);
    expect(warnings).toMatch(/Material opportunity cost is zero/);
    expect(warnings).toMatch(/No defect allowance is set/);
  });

  it('warns when the reference price does not cover production cost', () => {
    const estimate = computeCost({
      assumptions: base(),
      priceBands: {
        currency: 'IDR',
        lowMinor: 1000,
        referenceMinor: 2000,
        highMinor: 3000,
        sampleSize: 3,
      },
    });

    expect(estimate.warnings.join(' ')).toMatch(/does not cover its production cost/);
  });

  it('carries service-supplied derivation hints into the basis text', () => {
    const estimate = computeCost({
      assumptions: base(),
      hints: { material: 'Grossed up for a 38% cutting waste rate.' },
    });
    expect(estimate.lineItems.find((line) => line.id === 'material')?.basis).toMatch(
      /38% cutting waste rate/,
    );
  });

  it('accepts caller overrides and clamps out-of-range values', () => {
    const { assumptions, issues } = buildCostAssumptions({
      currency: 'IDR',
      labourMinutesPerUnit: 18,
      overrides: { defectAllowancePercent: 900, platformFeePercent: -5 },
    });

    expect(assumptions.labourMinutesPerUnit).toBe(18);
    expect(assumptions.defectAllowancePercent).toBe(50);
    expect(assumptions.platformFeePercent).toBe(0);
    expect(issues).toHaveLength(2);
  });

  it('seeds defaults from the sample assumption set', () => {
    const assumptions = defaultCostAssumptions('USD');
    expect(assumptions.currency).toBe('USD');
    expect(assumptions.batchSize).toBe(SAMPLE_COST_ASSUMPTIONS.batchSize);
  });

  it('is deterministic for identical input', () => {
    const build = () => computeCost({ assumptions: base({ defectAllowancePercent: 7.5 }) });
    const first = build();
    const second = build();
    expect({ ...first, computedAt: '' }).toEqual({ ...second, computedAt: '' });
  });
});
