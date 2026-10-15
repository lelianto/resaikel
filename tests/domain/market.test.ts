import { describe, expect, it } from 'vitest';

import { assessMarket } from '@/domain/market/aggregate';
import type { MarketEvidence } from '@/domain/market/types';

function row(overrides: Partial<MarketEvidence> & { priceMinor: number }): MarketEvidence {
  return {
    id: `ev-${overrides.priceMinor}-${overrides.id ?? ''}`,
    productCategory: 'packaging',
    description: 'Small shipping box',
    currency: 'IDR',
    market: 'Indonesia',
    region: 'ID',
    source: 'Sample reference',
    sourceType: 'actual_quotation',
    observedAt: '2025-06-01',
    note: null,
    isSampleData: true,
    ...overrides,
  };
}

const NOW = '2025-06-11T00:00:00.000Z';

describe('assessMarket', () => {
  it('reports insufficient data rather than inventing a price', () => {
    const assessment = assessMarket([], {
      category: 'packaging',
      currency: 'IDR',
      now: NOW,
    });

    expect(assessment.bands).toBeNull();
    expect(assessment.quality).toBe('insufficient');
    expect(assessment.freshnessDays).toBeNull();
    expect(assessment.evidence).toHaveLength(0);
    expect(assessment.basis).toMatch(/No .*evidence is recorded/);
  });

  it('derives low, reference and high from observed prices without interpolating', () => {
    const assessment = assessMarket(
      [
        row({ priceMinor: 400, id: 'd' }),
        row({ priceMinor: 100, id: 'a' }),
        row({ priceMinor: 300, id: 'c' }),
        row({ priceMinor: 200, id: 'b' }),
      ],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.bands).toEqual({
      currency: 'IDR',
      lowMinor: 100,
      referenceMinor: 200,
      highMinor: 300,
      sampleSize: 4,
    });
    expect(assessment.quality).toBe('strong');
    expect(assessment.freshnessDays).toBe(10);
  });

  it('downgrades quality when there are few observations', () => {
    const one = assessMarket([row({ priceMinor: 500 })], {
      category: 'packaging',
      currency: 'IDR',
      now: NOW,
    });
    expect(one.quality).toBe('weak');

    const two = assessMarket([row({ priceMinor: 500 }), row({ priceMinor: 600 })], {
      category: 'packaging',
      currency: 'IDR',
      now: NOW,
    });
    expect(two.quality).toBe('moderate');
  });

  it('treats listing prices as weak evidence and says so', () => {
    const assessment = assessMarket(
      [
        row({ priceMinor: 500, sourceType: 'public_listing' }),
        row({ priceMinor: 600, sourceType: 'public_listing' }),
      ],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.quality).toBe('weak');
    expect(assessment.caveats.join(' ')).toMatch(/asking prices/i);
    expect(assessment.caveats.join(' ')).toMatch(/do not by themselves prove that demand exists/i);
  });

  it('flags estimates and hypotheticals as not being transactions', () => {
    const assessment = assessMarket(
      [row({ priceMinor: 500, sourceType: 'hypothetical' }), row({ priceMinor: 600 })],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.caveats.join(' ')).toMatch(/hypothetical assumptions/i);
  });

  it('excludes other currencies instead of converting them', () => {
    const assessment = assessMarket(
      [row({ priceMinor: 500 }), row({ priceMinor: 900, currency: 'USD', id: 'usd' })],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.bands?.sampleSize).toBe(1);
    expect(assessment.excludedForCurrency).toBe(1);
    expect(assessment.caveats.join(' ')).toMatch(/excluded rather than converted/);
  });

  it('falls back to other regions and says that it did', () => {
    const assessment = assessMarket([row({ priceMinor: 500, region: 'SG' })], {
      category: 'packaging',
      currency: 'IDR',
      region: 'ID',
      now: NOW,
    });

    expect(assessment.usedRegionFallback).toBe(true);
    expect(assessment.caveats.join(' ')).toMatch(/No evidence was recorded for ID/);
  });

  it('prefers the requested region when evidence exists for it', () => {
    const assessment = assessMarket(
      [
        row({ priceMinor: 1000, region: 'ID', id: 'id' }),
        row({ priceMinor: 2000, region: 'SG', id: 'sg' }),
      ],
      { category: 'packaging', currency: 'IDR', region: 'ID', now: NOW },
    );

    expect(assessment.bands?.sampleSize).toBe(1);
    expect(assessment.usedRegionFallback).toBe(false);
  });

  it('only uses evidence for the requested product category', () => {
    const assessment = assessMarket(
      [
        row({ priceMinor: 500, productCategory: 'packaging' }),
        row({ priceMinor: 9000, productCategory: 'decor', id: 'decor' }),
      ],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.bands?.sampleSize).toBe(1);
    expect(assessment.bands?.referenceMinor).toBe(500);
  });

  it('warns when every observation shares one price', () => {
    const assessment = assessMarket(
      [
        row({ priceMinor: 500, id: 'a' }),
        row({ priceMinor: 500, id: 'b' }),
        row({ priceMinor: 500, id: 'c' }),
        row({ priceMinor: 500, id: 'd' }),
      ],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.caveats.join(' ')).toMatch(/single point/);
  });

  it('warns about stale evidence', () => {
    const assessment = assessMarket([row({ priceMinor: 500, observedAt: '2022-01-01' })], {
      category: 'packaging',
      currency: 'IDR',
      now: NOW,
    });

    expect(assessment.caveats.join(' ')).toMatch(/days old/);
  });

  it('always discloses sample data', () => {
    const assessment = assessMarket([row({ priceMinor: 500, isSampleData: true })], {
      category: 'packaging',
      currency: 'IDR',
      now: NOW,
    });

    expect(assessment.isSampleData).toBe(true);
    expect(assessment.caveats.join(' ')).toMatch(/Sample data/);
  });

  it('states how many observations support the range', () => {
    const assessment = assessMarket(
      [row({ priceMinor: 500 }), row({ priceMinor: 600 }), row({ priceMinor: 700 })],
      { category: 'packaging', currency: 'IDR', now: NOW },
    );

    expect(assessment.basis).toMatch(/3 observation/);
    expect(assessment.basis).toMatch(/median/);
  });
});
