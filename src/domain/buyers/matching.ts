import type { BuyerKind, BuyerSegmentId } from './segments';
import { BUYER_SEGMENTS } from './segments';
import type { ProductCategory } from '../catalog/types';
import type { Complexity } from '../catalog/types';
import type { MaterialFamily } from '../materials/types';

/**
 * Buyer matching.
 *
 * Two distinct kinds of demand, never conflated:
 *
 *  - `potential_segment` — a *category* of buyer that could plausibly want this
 *    product. It is a hypothesis. The UI labels it "Potential Customer Segment".
 *  - `verified_request` — a registered `buyer_requirements` record whose owner
 *    explicitly consented to be matched. The UI labels it "Verified Platform
 *    Request". It is still an expression of interest, not a purchase order.
 *
 * Nothing in this file invents a company, and no external brand is ever
 * presented as an active buyer.
 */

export type DemandKind = 'potential_segment' | 'verified_request';

export const DEMAND_KIND_LABELS: Record<DemandKind, string> = {
  potential_segment: 'Potential Customer Segment',
  verified_request: 'Verified Platform Request',
};

export type MatchFactorId =
  | 'product_category'
  | 'material_requirement'
  | 'quantity'
  | 'budget'
  | 'location'
  | 'manufacturing_capacity';

export type MatchFactorStatus = 'match' | 'partial' | 'mismatch' | 'unknown';

export interface MatchFactor {
  readonly id: MatchFactorId;
  readonly label: string;
  readonly status: MatchFactorStatus;
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
}

export interface QuantityShortfall {
  readonly requested: number;
  readonly availableCapacity: number;
  readonly shortfall: number;
}

export interface BuyerMatch {
  readonly kind: DemandKind;
  readonly label: string;
  readonly segmentId: BuyerSegmentId | null;
  readonly requirementId: string | null;
  readonly buyerKind: BuyerKind | null;
  readonly score: number | null;
  readonly factors: readonly MatchFactor[];
  readonly unknownFactors: readonly string[];
  readonly shortfall: QuantityShortfall | null;
  readonly caveats: readonly string[];
}

export interface BuyerRequirement {
  readonly id: string;
  readonly buyerKind: BuyerKind;
  readonly businessName: string | null;
  readonly industry: string | null;
  readonly location: string | null;
  readonly country: string | null;
  readonly productCategories: readonly ProductCategory[];
  readonly materialFamilies: readonly MaterialFamily[];
  readonly minOrderQuantity: number | null;
  readonly budgetMinMinor: number | null;
  readonly budgetMaxMinor: number | null;
  readonly currency: string;
  readonly capacityNote: string | null;
  /** Explicit consent to be matched. Without it, the record is not used at all. */
  readonly consentToMatch: boolean;
  readonly verified: boolean;
}

export const FACTOR_WEIGHTS: Record<MatchFactorId, number> = {
  product_category: 0.25,
  material_requirement: 0.2,
  quantity: 0.2,
  budget: 0.15,
  location: 0.1,
  manufacturing_capacity: 0.1,
};

export const FACTOR_LABELS: Record<MatchFactorId, string> = {
  product_category: 'Product category',
  material_requirement: 'Material requirement',
  quantity: 'Order quantity',
  budget: 'Budget',
  location: 'Location',
  manufacturing_capacity: 'Manufacturing capacity',
};

const STATUS_SCORES: Record<MatchFactorStatus, number | null> = {
  match: 1,
  partial: 0.5,
  mismatch: 0,
  unknown: null,
};

export interface MatchInput {
  readonly templateId: string;
  readonly category: ProductCategory;
  readonly materialFamilies: readonly MaterialFamily[];
  readonly materialFamily: MaterialFamily;
  readonly complexity: Complexity;
  readonly maxUnits: number;
  readonly currency: string;
  readonly region: string | null;
  readonly referencePriceMinor: number | null;
  /** Curated segment ids from the product template. */
  readonly segmentIds: readonly BuyerSegmentId[];
}

function factor(
  id: MatchFactorId,
  status: MatchFactorStatus,
  explanation: string,
): MatchFactor {
  return {
    id,
    label: FACTOR_LABELS[id],
    status,
    score: STATUS_SCORES[status] ?? 0,
    weight: FACTOR_WEIGHTS[id],
    explanation,
  };
}

