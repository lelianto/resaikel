import type { MarketEvidence } from '../market/types';

/**
 * Curated market reference data.
 *
 * This is the MVP's evidence base: a small, hand-assembled set of observations,
 * every row of which is flagged `isSampleData`. It is deliberately mixed in
 * quality — listing prices, one quotation, one manual estimate — so the product's
 * evidence-quality and caveat logic is exercised honestly rather than being shown
 * only at its best.
 *
 * resaikel does not scrape marketplaces. Nothing here was collected
 * automatically, and no row is presented as a completed transaction unless it is
 * labelled as one.
 */

const OBSERVED = '2025-05-18';
const OBSERVED_EARLIER = '2025-02-04';
const OBSERVED_OLD = '2023-11-20';

export const SAMPLE_MARKET_EVIDENCE: readonly MarketEvidence[] = [
  // ------------------------------------------------------------- packaging
  {
    id: 'ev-packaging-1',
    productCategory: 'packaging',
    description: 'Small corrugated shipping box, single wall, ~200 x 150 x 100 mm',
    priceMinor: 4_200,
    currency: 'IDR',
    market: 'Indonesia — e-commerce packaging supplier',
    region: 'ID',
    source: 'Supplier quotation supplied by the seed dataset',
    sourceType: 'actual_quotation',
    observedAt: OBSERVED,
    note: 'Quoted at 500 units. Volume pricing would be lower.',
    isSampleData: true,
  },
  {
    id: 'ev-packaging-2',
    productCategory: 'packaging',
    description: 'Folded cardboard insert with four risers',
    priceMinor: 6_500,
    currency: 'IDR',
    market: 'Indonesia — small brand',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED,
    note: 'Asking price, not an observed sale.',
    isSampleData: true,
  },
  {
    id: 'ev-packaging-3',
    productCategory: 'packaging',
    description: 'Interlocking dividers, set of five strips',
    priceMinor: 3_100,
    currency: 'IDR',
    market: 'Indonesia — packaging distributor',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED_EARLIER,
    note: null,
    isSampleData: true,
  },
  {
    id: 'ev-packaging-4',
    productCategory: 'packaging',
    description: 'Retail-ready printed mailer box',
    priceMinor: 8_900,
    currency: 'IDR',
    market: 'Indonesia — sustainable packaging brand',
    region: 'ID',
    source: 'Manual estimate by the seed author',
    sourceType: 'manual_estimate',
    observedAt: OBSERVED,
    note: 'Includes printing, which the catalogue templates do not.',
    isSampleData: true,
  },

  // ----------------------------------------------------- desk organisation
  {
    id: 'ev-desk-1',
    productCategory: 'desk_organisation',
    description: 'Wooden desk organiser tray, 240 x 120 mm',
    priceMinor: 85_000,
    currency: 'IDR',
    market: 'Indonesia — craft marketplace',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED,
    note: null,
    isSampleData: true,
  },
  {
    id: 'ev-desk-2',
    productCategory: 'desk_organisation',
    description: 'Plywood phone stand',
    priceMinor: 45_000,
    currency: 'IDR',
    market: 'Indonesia — direct-to-consumer maker',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED,
    note: null,
    isSampleData: true,
  },
  {
    id: 'ev-desk-3',
    productCategory: 'desk_organisation',
    description: 'Corrugated desk organiser',
    priceMinor: 38_000,
    currency: 'IDR',
    market: 'Indonesia — stationery retail',
    region: 'ID',
    source: 'Manual estimate by the seed author',
    sourceType: 'manual_estimate',
    observedAt: OBSERVED_EARLIER,
    note: null,
    isSampleData: true,
  },
  {
    id: 'ev-desk-4',
    productCategory: 'desk_organisation',
    description: 'Custom desk tray, made to order',
    priceMinor: 120_000,
    currency: 'IDR',
    market: 'Indonesia — bespoke furniture workshop',
    region: 'ID',
    source: 'Quotation supplied by the seed dataset',
    sourceType: 'actual_quotation',
    observedAt: OBSERVED,
    note: 'Bespoke, so it carries a craftsmanship premium.',
    isSampleData: true,
  },

  // ---------------------------------------------------------------- display
  {
    id: 'ev-display-1',
    productCategory: 'display',
    description: 'Three-tier counter display stand',
    priceMinor: 210_000,
    currency: 'IDR',
    market: 'Indonesia — retail fixtures supplier',
    region: 'ID',
    source: 'Quotation supplied by the seed dataset',
    sourceType: 'actual_quotation',
    observedAt: OBSERVED,
    note: null,
    isSampleData: true,
  },
  {
    id: 'ev-display-2',
    productCategory: 'display',
    description: 'Corrugated retail display stand, printed',
    priceMinor: 165_000,
    currency: 'IDR',
    market: 'Indonesia — packaging converter',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED,
    note: 'Printed, which the catalogue templates do not provide.',
    isSampleData: true,
  },
  {
    id: 'ev-display-3',
    productCategory: 'display',
    description: 'Small wall-mounted display shelf',
    priceMinor: 320_000,
    currency: 'IDR',
    market: 'Indonesia — home goods retail',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED_EARLIER,
    note: null,
    isSampleData: true,
  },

  // ------------------------------------------------------------------ decor
  {
    id: 'ev-decor-1',
    productCategory: 'decor',
    description: 'Set of four wooden coasters with holder',
    priceMinor: 62_000,
    currency: 'IDR',
    market: 'Indonesia — gift retail',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED,
    note: null,
    isSampleData: true,
  },
  {
    id: 'ev-decor-2',
    productCategory: 'decor',
    description: 'Decorative bookend pair, solid wood',
    priceMinor: 145_000,
    currency: 'IDR',
    market: 'Indonesia — furniture retail',
    region: 'ID',
    source: 'Manual estimate by the seed author',
    sourceType: 'manual_estimate',
    observedAt: OBSERVED_OLD,
    note: 'Old estimate. Treat with caution.',
    isSampleData: true,
  },

  // ---------------------------------------------------------------- storage
  {
    id: 'ev-storage-1',
    productCategory: 'storage',
    description: 'Modular storage crate, flat packed',
    priceMinor: 95_000,
    currency: 'IDR',
    market: 'Indonesia — home organisation retail',
    region: 'ID',
    source: 'Public product listing',
    sourceType: 'public_listing',
    observedAt: OBSERVED,
    note: null,
    isSampleData: true,
  },
];

export const SAMPLE_MARKET_EVIDENCE_BY_ID: Readonly<Record<string, MarketEvidence>> =
  Object.fromEntries(SAMPLE_MARKET_EVIDENCE.map((row) => [row.id, row]));
