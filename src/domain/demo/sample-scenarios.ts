import { getTemplate } from '../catalog';
import type { ProductCategory, ProductValidationLevel } from '../catalog/types';
import { buildCostAssumptions, computeCost } from '../cost/engine';
import type { CostEstimate } from '../cost/types';
import { matchBuyers, type BuyerRequirement, type BuyerMatchSet } from '../buyers/matching';
import { evaluateFeasibility } from '../feasibility/engine';
import type { FeasibilityResult, FeasibilityStatus } from '../feasibility/types';
import { isFeasible, isRankable } from '../feasibility/types';
import type { StockUsage } from '../feasibility/packing';
import type { EvidenceQuality, MarketAssessment } from '../market/types';
import { assessMarket } from '../market/aggregate';
import type { ConditionGrade, MaterialCategory, MaterialFamily } from '../materials/types';
import { familyOf, MATERIAL_CATEGORY_LABELS } from '../materials/types';
import { rankOpportunities, type OpportunitySignals } from '../ranking/rank';
import type { ProcessId, ToolId } from '../catalog/types';

import { additionalMaterialsPerUnit, materialCostPerUnit } from '../evaluation/cost-inputs';
import { SAMPLE_MARKET_EVIDENCE } from './market-evidence';

/**
 * Worked examples for the landing page.
 *
 * These are *real engine runs*, not illustrations: the same feasibility gates, the
 * same integer cost model, the same market aggregation and the same ranking that
 * the application uses. Only the inputs are fixed, and every scenario is flagged
 * as sample data from end to end.
 *
 * That is deliberate. A landing page that shows made-up numbers next to a product
 * whose whole claim is "we do not invent numbers" would undercut the product.
 */

export interface ScenarioMaterial {
  readonly title: string;
  readonly category: MaterialCategory;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number | null;
  readonly sheetCount: number;
  readonly condition: ConditionGrade;
  readonly contamination: readonly string[];
  readonly defects: readonly string[];
}

export interface ScenarioCapability {
  readonly name: string;
  readonly tools: readonly ToolId[];
  readonly processes: readonly ProcessId[];
  readonly supportedFamilies: readonly MaterialFamily[];
}

export interface ScenarioOpportunityPreview {
  readonly templateId: string;
  readonly productName: string;
  readonly category: ProductCategory;
  readonly validationLevel: ProductValidationLevel;
  readonly status: FeasibilityStatus;
  /**
   * Whether the candidate cleared every hard gate. This - not "is it perfect" -
   * is what decides whether it is ranked among viable products, and conflating
   * the two would let a fully feasible candidate sit below a rejected one.
   */
  readonly gatesPassed: boolean;
  /** Cleared the gates *and* has no outstanding caveat. */
  readonly fullyFeasible: boolean;
  readonly rank: number;
  readonly score: number | null;
  readonly maxUnits: number;
  readonly wastePercent: number | null;
  readonly unitCostMinor: number | null;
  readonly minViablePriceMinor: number | null;
  readonly referencePriceMinor: number | null;
  readonly contributionPerUnitMinor: number | null;
  readonly contributionMarginBps: number | null;
  readonly evidenceQuality: EvidenceQuality;
  readonly complexity: string | null;
  readonly labourMinutesPerUnit: number;
  readonly parts: readonly {
    readonly name: string;
    readonly lengthMm: number;
    readonly widthMm: number;
    readonly quantityPerUnit: number;
  }[];
  readonly unitLayout: readonly StockUsage[];
  readonly kerfMm: number;
  readonly rejectReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
  readonly segments: readonly { readonly label: string; readonly kind: string }[];
  readonly buyerMatchSet: BuyerMatchSet;
  readonly cost: CostEstimate | null;
  readonly feasibility: FeasibilityResult | null;
  readonly market: MarketAssessment;
}

export interface SampleScenario {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly material: ScenarioMaterial;
  readonly capability: ScenarioCapability;
  readonly currency: string;
  readonly region: string;
  readonly opportunities: readonly ScenarioOpportunityPreview[];
  readonly notes: readonly string[];
  readonly isSampleData: true;
}

interface ScenarioDefinition {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly material: ScenarioMaterial;
  readonly capability: ScenarioCapability;
  readonly templateIds: readonly string[];
  readonly currency: string;
  readonly region: string;
  readonly requirements: readonly BuyerRequirement[];
}

