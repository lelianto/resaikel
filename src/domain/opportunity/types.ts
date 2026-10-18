import type { ProductCategory, ProductValidationLevel } from '../catalog/types';
import type { BaseDocument, IsoDateTime } from '../common';
import type { CostEstimate } from '../cost/types';
import type { BuyerMatch } from '../buyers/matching';
import type { FeasibilityResult, FeasibilityStatus } from '../feasibility/types';
import type { EvidenceQuality } from '../market/types';
import type { MaterialCategory, MaterialFamily } from '../materials/types';
import type { RankingDimensionId } from '../ranking/rank';

/**
 * A product opportunity: one template or concept, evaluated against one material.
 *
 * The heavy engine outputs (feasibility, cost) live in their own collections and
 * are keyed by the opportunity id, so they can be re-read and versioned
 * independently. The opportunity document itself carries only the denormalised
 * numbers the comparison screen needs, so that screen is a single query.
 */

export interface OpportunityRanking {
  readonly rank: number;
  readonly score: number | null;
  readonly gatesPassed: boolean;
  readonly gateReasons: readonly string[];
  readonly unknownDimensions: readonly RankingDimensionId[];
  readonly dimensions: readonly {
    readonly id: RankingDimensionId;
    readonly label: string;
    readonly value: number | null;
    readonly weight: number;
    readonly explanation: string;
  }[];
  readonly summary: string;
}

export interface OpportunityMaterialSnapshot {
  readonly title: string;
  readonly category: MaterialCategory;
  readonly family: MaterialFamily;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number | null;
  readonly sheetCount: number;
  readonly condition: string;
}

export interface OpportunitySummaryNumbers {
  readonly maxUnits: number;
  readonly unitCostMinor: number | null;
  readonly currency: string;
  readonly minViablePriceMinor: number | null;
  readonly referencePriceMinor: number | null;
  readonly contributionPerUnitMinor: number | null;
  readonly contributionMarginBps: number | null;
  readonly wastePercent: number | null;
  readonly evidenceQuality: EvidenceQuality;
  readonly bestBuyerScore: number | null;
  readonly targetSegments: readonly string[];
  readonly shortfallDetected: boolean;
}

export interface OpportunityDocument extends BaseDocument {
  readonly materialId: string;
  readonly materialSnapshot: OpportunityMaterialSnapshot;
  readonly kind: 'template' | 'concept';
  readonly templateId: string | null;
  readonly productName: string;
  readonly category: ProductCategory;
  readonly validationLevel: ProductValidationLevel;
  readonly concept: {
    readonly name: string;
    readonly description: string;
    readonly rationale: string;
  } | null;
  readonly parameters: Readonly<Record<string, number>>;
  readonly feasibilityStatus: FeasibilityStatus;
  readonly summary: OpportunitySummaryNumbers;
  readonly ranking: OpportunityRanking | null;
  /**
   * Denormalised copy of {@link OpportunityRanking.rank}, kept at the top level
   * so the comparison grid can order on it. A query that orders by a field skips
   * documents that lack it, so every opportunity must carry `rank` or it would be
   * invisible to that list; unranked candidates sort last.
   */
  readonly rank: number;
  /**
   * Buyer matches are embedded rather than referenced: they are small, derived
   * from the opportunity, and needed by both the comparison grid and the detail
   * page, so a separate read would buy nothing.
   */
  readonly buyerMatches: readonly BuyerMatch[];
  /** Prose produced by the explanation model. Never contains its own figures. */
  readonly explanation: {
    readonly summary: string;
    readonly keyPoints: readonly string[];
    readonly caveats: readonly string[];
    readonly nextActions: readonly string[];
  } | null;
  readonly reasons: readonly string[];
  readonly risks: readonly string[];
  readonly nextActions: readonly string[];
  readonly saved: boolean;
  readonly savedAt: IsoDateTime | null;
  readonly isSampleData: boolean;
  readonly createdBy: string;
  readonly evaluatedAt: IsoDateTime;
}

/** Persisted under `feasibility_results/{opportunityId}`. */
export interface FeasibilityResultDocument extends FeasibilityResult {
  readonly id: string;
  readonly orgId: string;
  readonly opportunityId: string;
  readonly materialId: string;
  readonly schemaVersion: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** Persisted under `cost_estimates/{opportunityId}`. */
export interface CostEstimateDocument extends CostEstimate {
  readonly id: string;
  readonly orgId: string;
  readonly opportunityId: string;
  readonly schemaVersion: number;
  readonly createdBy: string;
  readonly updatedAt: IsoDateTime;
}

export interface OpportunityDetail {
  readonly opportunity: OpportunityDocument;
  readonly feasibility: FeasibilityResultDocument | null;
  readonly cost: CostEstimateDocument | null;
}
