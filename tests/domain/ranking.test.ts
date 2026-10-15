import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RANKING_WEIGHTS,
  rankOpportunities,
  resolveWeights,
  sortRanked,
  type OpportunitySignals,
} from '@/domain/ranking/rank';

function signals(overrides: Partial<OpportunitySignals> & { id: string }): OpportunitySignals {
  return {
    label: overrides.id,
    feasibilityStatus: 'process_feasible',
    contributionPerUnitMinor: 5_000,
    unitCostMinor: 3_000,
    referencePriceMinor: 8_000,
    materialUtilisationPercent: 70,
    buyerScore: 60,
    evidenceQuality: 'moderate',
    complexity: 'low',
    maxUnits: 40,
    ...overrides,
  };
}

describe('resolveWeights', () => {
  it('normalises weights to sum to one', () => {
    const weights = resolveWeights({ economicValue: 4, feasibility: 2 });
    const total =
      weights.feasibility +
      weights.economicValue +
      weights.materialUtilisation +
      weights.buyerCompatibility +
      weights.evidenceQuality +
      weights.lowComplexity;
    expect(total).toBeCloseTo(1, 6);
    expect(weights.economicValue).toBeGreaterThan(weights.materialUtilisation);
  });

  it('falls back to the defaults when every weight is zero', () => {
    const weights = resolveWeights({
      feasibility: 0,
      economicValue: 0,
      materialUtilisation: 0,
      buyerCompatibility: 0,
      evidenceQuality: 0,
      lowComplexity: 0,
    });
    expect(weights).toEqual(DEFAULT_RANKING_WEIGHTS);
  });
});