const ID = 'IDR';

const WOOD_WORKSHOP: ScenarioCapability = {
  name: 'Sample workshop: basic wood tools',
  tools: ['measuring_tape', 'ruler_square', 'circular_saw', 'hand_drill', 'orbital_sander', 'clamps'],
  processes: ['measure_mark', 'cut_straight', 'drill', 'sand', 'glue', 'assemble', 'surface_finish'],
  supportedFamilies: ['sheet_wood', 'solid_wood'],
};

const CARDBOARD_WORKSHOP: ScenarioCapability = {
  name: 'Sample workshop: cutting table',
  tools: ['measuring_tape', 'ruler_square', 'straight_edge', 'utility_knife', 'scoring_bone', 'cutting_mat', 'hot_glue_gun'],
  processes: ['measure_mark', 'cut_straight', 'score', 'fold', 'glue'],
  supportedFamilies: ['cardboard', 'paper'],
};

const FURNITURE_WORKSHOP: ScenarioCapability = {
  name: 'Sample workshop: furniture grade',
  tools: [
    'measuring_tape',
    'ruler_square',
    'circular_saw',
    'drill_press',
    'orbital_sander',
    'clamps',
    'jig_saw',
  ],
  processes: [
    'measure_mark',
    'cut_straight',
    'cut_curve',
    'drill',
    'sand',
    'glue',
    'assemble',
    'surface_finish',
  ],
  supportedFamilies: ['sheet_wood', 'solid_wood'],
};

const REQUIREMENTS: readonly BuyerRequirement[] = [
  {
    id: 'sample-req-1',
    buyerKind: 'b2b',
    businessName: 'Sample Devices Refurb',
    industry: 'Refurbished electronics',
    location: 'Jakarta',
    country: 'ID',
    productCategories: ['packaging'],
    materialFamilies: ['cardboard'],
    minOrderQuantity: 5_000,
    budgetMinMinor: 3_000,
    budgetMaxMinor: 8_000,
    currency: ID,
    capacityNote: 'Needs a steady monthly supply.',
    consentToMatch: true,
    verified: true,
  },
  {
    id: 'sample-req-2',
    buyerKind: 'b2b',
    businessName: 'Sample Gift Studio',
    industry: 'Corporate gifting',
    location: 'Bandung',
    country: 'ID',
    productCategories: ['decor', 'desk_organisation'],
    materialFamilies: ['sheet_wood'],
    minOrderQuantity: 200,
    budgetMinMinor: 30_000,
    budgetMaxMinor: 90_000,
    currency: ID,
    capacityNote: null,
    consentToMatch: true,
    verified: true,
  },
];

const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: 'plywood-offcuts',
    label: 'Scenario A: Plywood offcuts',
    blurb:
      'Four clean 600 × 400 × 12 mm plywood offcuts from a cabinet job, and a workshop with basic cutting tools.',
    material: {
      title: 'Plywood offcuts (sample)',
      category: 'plywood',
      lengthMm: 600,
      widthMm: 400,
      thicknessMm: 12,
      sheetCount: 4,
      condition: 'good',
      contamination: [],
      defects: [],
    },
    capability: WOOD_WORKSHOP,
    templateIds: [
      'sheetwood-phone-stand',
      'sheetwood-desk-organiser',
      'sheetwood-coaster-set',
      'sheetwood-bookend-pair',
    ],
    currency: ID,
    region: 'ID',
    requirements: REQUIREMENTS,
  },
  {
    id: 'cardboard-waste',
    label: 'Scenario B: Cardboard waste',
    blurb:
      'Six clean 1000 × 700 × 3 mm corrugated sheets. Enough for retail packaging, not enough to promise electronics-grade protection.',
    material: {
      title: 'Corrugated sheets (sample)',
      category: 'cardboard',
      lengthMm: 1000,
      widthMm: 700,
      thicknessMm: 3,
      sheetCount: 6,
      condition: 'good',
      contamination: [],
      defects: [],
    },
    capability: CARDBOARD_WORKSHOP,
    templateIds: [
      'cardboard-packaging-insert',
      'cardboard-product-divider',
      'cardboard-shipping-box-small',
      'cardboard-desk-organiser',
    ],
    currency: ID,
    region: 'ID',
    requirements: REQUIREMENTS,
  },
  {
    id: 'undersized-cardboard',
    label: 'Scenario C: Offcuts that do not fit',
    blurb:
      'Two 300 × 200 mm cardboard pieces. Small enough that a shipping box dieline simply cannot be cut from them, but a folding packaging insert still can. That answer is more useful than a single yes or no.',
    material: {
      title: 'Small corrugated offcuts (sample)',
      category: 'cardboard',
      lengthMm: 300,
      widthMm: 200,
      thicknessMm: 3,
      sheetCount: 2,
      condition: 'good',
      contamination: [],
      defects: [],
    },
    capability: CARDBOARD_WORKSHOP,
    templateIds: [
      'cardboard-shipping-box-small',
      'cardboard-retail-display-stand',
      'cardboard-packaging-insert',
    ],
    currency: ID,
    region: 'ID',
    requirements: REQUIREMENTS,
  },
];

