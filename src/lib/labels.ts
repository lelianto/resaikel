/**
 * Presentation-only labels.
 *
 * Kept here rather than inline so the same phrasing is used everywhere, and so a
 * change of wording does not require hunting through components.
 */

export const SOURCE_LABELS = {
  marketEvidenceSourceCount: 'five sample reference categories',
} as const;

export const KIND_LABELS = {
  potential_segment: 'Potential Customer Segment',
  verified_request: 'Verified Platform Request',
} as const;

export const NOTICE_LABELS = {
  insufficientMarketData: 'Insufficient Market Data',
  conceptOnly: 'Concept Only — Manufacturing Validation Required',
  notCertified: 'Not a production drawing and not a safety certification',
} as const;
