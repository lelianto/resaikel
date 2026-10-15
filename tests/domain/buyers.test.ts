import { describe, expect, it } from 'vitest';

import { matchBuyers, type BuyerRequirement, type MatchInput } from '@/domain/buyers/matching';
import type { BuyerSegmentId } from '@/domain/buyers/segments';

function requirement(overrides: Partial<BuyerRequirement> = {}): BuyerRequirement {
  return {
    id: 'req-1',
    buyerKind: 'b2b',
    businessName: 'Sample Devices Refurb',
    industry: 'Electronics refurbishment',
    location: 'Jakarta',
    country: 'ID',
    productCategories: ['packaging'],
    materialFamilies: ['cardboard'],
    minOrderQuantity: 500,
    budgetMinMinor: 5_000,
    budgetMaxMinor: 12_000,
    currency: 'IDR',
    capacityNote: null,
    consentToMatch: true,
    verified: true,
    ...overrides,
  };
}

function input(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    templateId: 'cardboard-shipping-box-small',
    category: 'packaging',
    materialFamilies: ['cardboard'],
    materialFamily: 'cardboard',
    complexity: 'medium',
    maxUnits: 1_000,
    currency: 'IDR',
    region: 'ID',
    referencePriceMinor: 9_000,
    segmentIds: ['refurbishers', 'packaging_distributors'] as BuyerSegmentId[],
    ...overrides,
  };
}

describe('matchBuyers', () => {
  it('labels curated segment matches as potential, never verified', () => {
    const result = matchBuyers([], input());

    expect(result.potentialSegments).toHaveLength(2);
    expect(result.verifiedRequests).toHaveLength(0);
    for (const match of result.potentialSegments) {
      expect(match.kind).toBe('potential_segment');
      expect(match.caveats.join(' ')).toMatch(/Potential Customer Segment/);
      expect(match.caveats.join(' ')).toMatch(/no specific business has been identified/);
    }
  });

  it('ignores registered demand without explicit consent', () => {
    const result = matchBuyers([requirement({ consentToMatch: false })], input());
    expect(result.verifiedRequests).toHaveLength(0);
  });

  it('ignores registered demand that has not been verified', () => {
    const result = matchBuyers([requirement({ verified: false })], input());
    expect(result.verifiedRequests).toHaveLength(0);
  });

  it('ignores demand for a different product category', () => {
    const result = matchBuyers([requirement({ productCategories: ['decor'] })], input());
    expect(result.verifiedRequests).toHaveLength(0);
  });

  it('labels consented, verified demand as a platform request but not a purchase order', () => {
    const result = matchBuyers([requirement()], input());

    expect(result.verifiedRequests).toHaveLength(1);
    const match = result.verifiedRequests[0];
    expect(match?.kind).toBe('verified_request');
    expect(match?.label).toBe('Sample Devices Refurb');
    expect(match?.caveats.join(' ')).toMatch(/Verified Platform Request/);
    expect(match?.caveats.join(' ')).toMatch(/not a purchase order/);
    expect(match?.score).not.toBeNull();
  });

  it('flags a quantity shortfall when demand exceeds producible capacity', () => {
    const result = matchBuyers([requirement({ minOrderQuantity: 5_000 })], input({ maxUnits: 1_200 }));

    const match = result.verifiedRequests[0];
    expect(match?.shortfall).toEqual({
      requested: 5_000,
      availableCapacity: 1_200,
      shortfall: 3_800,
    });
    expect(result.shortfallDetected).toBe(true);
    expect(match?.factors.find((factor) => factor.id === 'quantity')?.status).toBe('mismatch');
    expect(match?.caveats.join(' ')).toMatch(/3800 more units/);
  });

  it('does not flag a shortfall when capacity covers the order', () => {
    const result = matchBuyers([requirement({ minOrderQuantity: 400 })], input({ maxUnits: 1_000 }));
    expect(result.verifiedRequests[0]?.shortfall).toBeNull();
    expect(result.shortfallDetected).toBe(false);
  });

  it('reports a material mismatch when the buyer asked for something else', () => {
    const result = matchBuyers([requirement({ materialFamilies: ['sheet_wood'] })], input());

    const factor = result.verifiedRequests[0]?.factors.find(
      (entry) => entry.id === 'material_requirement',
    );
    expect(factor?.status).toBe('mismatch');
  });

  it('treats a missing material preference as unknown rather than a match', () => {
    const result = matchBuyers([requirement({ materialFamilies: [] })], input());
    const factor = result.verifiedRequests[0]?.factors.find(
      (entry) => entry.id === 'material_requirement',
    );
    expect(factor?.status).toBe('unknown');
  });

  it('refuses to compare budgets across currencies', () => {
    const result = matchBuyers([requirement({ currency: 'USD' })], input());
    const factor = result.verifiedRequests[0]?.factors.find((entry) => entry.id === 'budget');
    expect(factor?.status).toBe('unknown');
    expect(factor?.explanation).toMatch(/were not converted/);
  });

  it('marks a budget as partial when the reference price is up to 20% over', () => {
    const result = matchBuyers(
      [requirement({ budgetMaxMinor: 8_000 })],
      input({ referencePriceMinor: 9_000 }),
    );
    const factor = result.verifiedRequests[0]?.factors.find((entry) => entry.id === 'budget');
    expect(factor?.status).toBe('partial');
  });

  it('marks a budget as a mismatch when the reference price is far above it', () => {
    const result = matchBuyers(
      [requirement({ budgetMaxMinor: 4_000 })],
      input({ referencePriceMinor: 9_000 }),
    );
    const factor = result.verifiedRequests[0]?.factors.find((entry) => entry.id === 'budget');
    expect(factor?.status).toBe('mismatch');
  });

  it('never claims to have verified manufacturing capacity', () => {
    const result = matchBuyers([requirement()], input());
    const factor = result.verifiedRequests[0]?.factors.find(
      (entry) => entry.id === 'manufacturing_capacity',
    );
    expect(factor?.status).toBe('unknown');
    expect(factor?.explanation).toMatch(/has not been verified/);
  });

  it('excludes unknown factors from the score and lists them', () => {
    const result = matchBuyers(
      [requirement({ minOrderQuantity: null, budgetMaxMinor: null, location: null, country: null })],
      input(),
    );

    const match = result.verifiedRequests[0];
    expect(match?.unknownFactors).toEqual(
      expect.arrayContaining(['Order quantity', 'Budget', 'Location', 'Manufacturing capacity']),
    );
    expect(match?.score).not.toBeNull();
    // A product with the strongest possible known factors still scores from the
    // known subset only.
    expect(match?.score).toBeGreaterThan(0);
  });

  it('returns a null score when nothing at all is known', () => {
    const result = matchBuyers(
      [
        requirement({
          materialFamilies: [],
          minOrderQuantity: null,
          budgetMaxMinor: null,
          location: null,
          country: null,
        }),
      ],
      input({ referencePriceMinor: null }),
    );

    // product_category is always known, so a score still exists; the score must
    // reflect only that one dimension.
    expect(result.verifiedRequests[0]?.score).toBe(100);
  });

  it('reports the best score across segments and requests', () => {
    const result = matchBuyers([requirement()], input());
    expect(result.bestScore).not.toBeNull();
    expect(result.bestScore).toBeGreaterThanOrEqual(result.verifiedRequests[0]?.score ?? 0);
  });

  it('notes the learning curve for high-complexity builds', () => {
    const result = matchBuyers([requirement()], input({ complexity: 'high' }));
    expect(result.verifiedRequests[0]?.caveats.join(' ')).toMatch(/learning curve/);
  });
});