describe('rankOpportunities', () => {
  it('applies hard feasibility gates before scoring', () => {
    const ranked = rankOpportunities([
      signals({ id: 'viable' }),
      signals({
        id: 'impossible',
        feasibilityStatus: 'not_feasible',
        contributionPerUnitMinor: 999_999,
        materialUtilisationPercent: 100,
        buyerScore: 100,
        evidenceQuality: 'strong',
      }),
    ]);

    expect(ranked[0]?.id).toBe('viable');
    expect(ranked[0]?.gatesPassed).toBe(true);

    const gated = ranked.find((entry) => entry.id === 'impossible');
    expect(gated?.gatesPassed).toBe(false);
    expect(gated?.score).toBeNull();
    expect(gated?.gateReasons.join(' ')).toMatch(/hard manufacturing constraint/);
  });

  it('keeps score null when feasibility is not evaluated', () => {
    const ranked = rankOpportunities([
      signals({ id: 'unknown-material', feasibilityStatus: 'not_evaluated' }),
    ]);
    expect(ranked[0]?.score).toBeNull();
    expect(ranked[0]?.gateReasons.join(' ')).toMatch(/required material properties/);
  });

  it('leaves an unknown dimension null instead of scoring it as zero', () => {
    const ranked = rankOpportunities([
      signals({ id: 'no-market-data', evidenceQuality: 'insufficient' }),
    ]);

    const evidence = ranked[0]?.dimensions.find((dimension) => dimension.id === 'evidenceQuality');
    expect(evidence?.value).toBeNull();
    expect(evidence?.explanation).toMatch(/Insufficient Market Data/);
    expect(ranked[0]?.unknownDimensions).toEqual(['evidenceQuality']);
    expect(ranked[0]?.summary).toMatch(/could not be scored/);
  });

  it('normalises economic value against the best candidate in the set', () => {
    const ranked = rankOpportunities([
      signals({ id: 'best', contributionPerUnitMinor: 10_000 }),
      signals({ id: 'half', contributionPerUnitMinor: 5_000 }),
    ]);

    const best = ranked.find((entry) => entry.id === 'best');
    const half = ranked.find((entry) => entry.id === 'half');

    expect(best?.dimensions.find((d) => d.id === 'economicValue')?.value).toBe(1);
    expect(half?.dimensions.find((d) => d.id === 'economicValue')?.value).toBe(0.5);
  });

  it('treats negative contribution as zero economic value rather than a penalty above zero', () => {
    const ranked = rankOpportunities([
      signals({ id: 'loses-money', contributionPerUnitMinor: -2_000 }),
      signals({ id: 'best', contributionPerUnitMinor: 8_000 }),
    ]);

    const value = ranked
      .find((entry) => entry.id === 'loses-money')
      ?.dimensions.find((dimension) => dimension.id === 'economicValue')?.value;
    expect(value).toBe(0);
  });

  it('scores feasibility lower for conditional support', () => {
    const ranked = rankOpportunities([
      signals({ id: 'process', feasibilityStatus: 'process_feasible' }),
      signals({ id: 'conditional', feasibilityStatus: 'conditionally_feasible' }),
      signals({ id: 'geometry', feasibilityStatus: 'geometrically_feasible' }),
    ]);

    const values = Object.fromEntries(
      ranked.map((entry) => [
        entry.id,
        entry.dimensions.find((dimension) => dimension.id === 'feasibility')?.value,
      ]),
    );

    expect(values.process).toBe(1);
    expect(values.geometry).toBe(0.7);
    expect(values.conditional).toBe(0.45);
  });

  it('ranks higher scores first and assigns sequential ranks', () => {
    const ranked = rankOpportunities([
      signals({ id: 'low', contributionPerUnitMinor: 1_000, materialUtilisationPercent: 30, buyerScore: 20 }),
      signals({ id: 'high', contributionPerUnitMinor: 10_000, materialUtilisationPercent: 85, buyerScore: 90 }),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(['high', 'low']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it('breaks ties deterministically by id', () => {
    const build = () =>
      rankOpportunities([
        signals({ id: 'bbb' }),
        signals({ id: 'aaa' }),
        signals({ id: 'ccc' }),
      ]);

    expect(build().map((entry) => entry.id)).toEqual(['aaa', 'bbb', 'ccc']);
    expect(build()).toEqual(build());
  });

  it('honours custom weights', () => {
    const candidates = [
      signals({ id: 'economical', contributionPerUnitMinor: 10_000, materialUtilisationPercent: 20 }),
      signals({ id: 'efficient', contributionPerUnitMinor: 1_000, materialUtilisationPercent: 90 }),
    ];

    const economicFirst = rankOpportunities(candidates, {
      weights: { economicValue: 10, materialUtilisation: 0 },
    });
    const efficientFirst = rankOpportunities(candidates, {
      weights: { economicValue: 0, materialUtilisation: 10 },
    });

    expect(economicFirst[0]?.id).toBe('economical');
    expect(efficientFirst[0]?.id).toBe('efficient');
  });

  it('explains every dimension it scores', () => {
    const ranked = rankOpportunities([signals({ id: 'one' })]);
    for (const dimension of ranked[0]?.dimensions ?? []) {
      expect(dimension.label.length).toBeGreaterThan(0);
      expect(dimension.explanation.length).toBeGreaterThan(15);
      expect(dimension.weight).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('sortRanked', () => {
  const ranked = rankOpportunities([
    signals({ id: 'cheap-simple', contributionPerUnitMinor: 1_000, complexity: 'low', materialUtilisationPercent: 30 }),
    signals({ id: 'rich-complex', contributionPerUnitMinor: 10_000, complexity: 'high', materialUtilisationPercent: 90 }),
  ]);

  it('sorts by economic potential', () => {
    expect(sortRanked(ranked, 'economic_potential')[0]?.id).toBe('rich-complex');
  });

  it('sorts by material utilisation', () => {
    expect(sortRanked(ranked, 'material_utilisation')[0]?.id).toBe('rich-complex');
  });

  it('sorts by production simplicity', () => {
    expect(sortRanked(ranked, 'production_complexity')[0]?.id).toBe('cheap-simple');
  });

  it('keeps gated candidates at the end regardless of sort mode', () => {
    const withGated = rankOpportunities([
      signals({ id: 'viable', materialUtilisationPercent: 10 }),
      signals({ id: 'impossible', feasibilityStatus: 'not_feasible', materialUtilisationPercent: 99 }),
    ]);

    expect(sortRanked(withGated, 'material_utilisation').map((entry) => entry.id)).toEqual([
      'viable',
      'impossible',
    ]);
  });
});