function evaluateOne(
  definition: ScenarioDefinition,
  templateId: string,
): ScenarioOpportunityPreview | null {
  const template = getTemplate(templateId);
  if (!template) return null;

  const family = familyOf(definition.material.category);

  const feasibility = evaluateFeasibility({
    template,
    parameters: {},
    material: {
      category: definition.material.category,
      lengthMm: definition.material.lengthMm,
      widthMm: definition.material.widthMm,
      thicknessMm: definition.material.thicknessMm,
      quantityValue: definition.material.sheetCount,
      quantityUnit: 'sheet',
      reservedQuantity: 0,
      condition: definition.material.condition,
      contamination: definition.material.contamination,
      defects: definition.material.defects,
      // The scenario stands in for a material the owner has already confirmed.
      verified: true,
    },
    capability: definition.capability,
  });

  const market = assessMarket(SAMPLE_MARKET_EVIDENCE, {
    category: template.category,
    currency: definition.currency,
    region: definition.region,
  });

  let cost: CostEstimate | null = null;
  if (feasibility.capacity.maxUnits > 0) {
    const materialCost = materialCostPerUnit(feasibility);
    const { assumptions } = buildCostAssumptions({
      currency: definition.currency,
      labourMinutesPerUnit: template.labourMinutesPerUnit,
      additionalMaterialsPerUnitMinor: additionalMaterialsPerUnit(feasibility),
      materialCostPerUnitMinor: materialCost.amountMinor,
    });

    cost = computeCost({
      assumptions,
      priceBands: market.bands,
      hints: { material: materialCost.basis },
    });
  }

  const referenceScenario = cost?.scenarios.find((scenario) => scenario.id === 'reference') ?? null;

  const buyerMatchSet = matchBuyers(definition.requirements, {
    templateId: template.id,
    category: template.category,
    materialFamilies: template.materialFamilies,
    materialFamily: family,
    complexity: template.complexity,
    maxUnits: feasibility.capacity.maxUnits,
    currency: definition.currency,
    region: definition.region,
    referencePriceMinor: market.bands?.referenceMinor ?? null,
    segmentIds: template.targetSegments,
  });

  const reasons: string[] = [
    `${feasibility.capacity.maxUnits} unit(s) fit ${feasibility.capacity.sheetsRequired} sheet(s) with ` +
      `${feasibility.capacity.wastePercent}% cutting waste.`,
  ];
  if (!isFeasible(feasibility.status)) reasons.push(...feasibility.rejectReasons);
  reasons.push(market.bands ? market.basis : 'Insufficient Market Data for this category.');

  return {
    templateId: template.id,
    productName: template.name,
    category: template.category,
    validationLevel: template.validationLevel,
    status: feasibility.status,
    gatesPassed: isRankable(feasibility.status),
    fullyFeasible: isFeasible(feasibility.status),
    rank: 0,
    score: null,
    maxUnits: feasibility.capacity.maxUnits,
    wastePercent: feasibility.capacity.wastePercent,
    unitCostMinor: cost?.unitCostMinor ?? null,
    minViablePriceMinor: cost?.minViablePricePerUnitMinor ?? null,
    referencePriceMinor: market.bands?.referenceMinor ?? null,
    contributionPerUnitMinor: referenceScenario?.contributionPerUnitMinor ?? null,
    contributionMarginBps: referenceScenario?.contributionMarginBps ?? null,
    evidenceQuality: market.quality,
    complexity: template.complexity,
    labourMinutesPerUnit: template.labourMinutesPerUnit,
    parts: feasibility.resolvedParts.map((part) => ({
      name: part.name,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      quantityPerUnit: part.quantityPerUnit,
    })),
    unitLayout: feasibility.unitLayout,
    kerfMm: feasibility.kerfMm,
    rejectReasons: feasibility.rejectReasons,
    warnings: feasibility.warnings,
    reasons,
    segments: template.targetSegments.map((segmentId) => ({
      label: segmentId.replace(/_/g, ' '),
      kind: 'potential_segment',
    })),
    buyerMatchSet,
    cost,
    feasibility,
    market,
  };
}

