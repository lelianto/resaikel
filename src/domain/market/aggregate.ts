import type { ProductCategory } from '../catalog/types';
import { daysBetween } from '../common';
import {
  EVIDENCE_QUALITY_LABELS,
  EVIDENCE_SOURCE_LABELS,
  EVIDENCE_WEIGHT_TENTHS,
  INSUFFICIENT_MARKET_DATA,
  type EvidenceQuality,
  type MarketAssessment,
  type MarketEvidence,
  type PriceBands,
} from './types';

/**
 * Nearest-rank percentile on an ascending array. Deterministic, integral, and
 * never interpolates between two observations - interpolation would invent a
 * price that nobody ever quoted.
 */
function percentile(sortedAscending: readonly number[], fraction: number): number {
  if (sortedAscending.length === 0) return 0;
  const rank = Math.ceil(fraction * sortedAscending.length);
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
  return sortedAscending[index] ?? 0;
}

function median(sortedAscending: readonly number[]): number {
  return percentile(sortedAscending, 0.5);
}

export interface AssessMarketOptions {
  readonly category: ProductCategory;
  readonly currency: string;
  readonly region?: string | null;
  /** Injected so the aggregation stays pure and testable. */
  readonly now?: string;
}

/**
 * Aggregates raw evidence rows into price bands plus an explicit quality and
 * freshness signal. Returns `bands: null` when there is nothing to stand on.
 */
export function assessMarket(
  rows: readonly MarketEvidence[],
  options: AssessMarketOptions,
): MarketAssessment {
  const now = options.now ?? new Date().toISOString();
  const requestedRegion = options.region ?? null;

  const forCategory = rows.filter((row) => row.productCategory === options.category);

  const sameCurrency = forCategory.filter((row) => row.currency === options.currency);
  const excludedForCurrency = forCategory.length - sameCurrency.length;

  let usedRegionFallback = false;
  let scoped = sameCurrency;
  if (requestedRegion) {
    const inRegion = sameCurrency.filter((row) => row.region === requestedRegion);
    if (inRegion.length > 0) {
      scoped = inRegion;
    } else if (sameCurrency.length > 0) {
      scoped = sameCurrency;
      usedRegionFallback = true;
    }
  }

  const caveats: string[] = [];
  const isSampleData = scoped.some((row) => row.isSampleData);

  if (scoped.length === 0) {
    if (excludedForCurrency > 0) {
      caveats.push(
        `${excludedForCurrency} reference row(s) exist for this product category but in a ` +
          `different currency, so they were not converted or used.`,
      );
    }
    return {
      productCategory: options.category,
      region: requestedRegion,
      currency: options.currency,
      bands: null,
      quality: 'insufficient',
      freshnessDays: null,
      evidence: [],
      excludedForCurrency,
      usedRegionFallback: false,
      basis:
        `No ${EVIDENCE_SOURCE_LABELS.verified_transaction.toLowerCase()} or listing evidence is ` +
        `recorded for this product category in ${options.currency}. No price is estimated.`,
      caveats,
      isSampleData: false,
    };
  }

  const sorted = [...scoped].map((row) => row.priceMinor).sort((a, b) => a - b);
  const bands: PriceBands = {
    currency: options.currency,
    lowMinor: percentile(sorted, 0.25),
    referenceMinor: median(sorted),
    highMinor: percentile(sorted, 0.75),
    sampleSize: sorted.length,
  };

  const weightedTenths = scoped.reduce(
    (total, row) => total + EVIDENCE_WEIGHT_TENTHS[row.sourceType],
    0,
  );

  let quality: EvidenceQuality;
  if (scoped.length >= 4 && weightedTenths >= 32) quality = 'strong';
  else if (scoped.length >= 2 && weightedTenths >= 16) quality = 'moderate';
  else quality = 'weak';

  const newest = scoped
    .map((row) => row.observedAt)
    .sort()
    .at(-1);

  const freshnessDays = newest ? daysBetween(`${newest}T00:00:00.000Z`, now) : null;

  if (scoped.some((row) => row.sourceType === 'public_listing')) {
    caveats.push(
      'Public listing prices are asking prices. They show what sellers hope to receive, not what ' +
        'buyers paid, and do not by themselves prove that demand exists.',
    );
  }
  if (scoped.some((row) => row.sourceType === 'hypothetical' || row.sourceType === 'manual_estimate')) {
    caveats.push(
      'This range includes manual estimates or hypothetical assumptions rather than observed ' +
        'transactions. Treat it as a starting point for a conversation, not as a benchmark.',
    );
  }
  if (usedRegionFallback && requestedRegion) {
    caveats.push(
      `No evidence was recorded for ${requestedRegion} specifically, so rows from other markets ` +
        'were used. Local prices may differ.',
    );
  }
  if (excludedForCurrency > 0) {
    caveats.push(
      `${excludedForCurrency} row(s) in another currency were excluded rather than converted, ` +
        'because a converted estimate would not be a real observation.',
    );
  }
  if (isSampleData) {
    caveats.push(
      'Sample data. These reference figures are illustrative and were not collected from real ' +
        'transactions.',
    );
  }
  if (freshnessDays !== null && freshnessDays > 365) {
    caveats.push(
      `The freshest observation is ${freshnessDays} days old. Prices in this category may have ` +
        'moved.',
    );
  }
  if (bands.highMinor === bands.lowMinor) {
    caveats.push(
      `Every observation shares the same price, so the range is a single point. That usually means ` +
        `very few data points (${bands.sampleSize}), not a stable market.`,
    );
  }

  const sourceBreakdown = summariseSources(scoped);

  return {
    productCategory: options.category,
    region: requestedRegion,
    currency: options.currency,
    bands,
    quality,
    freshnessDays,
    evidence: [...scoped].sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1)),
    excludedForCurrency,
    usedRegionFallback,
    basis:
      `${EVIDENCE_QUALITY_LABELS[quality]} from ${bands.sampleSize} observation(s) ` +
      `(${sourceBreakdown}). Reference price taken as the median; low and high are the 25th and ` +
      '75th percentiles of the observed prices.',
    caveats,
    isSampleData,
  };
}

function summariseSources(rows: readonly MarketEvidence[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = EVIDENCE_SOURCE_LABELS[row.sourceType];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([label, count]) => `${count} ${label.toLowerCase()}`)
    .join(', ');
}

/** Formats a price band for display, or returns the insufficient-data label. */
export function formatBands(assessment: MarketAssessment): string {
  if (!assessment.bands) return INSUFFICIENT_MARKET_DATA;
  return `${assessment.bands.lowMinor}–${assessment.bands.highMinor} ${assessment.currency} (minor units)`;
}
