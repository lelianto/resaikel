import type { ProductCategory } from '../catalog/types';
import type { IsoDate } from '../common';

/**
 * Market evidence.
 *
 * The single most important rule in this module: a price is only ever reported
 * alongside how it was observed. resaikel has no transactional data of its own,
 * so the MVP ships a curated reference set that is explicitly labelled as sample
 * data, and an empty evidence set results in "Insufficient Market Data" rather
 * than an invented price.
 */

export const EVIDENCE_SOURCE_TYPES = [
  'verified_transaction',
  'actual_quotation',
  'public_listing',
  'manual_estimate',
  'hypothetical',
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  verified_transaction: 'Verified transaction',
  actual_quotation: 'Actual quotation',
  public_listing: 'Public listing price',
  manual_estimate: 'Manual market estimate',
  hypothetical: 'Hypothetical assumption',
};

/**
 * How much weight a source type contributes to evidence quality, in tenths, so
 * the arithmetic stays integral. A listing price is weak evidence of demand; a
 * completed transaction is strong evidence of a real price.
 */
export const EVIDENCE_WEIGHT_TENTHS: Record<EvidenceSourceType, number> = {
  verified_transaction: 12,
  actual_quotation: 10,
  public_listing: 5,
  manual_estimate: 3,
  hypothetical: 1,
};

export interface MarketEvidence {
  readonly id: string;
  readonly productCategory: ProductCategory;
  readonly description: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly market: string;
  readonly region: string | null;
  readonly source: string;
  readonly sourceType: EvidenceSourceType;
  readonly observedAt: IsoDate;
  readonly note: string | null;
  readonly isSampleData: boolean;
}

export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'insufficient';

export const EVIDENCE_QUALITY_LABELS: Record<EvidenceQuality, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  weak: 'Weak evidence',
  insufficient: 'Insufficient market data',
};

export const EVIDENCE_QUALITY_TONE: Record<
  EvidenceQuality,
  'success' | 'primary' | 'warning' | 'neutral'
> = {
  strong: 'success',
  moderate: 'primary',
  weak: 'warning',
  insufficient: 'neutral',
};

export interface PriceBands {
  readonly currency: string;
  readonly lowMinor: number;
  readonly referenceMinor: number;
  readonly highMinor: number;
  readonly sampleSize: number;
}

export interface MarketAssessment {
  readonly productCategory: ProductCategory;
  readonly region: string | null;
  readonly currency: string;
  /** `null` whenever there is not enough evidence to state a price. */
  readonly bands: PriceBands | null;
  readonly quality: EvidenceQuality;
  readonly freshnessDays: number | null;
  readonly evidence: readonly MarketEvidence[];
  readonly excludedForCurrency: number;
  readonly usedRegionFallback: boolean;
  readonly basis: string;
  readonly caveats: readonly string[];
  readonly isSampleData: boolean;
}

export const INSUFFICIENT_MARKET_DATA = 'Insufficient Market Data';

export function hasUsablePrice(assessment: MarketAssessment): boolean {
  return assessment.bands !== null;
}