function buildScenario(definition: ScenarioDefinition): SampleScenario {
  const previews = definition.templateIds
    .map((templateId) => evaluateOne(definition, templateId))
    .filter((preview): preview is ScenarioOpportunityPreview => preview !== null);

  const signals: OpportunitySignals[] = previews.map((preview) => ({
    id: preview.templateId,
    label: preview.productName,
    feasibilityStatus: preview.status,
    contributionPerUnitMinor: preview.contributionPerUnitMinor,
    unitCostMinor: preview.unitCostMinor,
    referencePriceMinor: preview.referencePriceMinor,
    materialUtilisationPercent:
      preview.wastePercent === null ? null : Math.max(0, 100 - preview.wastePercent),
    buyerScore: preview.buyerMatchSet.bestScore,
    evidenceQuality: preview.evidenceQuality,
    complexity: preview.feasibility ? (getTemplate(preview.templateId)?.complexity ?? null) : null,
    maxUnits: preview.maxUnits,
  }));

  const ranked = rankOpportunities(signals);
  const rankedById = new Map(ranked.map((entry) => [entry.id, entry]));

  const opportunities = previews
    .map((preview) => {
      const rank = rankedById.get(preview.templateId);
      return { ...preview, rank: rank?.rank ?? 0, score: rank?.score ?? null };
    })
    .sort((a, b) => a.rank - b.rank);

  const notes: string[] = [];
  const rejected = opportunities.filter((preview) => !preview.gatesPassed);
  const conditional = opportunities.filter(
    (preview) => preview.gatesPassed && !preview.fullyFeasible,
  );

  if (rejected.length > 0) {
    notes.push(
      `${rejected.length} candidate(s) are rejected with a stated reason rather than estimated.`,
    );
  }
  if (conditional.length > 0) {
    notes.push(
      `${conditional.length} candidate(s) pass the hard gates but carry an outstanding caveat, so ` +
        'they are reported as conditionally feasible rather than as a clean green light.',
    );
  }
  if (opportunities.every((preview) => preview.evidenceQuality === 'insufficient')) {
    notes.push('No market evidence exists for these categories, so no price is shown.');
  }
  if (opportunities.some((preview) => preview.buyerMatchSet.shortfallDetected)) {
    notes.push(
      'At least one registered buyer wants more units than this material can produce, and the gap is ' +
        'reported rather than smoothed over.',
    );
  }

  return {
    id: definition.id,
    label: definition.label,
    blurb: definition.blurb,
    material: definition.material,
    capability: definition.capability,
    currency: definition.currency,
    region: definition.region,
    opportunities,
    notes,
    isSampleData: true,
  };
}

let cache: readonly SampleScenario[] | null = null;

/** Computed once per process; the engines are pure, so the result is stable. */
export function sampleScenarios(): readonly SampleScenario[] {
  cache ??= SCENARIOS.map(buildScenario);
  return cache;
}

export function sampleScenario(id: string): SampleScenario | null {
  return sampleScenarios().find((scenario) => scenario.id === id) ?? null;
}

export function scenarioMaterialSummary(material: ScenarioMaterial): string {
  const family = familyOf(material.category);
  return (
    `${MATERIAL_CATEGORY_LABELS[material.category]} (${family.replace(/_/g, ' ')}) at ` +
    `${material.lengthMm} × ${material.widthMm} mm` +
    (material.thicknessMm !== null ? ` × ${material.thicknessMm} mm` : '') +
    `, ${material.sheetCount} sheet(s)`
  );
}

export { FURNITURE_WORKSHOP, isRankable };