function combinedScore(factors: readonly MatchFactor[]): {
  score: number | null;
  unknown: string[];
} {
  const known = factors.filter((entry) => entry.status !== 'unknown');
  const unknown = factors
    .filter((entry) => entry.status === 'unknown')
    .map((entry) => entry.label);

  if (known.length === 0) return { score: null, unknown };

  const weightSum = known.reduce((total, entry) => total + entry.weight, 0);
  if (weightSum <= 0) return { score: null, unknown };

  const weighted = known.reduce((total, entry) => total + entry.score * entry.weight, 0);
  return { score: Math.round((weighted / weightSum) * 100), unknown };
}

/** Segment-level hypotheses. No company is named and no purchase is implied. */
export function matchPotentialSegments(input: MatchInput): BuyerMatch[] {
  return input.segmentIds.map((segmentId) => {
    const segment = BUYER_SEGMENTS[segmentId];

    const materialScore = segment.kind === 'b2b' ? 0.9 : 0.75;

    const factors: MatchFactor[] = [
      factor(
        'product_category',
        'match',
        `${segment.label} is a curated target segment for this product category in the catalogue.`,
      ),
      factor(
        'material_requirement',
        'partial',
        segment.kind === 'b2b'
          ? 'Business buyers frequently specify reclaimed-content and grade requirements that this ' +
            'material has not been tested against.'
          : 'Consumers rarely specify a material grade, but appearance and finish defects matter at ' +
            `this price point (assumed fit ${Math.round(materialScore * 100)}%).`,
      ),
    ];

    const { score, unknown } = combinedScore(factors);

    return {
      kind: 'potential_segment' as const,
      label: segment.label,
      segmentId,
      requirementId: null,
      buyerKind: segment.kind,
      score,
      factors,
      unknownFactors: unknown,
      shortfall: null,
      caveats: [
        'Potential Customer Segment. This is a category of buyer the product could suit. It is ' +
          'not a committed purchaser and no specific business has been identified.',
        `Typical channels: ${segment.typicalChannels.join(', ')}.`,
        'Category fit only. Demand has not been evidenced for this product.',
      ],
    };
  });
}

