import type { Complexity } from '../catalog/types';
import type { FeasibilityStatus } from '../feasibility/types';
import { isRankable } from '../feasibility/types';
import type { EvidenceQuality } from '../market/types';

/**
 * Ranking weights.
 *
 * Weights are relative, not required to sum to one; they are normalised at
 * scoring time. They are configuration, not constants: a workshop that cares
 * only about throughput can set `materialUtilisation` to zero and raise
 * `economicValue`.
 */
export interface RankingWeights {
  readonly feasibility: number;
  readonly economicValue: number;
  readonly materialUtilisation: number;
  readonly buyerCompatibility: number;
  readonly evidenceQuality: number;
  readonly lowComplexity: number;
}

export type RankingDimensionId = keyof RankingWeights;

export const RANKING_DIMENSION_LABELS: Record<RankingDimensionId, string> = {
  feasibility: 'Manufacturing feasibility',
  economicValue: 'Estimated economic value',
  materialUtilisation: 'Material utilisation',
  buyerCompatibility: 'Buyer compatibility',
  evidenceQuality: 'Market evidence quality',
  lowComplexity: 'Production simplicity',
};

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  feasibility: 0.22,
  economicValue: 0.3,
  materialUtilisation: 0.18,
  buyerCompatibility: 0.15,
  evidenceQuality: 0.1,
  lowComplexity: 0.05,
};

export const RANKING_DIMENSIONS: readonly RankingDimensionId[] = [
  'feasibility',
  'economicValue',
  'materialUtilisation',
  'buyerCompatibility',
  'evidenceQuality',
  'lowComplexity',
];

/** Sort modes offered on the comparison screen. */
export const SORT_MODES = [
  'overall',
  'economic_potential',
  'material_utilisation',
  'production_complexity',
  'buyer_compatibility',
] as const;

export type SortMode = (typeof SORT_MODES)[number];

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  overall: 'Overall score',
  economic_potential: 'Economic potential',
  material_utilisation: 'Material utilisation',
  production_complexity: 'Production simplicity',
  buyer_compatibility: 'Buyer compatibility',
};

export const SORT_MODE_DIMENSION: Record<
  Exclude<SortMode, 'overall'>,
  RankingDimensionId
> = {
  economic_potential: 'economicValue',
  material_utilisation: 'materialUtilisation',
  production_complexity: 'lowComplexity',
  buyer_compatibility: 'buyerCompatibility',
};

export interface OpportunitySignals {
  /** Stable identity used for deterministic tie-breaking. */
  readonly id: string;
  readonly label: string;
  readonly feasibilityStatus: FeasibilityStatus;
  readonly contributionPerUnitMinor: number | null;
  readonly unitCostMinor: number | null;
  readonly referencePriceMinor: number | null;
  /** Used-area share of consumed stock, 0–100. `null` if unknown. */
  readonly materialUtilisationPercent: number | null;
  readonly buyerScore: number | null;
  readonly evidenceQuality: EvidenceQuality | null;
  readonly complexity: Complexity | null;
  readonly maxUnits: number;
}

export interface RankedDimension {
  readonly id: RankingDimensionId;
  readonly label: string;
  /** Normalised 0–1, or `null` when the underlying fact is unknown. */
  readonly value: number | null;
  readonly weight: number;
  readonly explanation: string;
}

export interface RankedOpportunity {
  readonly id: string;
  readonly label: string;
  readonly rank: number;
  /** 0–100, or `null` when the candidate failed a hard gate. */
  readonly score: number | null;
  readonly dimensions: readonly RankedDimension[];
  readonly gatesPassed: boolean;
  readonly gateReasons: readonly string[];
  /** Dimensions that could not be scored. Never filled with a guess. */
  readonly unknownDimensions: readonly RankingDimensionId[];
  readonly summary: string;
}

export interface RankOptions {
  readonly weights?: Partial<RankingWeights>;
  /** Reference contribution used to normalise economic value. Inferred if omitted. */
  readonly bestContributionMinor?: number;
}

const EVIDENCE_VALUES: Record<EvidenceQuality, number> = {
  strong: 1,
  moderate: 0.66,
  weak: 0.33,
  insufficient: 0,
};

const COMPLEXITY_VALUES: Record<Complexity, number> = {
  low: 1,
  medium: 0.6,
  high: 0.3,
};

