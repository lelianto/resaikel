/**
 * Buyer segments.
 *
 * These are *categories of buyer*, not companies. Nothing in this file asserts
 * that a specific business is actively purchasing; a segment is a hypothesis
 * about who a product is for, and the UI labels it as such
 * ("Potential Customer Segment"). The only thing that may be labelled
 * "Verified Platform Request" is a registered `buyer_requirements` record whose
 * owner has explicitly consented to be matched.
 */

export type BuyerKind = 'b2c' | 'b2b';

export const BUYER_SEGMENT_IDS = [
  // consumer
  'home_organisation',
  'eco_consumers',
  'students',
  'small_office',
  'hobbyists',
  // business
  'electronics_brands',
  'packaging_distributors',
  'refurbishers',
  'gift_companies',
  'local_retail',
  'food_beverage',
  'event_organisers',
  'sustainable_brands',
] as const;

export type BuyerSegmentId = (typeof BUYER_SEGMENT_IDS)[number];

export interface BuyerSegment {
  readonly id: BuyerSegmentId;
  readonly label: string;
  readonly kind: BuyerKind;
  readonly description: string;
  /** Plausible routes to market. Channels are channels - not customers. */
  readonly typicalChannels: readonly string[];
}

export const BUYER_SEGMENTS: Record<BuyerSegmentId, BuyerSegment> = {
  home_organisation: {
    id: 'home_organisation',
    label: 'Home organisation customers',
    kind: 'b2c',
    description:
      'Households buying storage, desk and drawer organisation products for everyday tidying.',
    typicalChannels: ['Online marketplace', 'Home & living retail', 'Social commerce'],
  },
  eco_consumers: {
    id: 'eco_consumers',
    label: 'Eco-conscious consumers',
    kind: 'b2c',
    description:
      'Consumers who actively prefer reclaimed or low-waste materials and will pay a modest premium.',
    typicalChannels: ['Sustainable goods marketplace', 'Direct-to-consumer store', 'Craft fairs'],
  },
  students: {
    id: 'students',
    label: 'Students',
    kind: 'b2c',
    description: 'Price-sensitive buyers furnishing small desks, dorm rooms and study spaces.',
    typicalChannels: ['Campus marketplaces', 'Online marketplace', 'Local stationery shops'],
  },
  small_office: {
    id: 'small_office',
    label: 'Small office owners',
    kind: 'b2c',
    description: 'Small teams buying desk accessories and reception organisation in modest volumes.',
    typicalChannels: ['Office supply retail', 'Direct enquiry', 'Online B2B marketplace'],
  },
  hobbyists: {
    id: 'hobbyists',
    label: 'Hobbyists and makers',
    kind: 'b2c',
    description: 'Craft, model-making and gaming enthusiasts buying storage and display pieces.',
    typicalChannels: ['Specialist online communities', 'Craft retail', 'Marketplace'],
  },
  electronics_brands: {
    id: 'electronics_brands',
    label: 'Small electronics brands',
    kind: 'b2b',
    description:
      'Brands shipping accessories, audio devices and small peripherals that need protective retail packaging.',
    typicalChannels: ['Direct procurement', 'Packaging supplier tender'],
  },
  packaging_distributors: {
    id: 'packaging_distributors',
    label: 'Packaging distributors',
    kind: 'b2b',
    description:
      'Resellers supplying protective packaging and inserts to small manufacturers and e-commerce sellers.',
    typicalChannels: ['Wholesale supply agreements'],
  },
  refurbishers: {
    id: 'refurbishers',
    label: 'Refurbished device sellers',
    kind: 'b2b',
    description:
      'Refurbished smartphone and laptop sellers needing protective inner packaging and inserts.',
    typicalChannels: ['Direct procurement', 'Marketplace seller services'],
  },
  gift_companies: {
    id: 'gift_companies',
    label: 'Gift and hamper companies',
    kind: 'b2b',
    description: 'Businesses assembling curated gift sets that need fitted inserts and dividers.',
    typicalChannels: ['Corporate gifting contracts', 'Seasonal procurement'],
  },
  local_retail: {
    id: 'local_retail',
    label: 'Local retailers',
    kind: 'b2b',
    description:
      'Independent shops needing counter and shelf display units for small-batch merchandise.',
    typicalChannels: ['Direct sale', 'Local business network'],
  },
  food_beverage: {
    id: 'food_beverage',
    label: 'Cafes and restaurants',
    kind: 'b2b',
    description: 'Food service businesses buying organisers, menu holders and service accessories.',
    typicalChannels: ['Direct sale', 'Hospitality supply'],
  },
  event_organisers: {
    id: 'event_organisers',
    label: 'Event organisers',
    kind: 'b2b',
    description:
      'Organisers of markets, conferences and weddings needing disposable or reusable display and packaging.',
    typicalChannels: ['Direct enquiry', 'Venue partnerships'],
  },
  sustainable_brands: {
    id: 'sustainable_brands',
    label: 'Sustainable product brands',
    kind: 'b2b',
    description:
      'Brands marketing a low-waste story that want visibly reclaimed packaging and display.',
    typicalChannels: ['Direct procurement', 'Sustainability partnership'],
  },
};

export function getSegment(id: BuyerSegmentId): BuyerSegment {
  return BUYER_SEGMENTS[id];
}

export const CONSUMER_SEGMENT_IDS: readonly BuyerSegmentId[] = BUYER_SEGMENT_IDS.filter(
  (id) => BUYER_SEGMENTS[id].kind === 'b2c',
);

export const BUSINESS_SEGMENT_IDS: readonly BuyerSegmentId[] = BUYER_SEGMENT_IDS.filter(
  (id) => BUYER_SEGMENTS[id].kind === 'b2b',
);

export function segmentsByKind(kind: BuyerKind): BuyerSegment[] {
  return BUYER_SEGMENT_IDS.filter((id) => BUYER_SEGMENTS[id].kind === kind).map(
    (id) => BUYER_SEGMENTS[id],
  );
}