/** Registered, consented demand. The only thing labelled as verified. */
export function matchRegisteredDemand(
  requirements: readonly BuyerRequirement[],
  input: MatchInput,
): BuyerMatch[] {
  return requirements
    .filter((requirement) => requirement.consentToMatch && requirement.verified)
    .filter((requirement) => requirement.productCategories.includes(input.category))
    .map((requirement) => {
      const factors: MatchFactor[] = [];

      factors.push(
        factor(
          'product_category',
          'match',
          `The buyer registered demand for ${requirement.productCategories.join(', ')}.`,
        ),
      );

      if (requirement.materialFamilies.length === 0) {
        factors.push(
          factor(
            'material_requirement',
            'unknown',
            'The buyer did not state a material preference, so reclaimed content cannot be checked.',
          ),
        );
      } else if (requirement.materialFamilies.includes(input.materialFamily)) {
        factors.push(
          factor(
            'material_requirement',
            'match',
            `This product uses ${input.materialFamily}, which the buyer accepts.`,
          ),
        );
      } else {
        factors.push(
          factor(
            'material_requirement',
            'mismatch',
            `The buyer asked for ${requirement.materialFamilies.join(', ')}, which this product does ` +
              'not use.',
          ),
        );
      }

      let shortfall: QuantityShortfall | null = null;
      if (requirement.minOrderQuantity === null) {
        factors.push(
          factor('quantity', 'unknown', 'The buyer did not state a minimum order quantity.'),
        );
      } else if (requirement.minOrderQuantity <= input.maxUnits) {
        factors.push(
          factor(
            'quantity',
            'match',
            `The buyer needs ${requirement.minOrderQuantity} units and ${input.maxUnits} can be ` +
              'produced from the available material.',
          ),
        );
      } else {
        const gap = requirement.minOrderQuantity - input.maxUnits;
        shortfall = {
          requested: requirement.minOrderQuantity,
          availableCapacity: input.maxUnits,
          shortfall: gap,
        };
        factors.push(
          factor(
            'quantity',
            'mismatch',
            `The buyer needs ${requirement.minOrderQuantity} units but only ${input.maxUnits} can ` +
              `be produced from the available material: a shortfall of ${gap} units.`,
          ),
        );
      }

      if (requirement.budgetMaxMinor === null || input.referencePriceMinor === null) {
        factors.push(
          factor(
            'budget',
            'unknown',
            'A budget comparison needs both a buyer budget and a market reference price.',
          ),
        );
      } else if (requirement.currency !== input.currency) {
        factors.push(
          factor(
            'budget',
            'unknown',
            `The buyer budget is in ${requirement.currency} and this estimate is in ` +
              `${input.currency}; the two were not converted.`,
          ),
        );
      } else if (input.referencePriceMinor <= requirement.budgetMaxMinor) {
        factors.push(
          factor(
            'budget',
            'match',
            `The reference price of ${input.referencePriceMinor} is within the buyer's stated maximum ` +
              `of ${requirement.budgetMaxMinor}.`,
          ),
        );
      } else if (input.referencePriceMinor <= Math.round(requirement.budgetMaxMinor * 1.2)) {
        factors.push(
          factor(
            'budget',
            'partial',
            `The reference price of ${input.referencePriceMinor} is up to 20% above the buyer's ` +
              `stated maximum of ${requirement.budgetMaxMinor}.`,
          ),
        );
      } else {
        factors.push(
          factor(
            'budget',
            'mismatch',
            `The reference price of ${input.referencePriceMinor} exceeds the buyer's stated maximum ` +
              `of ${requirement.budgetMaxMinor}.`,
          ),
        );
      }

      if (!requirement.location && !requirement.country) {
        factors.push(factor('location', 'unknown', 'The buyer did not state a location.'));
      } else if (input.region && requirement.country === input.region) {
        factors.push(
          factor('location', 'match', `Both the buyer and the producer are in ${input.region}.`),
        );
      } else {
        factors.push(
          factor(
            'location',
            'partial',
            `The buyer is in ${requirement.location ?? requirement.country} and this estimate assumes ` +
              `${input.region ?? 'an unspecified region'}. Shipping has not been quoted.`,
          ),
        );
      }

      factors.push(
        factor(
          'manufacturing_capacity',
          'unknown',
          requirement.capacityNote
            ? `The buyer mentioned: "${requirement.capacityNote}". Production capacity has not been ` +
              'verified against it.'
            : 'Production capacity for this order has not been verified against any workshop.',
        ),
      );

      const { score, unknown } = combinedScore(factors);

      const caveats = [
        'Verified Platform Request: this buyer registered demand and consented to be matched. It is ' +
          'an expression of interest, not a purchase order.',
      ];
      if (shortfall) {
        caveats.push(
          `This order needs ${shortfall.shortfall} more units than the available material can ` +
            'produce. Additional material or a second supplier would be required.',
        );
      }
      if (input.complexity === 'high') {
        caveats.push(
          'This is a high-complexity build, so the delivery date should assume a learning curve.',
        );
      }

      return {
        kind: 'verified_request' as const,
        label: requirement.businessName ?? 'Registered buyer',
        segmentId: null,
        requirementId: requirement.id,
        buyerKind: requirement.buyerKind,
        score,
        factors,
        unknownFactors: unknown,
        shortfall,
        caveats,
      };
    });
}

export interface BuyerMatchSet {
  readonly potentialSegments: readonly BuyerMatch[];
  readonly verifiedRequests: readonly BuyerMatch[];
  readonly bestScore: number | null;
  readonly shortfallDetected: boolean;
}

export function matchBuyers(
  requirements: readonly BuyerRequirement[],
  input: MatchInput,
): BuyerMatchSet {
  const potentialSegments = matchPotentialSegments(input);
  const verifiedRequests = matchRegisteredDemand(requirements, input);

  const scores = [...potentialSegments, ...verifiedRequests]
    .map((match) => match.score)
    .filter((score): score is number => score !== null);

  return {
    potentialSegments,
    verifiedRequests,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    shortfallDetected: verifiedRequests.some((match) => match.shortfall !== null),
  };
}