const FEASIBILITY_VALUES: Record<FeasibilityStatus, number> = {
  process_feasible: 1,
  geometrically_feasible: 0.7,
  conditionally_feasible: 0.45,
  not_feasible: 0,
  not_evaluated: 0,
};

function normaliseWeights(weights: RankingWeights): RankingWeights {
  const total = RANKING_DIMENSIONS.reduce((sum, id) => sum + Math.max(0, weights[id]), 0);
  if (total <= 0) return DEFAULT_RANKING_WEIGHTS;

  return {
    feasibility: Math.max(0, weights.feasibility) / total,
    economicValue: Math.max(0, weights.economicValue) / total,
    materialUtilisation: Math.max(0, weights.materialUtilisation) / total,
    buyerCompatibility: Math.max(0, weights.buyerCompatibility) / total,
    evidenceQuality: Math.max(0, weights.evidenceQuality) / total,
    lowComplexity: Math.max(0, weights.lowComplexity) / total,
  };
}

export function resolveWeights(overrides: Partial<RankingWeights> = {}): RankingWeights {
  return normaliseWeights({ ...DEFAULT_RANKING_WEIGHTS, ...overrides });
}

function buildDimensions(
  signals: OpportunitySignals,
  weights: RankingWeights,
  bestContributionMinor: number | null,
): RankedDimension[] {
  const economicValue =
    signals.contributionPerUnitMinor === null || bestContributionMinor === null || bestContributionMinor <= 0
      ? null
      : Math.max(0, Math.min(1, signals.contributionPerUnitMinor / bestContributionMinor));

  const utilisation =
    signals.materialUtilisationPercent === null
      ? null
      : Math.max(0, Math.min(1, signals.materialUtilisationPercent / 100));

  const buyer =
    signals.buyerScore === null ? null : Math.max(0, Math.min(1, signals.buyerScore / 100));

  const evidence =
    signals.evidenceQuality === null
      ? null
      : signals.evidenceQuality === 'insufficient'
        ? null
        : EVIDENCE_VALUES[signals.evidenceQuality];

  const simplicity = signals.complexity === null ? null : COMPLEXITY_VALUES[signals.complexity];

  return [
    {
      id: 'feasibility',
      label: RANKING_DIMENSION_LABELS.feasibility,
      value: FEASIBILITY_VALUES[signals.feasibilityStatus],
      weight: weights.feasibility,
      explanation:
        signals.feasibilityStatus === 'process_feasible'
          ? 'Nests in the available stock and every required tool is available.'
          : signals.feasibilityStatus === 'geometrically_feasible'
            ? 'Nests in the available stock, but no workshop profile was supplied to verify the process.'
            : 'Nests in the available stock, but the process is only conditionally supported.',
    },
    {
      id: 'economicValue',
      label: RANKING_DIMENSION_LABELS.economicValue,
      value: economicValue,
      weight: weights.economicValue,
      explanation:
        economicValue === null
          ? 'No contribution per unit could be calculated, because a selling price is not yet known.'
          : `Contribution of ${signals.contributionPerUnitMinor} per unit, which is ` +
            `${Math.round(economicValue * 100)}% of the best candidate in this set.`,
    },
    {
      id: 'materialUtilisation',
      label: RANKING_DIMENSION_LABELS.materialUtilisation,
      value: utilisation,
      weight: weights.materialUtilisation,
      explanation:
        utilisation === null
          ? 'The cutting layout could not be evaluated.'
          : `${(signals.materialUtilisationPercent ?? 0).toFixed(1)}% of the consumed sheet area ends ` +
            'up in the product. The remainder is kerf and offcut.',
    },
    {
      id: 'buyerCompatibility',
      label: RANKING_DIMENSION_LABELS.buyerCompatibility,
      value: buyer,
      weight: weights.buyerCompatibility,
      explanation:
        buyer === null
          ? 'No buyer match could be scored.'
          : `Best buyer match scores ${Math.round((signals.buyerScore ?? 0))}/100 across the matched ` +
            'factors. Unknown buyer factors are excluded rather than assumed.',
    },
    {
      id: 'evidenceQuality',
      label: RANKING_DIMENSION_LABELS.evidenceQuality,
      value: evidence,
      weight: weights.evidenceQuality,
      explanation:
        evidence === null
          ? 'Insufficient Market Data. No price evidence exists, so this dimension is left unknown ' +
            'rather than scored as zero.'
          : `Market evidence quality is ${signals.evidenceQuality}.`,
    },
    {
      id: 'lowComplexity',
      label: RANKING_DIMENSION_LABELS.lowComplexity,
      value: simplicity,
      weight: weights.lowComplexity,
      explanation:
        simplicity === null
          ? 'Production complexity is not recorded for this product.'
          : `${signals.complexity} complexity, which scores ${Math.round(simplicity * 100)} on ` +
            'simplicity.',
    },
  ];
}

