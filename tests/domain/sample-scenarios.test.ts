import { describe, expect, it } from 'vitest';

import { sampleScenario, sampleScenarios, scenarioMaterialSummary } from '@/domain/demo/sample-scenarios';
import { SAMPLE_MARKET_EVIDENCE } from '@/domain/demo/market-evidence';
import { EVIDENCE_SOURCE_TYPES } from '@/domain/market/types';
import { PRODUCT_TEMPLATES } from '@/domain/catalog/templates';

/**
 * The landing page and the how-it-works page both render `sampleScenarios()`.
 *
 * Those numbers are presented to a stranger as what the product produces, so they
 * get the same scrutiny as anything else: real engines, real catalogue, real
 * evidence set, and a test that asserts the output is internally consistent.
 */

describe('sample scenarios', () => {
  const scenarios = sampleScenarios();

  it('exposes the three documented scenarios', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'plywood-offcuts',
      'cardboard-waste',
      'undersized-cardboard',
    ]);
  });

  it('is memoised, so the engines are not re-run per render', () => {
    expect(sampleScenarios()).toBe(scenarios);
    expect(sampleScenario('plywood-offcuts')).toBe(scenarios[0]);
    expect(sampleScenario('does-not-exist')).toBeNull();
  });

  it('flags every scenario as sample data', () => {
    for (const scenario of scenarios) {
      expect(scenario.isSampleData).toBe(true);
    }
  });

  it('produces at least one viable candidate for the plywood scenario', () => {
    const scenario = scenarios[0]!;
    const viable = scenario.opportunities.filter((entry) => entry.gatesPassed);

    expect(viable.length).toBeGreaterThan(0);
    for (const entry of viable) {
      expect(entry.maxUnits).toBeGreaterThan(0);
      expect(entry.unitCostMinor).not.toBeNull();
      expect(entry.unitCostMinor!).toBeGreaterThan(0);
      expect(entry.wastePercent).not.toBeNull();
      expect(entry.wastePercent!).toBeGreaterThanOrEqual(0);
      expect(entry.wastePercent!).toBeLessThan(100);
    }
  });

  it('produces at least one viable candidate for the cardboard scenario', () => {
    const scenario = sampleScenarios()[1]!;
    expect(scenario.opportunities.some((entry) => entry.gatesPassed)).toBe(true);
  });

  it('rejects the undersized cardboard where the geometry cannot work, and says why', () => {
    const scenario = sampleScenarios()[2]!;

    expect(scenario.opportunities.length).toBeGreaterThan(0);

    // A shipping box dieline cannot be cut from a 300 x 200 mm sheet at all.
    const shipping = scenario.opportunities.find(
      (entry) => entry.templateId === 'cardboard-shipping-box-small',
    );
    expect(shipping?.gatesPassed).toBe(false);
    expect(shipping?.status).toBe('not_feasible');
    expect(shipping?.rejectReasons.join(' ')).toMatch(/larger than the 300 x 200 mm sheet/);

    // The display stand fails on both thickness and panel size.
    const stand = scenario.opportunities.find(
      (entry) => entry.templateId === 'cardboard-retail-display-stand',
    );
    expect(stand?.gatesPassed).toBe(false);
    expect(stand?.rejectReasons.join(' ')).toMatch(/needs at least 4 mm/);
    expect(stand?.rejectReasons.length).toBeGreaterThan(1);

    // ...but a folding insert still fits, which is the more useful answer.
    const insert = scenario.opportunities.find(
      (entry) => entry.templateId === 'cardboard-packaging-insert',
    );
    expect(insert?.gatesPassed).toBe(true);
    expect(insert?.maxUnits).toBeGreaterThan(0);

    for (const entry of scenario.opportunities) {
      if (entry.gatesPassed) continue;
      expect(entry.rejectReasons.length).toBeGreaterThan(0);
      expect(entry.score).toBeNull();
    }
  });

  it('ranks every scenario sequentially with gated candidates first', () => {
    for (const scenario of scenarios) {
      const ranks = scenario.opportunities.map((entry) => entry.rank);
      expect(ranks).toEqual(scenario.opportunities.map((_, index) => index + 1));

      const firstGatedIndex = scenario.opportunities.findIndex((entry) => !entry.gatesPassed);
      const lastViableIndex = scenario.opportunities
        .map((entry) => entry.gatesPassed)
        .lastIndexOf(true);

      if (firstGatedIndex !== -1 && lastViableIndex !== -1) {
        // A candidate that failed a hard gate is never ranked above a viable one.
        expect(lastViableIndex).toBeLessThan(firstGatedIndex);
      }
    }
  });

  it('distinguishes a clean verdict from one with a caveat', () => {
    // Scenario A contains a candidate that clears the gates but carries a
    // caveat, which must not be reported as a clean green light.
    const conditional = sampleScenarios()
      .flatMap((scenario) => scenario.opportunities)
      .filter((entry) => entry.gatesPassed && !entry.fullyFeasible);

    expect(conditional.length).toBeGreaterThan(0);
    for (const entry of conditional) {
      expect(entry.status).toBe('conditionally_feasible');
      expect(entry.feasibility!.warnings.length).toBeGreaterThan(0);
    }
  });

  it('shows the full cost build-up with an explanation per line', () => {
    const viable = sampleScenarios()
      .flatMap((scenario) => scenario.opportunities)
      .filter((entry) => entry.cost !== null);

    expect(viable.length).toBeGreaterThan(0);

    for (const entry of viable) {
      const cost = entry.cost!;
      expect(cost.lineItems).toHaveLength(11);
      for (const line of cost.lineItems) {
        expect(line.basis.length).toBeGreaterThan(10);
      }
      expect(cost.assumptions.currency).toBe('IDR');
    }
  });

  it('derives prices from the labelled evidence set, never from nothing', () => {
    for (const scenario of scenarios) {
      for (const entry of scenario.opportunities) {
        if (entry.referencePriceMinor === null) {
          expect(entry.evidenceQuality).toBe('insufficient');
          expect(entry.market.bands).toBeNull();
        } else {
          expect(entry.evidenceQuality).not.toBe('insufficient');
          expect(entry.market.bands?.sampleSize).toBeGreaterThan(0);
        }
      }
    }
  });

  it('labels every piece of market evidence by source type', () => {
    for (const row of SAMPLE_MARKET_EVIDENCE) {
      expect(EVIDENCE_SOURCE_TYPES).toContain(row.sourceType);
      expect(row.isSampleData).toBe(true);
      expect(row.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('never claims certification or compliance', () => {
    const forbidden = /certified|certification|compliant|compliance|load[- ]?rated|fire[- ]?rated/i;

    for (const scenario of scenarios) {
      for (const entry of scenario.opportunities) {
        const text = [
          ...entry.warnings,
          ...entry.rejectReasons,
          ...entry.reasons,
          ...(entry.feasibility?.checks.map((check) => check.detail) ?? []),
        ].join(' ');

        expect(forbidden.test(text)).toBe(false);
      }
    }
  });

  it('states the framework limits on every evaluated candidate', () => {
    for (const scenario of scenarios) {
      for (const entry of scenario.opportunities) {
        if (!entry.feasibility) continue;
        expect(entry.feasibility.disclaimer).toMatch(/not a production drawing/i);
        expect(entry.feasibility.disclaimer).toMatch(/does not prove structural safety/i);
        expect(entry.feasibility.assumptions.length).toBeGreaterThan(0);
      }
    }
  });

  it('flags a buyer shortfall where demand exceeds capacity', () => {
    const withShortfall = sampleScenarios()
      .flatMap((scenario) => scenario.opportunities)
      .filter((entry) => entry.buyerMatchSet.shortfallDetected);

    // Scenario B produces far fewer than the 5,000 units the sample refurbisher
    // asked for, which is exactly the gap the product must report.
    expect(withShortfall.length).toBeGreaterThan(0);

    for (const entry of withShortfall) {
      const short = entry.buyerMatchSet.verifiedRequests.find((match) => match.shortfall !== null);
      expect(short?.shortfall?.shortfall).toBeGreaterThan(0);
    }
  });

  it('only ever names buyers that registered themselves', () => {
    const registered = ['Sample Devices Refurb', 'Sample Gift Studio'];

    for (const scenario of scenarios) {
      for (const entry of scenario.opportunities) {
        for (const match of entry.buyerMatchSet.verifiedRequests) {
          expect(match.requirementId).not.toBeNull();
          expect(registered).toContain(match.label);
          expect(match.caveats.join(' ')).toMatch(/not a purchase order/);
        }
        for (const match of entry.buyerMatchSet.potentialSegments) {
          expect(match.requirementId).toBeNull();
          expect(match.caveats.join(' ')).toMatch(/Potential Customer Segment/);
        }
      }
    }
  });

  it('builds every preview from a real catalogue template', () => {
    const ids = new Set(PRODUCT_TEMPLATES.map((template) => template.id));
    for (const scenario of scenarios) {
      for (const entry of scenario.opportunities) {
        expect(ids).toContain(entry.templateId);
      }
    }
  });

  it('formats a material summary without inventing anything', () => {
    const scenario = sampleScenarios()[0]!;
    const summary = scenarioMaterialSummary(scenario.material);
    expect(summary).toMatch(/600 × 400 mm/);
    expect(summary).toMatch(/4 sheet\(s\)/);
  });
});