/**
 * Scores and orders candidates.
 *
 * Hard feasibility gates run first and are never traded away for score: a product
 * that cannot be made is not ranked above one that can. Unknown dimensions are
 * excluded from the weighted average and reported, so a candidate with no market
 * evidence is not silently punished as if its evidence were bad.
 */
export function rankOpportunities(
  signals: readonly OpportunitySignals[],
  options: RankOptions = {},
): RankedOpportunity[] {
  const weights = resolveWeights(options.weights);

  const gated = signals.filter((item) => isRankable(item.feasibilityStatus));

  const inferredBest = gated.reduce<number | null>((best, item) => {
    if (item.contributionPerUnitMinor === null) return best;
    if (best === null) return item.contributionPerUnitMinor;
    return Math.max(best, item.contributionPerUnitMinor);
  }, null);

  const bestContribution = options.bestContributionMinor ?? inferredBest;

  const scored = signals.map<RankedOpportunity>((item) => {
    const dimensions = buildDimensions(item, weights, bestContribution);
    const unknownDimensions = dimensions
      .filter((dimension) => dimension.value === null)
      .map((dimension) => dimension.id);

    const passed = isRankable(item.feasibilityStatus);

    if (!passed) {
      return {
        id: item.id,
        label: item.label,
        rank: 0,
        score: null,
        dimensions,
        gatesPassed: false,
        gateReasons: [
          item.feasibilityStatus === 'not_feasible'
            ? 'Failed a hard manufacturing constraint, so it is not scored against viable products.'
            : 'Not evaluated, because required material properties are still unconfirmed.',
        ],
        unknownDimensions,
        summary: `${item.label} was excluded from ranking because it did not pass the feasibility gate.`,
      };
    }

    const known = dimensions.filter((dimension) => dimension.value !== null);
    const knownWeight = known.reduce((total, dimension) => total + dimension.weight, 0);

    const score =
      knownWeight > 0
        ? Math.round(
            (known.reduce(
              (total, dimension) => total + (dimension.value ?? 0) * dimension.weight,
              0,
            ) /
              knownWeight) *
              100,
          )
        : null;

    const unknownNote =
      unknownDimensions.length > 0
        ? ` ${unknownDimensions.length} dimension(s) could not be scored and were excluded: ` +
          `${unknownDimensions.map((id) => RANKING_DIMENSION_LABELS[id].toLowerCase()).join(', ')}.`
        : '';

    return {
      id: item.id,
      label: item.label,
      rank: 0,
      score,
      dimensions,
      gatesPassed: true,
      gateReasons: [],
      unknownDimensions,
      summary:
        score === null
          ? `${item.label} passed the feasibility gate but nothing could be scored.`
          : `${item.label} scores ${score}/100 on ${known.length} of ${dimensions.length} ` +
            `dimensions.${unknownNote}`,
    };
  });

  scored.sort((a, b) => {
    if (a.gatesPassed !== b.gatesPassed) return a.gatesPassed ? -1 : 1;
    const scoreA = a.score ?? -1;
    const scoreB = b.score ?? -1;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.id < b.id ? -1 : 1;
  });

  return scored.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** Re-orders already-scored candidates by a single dimension. */
export function sortRanked(
  ranked: readonly RankedOpportunity[],
  mode: SortMode,
): RankedOpportunity[] {
  if (mode === 'overall') return [...ranked];

  const dimensionId = SORT_MODE_DIMENSION[mode];

  return [...ranked].sort((a, b) => {
    if (a.gatesPassed !== b.gatesPassed) return a.gatesPassed ? -1 : 1;

    const valueA = a.dimensions.find((dimension) => dimension.id === dimensionId)?.value ?? null;
    const valueB = b.dimensions.find((dimension) => dimension.id === dimensionId)?.value ?? null;

    if (valueA === null && valueB === null) return a.id < b.id ? -1 : 1;
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    if (valueA !== valueB) return valueB - valueA;
    return a.id < b.id ? -1 : 1;
  });
}
