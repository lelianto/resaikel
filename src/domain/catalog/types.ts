import type { BuyerSegmentId } from '../buyers/segments';
import type { MaterialFamily } from '../materials/types';

/**
 * The parametric product catalogue.
 *
 * This is the ground truth that keeps Gemini grounded. The model may *select* a
 * template and propose parameter values inside the declared bounds - it may not
 * invent geometry, tooling, labour times or consumables. Everything the
 * feasibility and cost engines consume comes from here.
 *
 * The whole structure is declarative and JSON-serialisable so the same data can
 * be seeded into Firestore `product_templates` for reference reads.
 */

export const PRODUCT_CATEGORIES = [
  'packaging',
  'desk_organisation',
  'display',
  'kitchenware',
  'decor',
  'storage',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  packaging: 'Packaging',
  desk_organisation: 'Desk organisation',
  display: 'Display',
  kitchenware: 'Kitchenware',
  decor: 'Decorative',
  storage: 'Storage',
};

/**
 * `validated` means a real manufacturing specification exists in this catalogue.
 * `concept` means it is an idea only and must be labelled
 * "Concept Only - Manufacturing Validation Required" everywhere it appears.
 */
export type ProductValidationLevel = 'validated' | 'concept';

export const CODE_COMPLEXITY = ['low', 'medium', 'high'] as const;
export type Complexity = (typeof CODE_COMPLEXITY)[number];

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const TOOL_IDS = [
  'measuring_tape',
  'ruler_square',
  'cutting_mat',
  'utility_knife',
  'scoring_bone',
  'straight_edge',
  'hand_saw',
  'circular_saw',
  'jig_saw',
  'band_saw',
  'hand_drill',
  'drill_press',
  'orbital_sander',
  'clamps',
  'hot_glue_gun',
  'staple_gun',
  'cnc_router',
  'laser_cutter',
  'edge_banding_iron',
  'paint_brush',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const TOOL_LABELS: Record<ToolId, string> = {
  measuring_tape: 'Measuring tape',
  ruler_square: 'Ruler / square',
  cutting_mat: 'Cutting mat',
  utility_knife: 'Utility knife',
  scoring_bone: 'Scoring tool',
  straight_edge: 'Straight edge',
  hand_saw: 'Hand saw',
  circular_saw: 'Circular saw',
  jig_saw: 'Jig saw',
  band_saw: 'Band saw',
  hand_drill: 'Hand drill',
  drill_press: 'Drill press',
  orbital_sander: 'Orbital sander',
  clamps: 'Clamps',
  hot_glue_gun: 'Hot glue gun',
  staple_gun: 'Staple gun',
  cnc_router: 'CNC router',
  laser_cutter: 'Laser cutter',
  edge_banding_iron: 'Edge banding iron',
  paint_brush: 'Brush / finishing tools',
};

export const PROCESS_IDS = [
  'measure_mark',
  'cut_straight',
  'cut_curve',
  'score',
  'fold',
  'drill',
  'sand',
  'edge_finish',
  'assemble',
  'glue',
  'staple',
  'surface_finish',
  'print',
  'die_cut',
] as const;

export type ProcessId = (typeof PROCESS_IDS)[number];

export const PROCESS_LABELS: Record<ProcessId, string> = {
  measure_mark: 'Measure and mark',
  cut_straight: 'Straight cutting',
  cut_curve: 'Curved cutting',
  score: 'Scoring',
  fold: 'Folding',
  drill: 'Drilling',
  sand: 'Sanding',
  edge_finish: 'Edge finishing',
  assemble: 'Assembly',
  glue: 'Gluing',
  staple: 'Stapling',
  surface_finish: 'Surface finishing',
  print: 'Printing',
  die_cut: 'Die cutting',
};

/** A single flat part required for one finished unit. */
export interface ProductPart {
  readonly id: string;
  readonly name: string;
  readonly quantityPerUnit: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number;
  /** May be rotated 90 degrees when nesting to reduce waste. */
  readonly rotatable: boolean;
  /**
   * The part is a single continuous blank (a dieline) that must be cut as one
   * piece - it cannot be assembled from smaller offcuts.
   */
  readonly continuous: boolean;
}

export interface TemplateParameter {
  readonly key: string;
  readonly label: string;
  readonly unit: 'mm';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
}

/**
 * Declarative link between a parameter and a part dimension:
 * `dimension = base + Σ(coefficient * parameter)`.
 * Keeping this serialisable means the catalogue can live in Firestore unchanged.
 */
export interface PartDimensionRule {
  readonly partId: string;
  readonly dimension: 'lengthMm' | 'widthMm' | 'thicknessMm';
  readonly base: number;
  readonly coefficients: Readonly<Record<string, number>>;
  readonly clampMin?: number;
}

export type AdditionalMaterialUnit = 'g' | 'ml' | 'piece' | 'm';

export interface AdditionalMaterialRequirement {
  readonly name: string;
  readonly unit: AdditionalMaterialUnit;
  readonly quantityPerUnit: number;
  /** Indicative unit cost in minor units, used as a default cost assumption. */
  readonly unitCostMinor: number;
}

export interface PackagingChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
}

export interface ProductTemplate {
  readonly id: string;
  readonly slug: string;
  readonly version: number;
  readonly name: string;
  readonly category: ProductCategory;
  readonly description: string;
  readonly materialFamilies: readonly MaterialFamily[];
  readonly parts: readonly ProductPart[];
  readonly parameters: readonly TemplateParameter[];
  readonly partDimensionRules: readonly PartDimensionRule[];
  readonly minStockMm: {
    readonly lengthMm: number;
    readonly widthMm: number;
    readonly thicknessMm?: number;
  };
  readonly processes: readonly ProcessId[];
  readonly requiredTools: readonly ToolId[];
  readonly optionalTools: readonly ToolId[];
  readonly complexity: Complexity;
  readonly labourMinutesPerUnit: number;
  readonly additionalMaterials: readonly AdditionalMaterialRequirement[];
  readonly packagingChecklist: readonly PackagingChecklistItem[];
  readonly targetSegments: readonly BuyerSegmentId[];
  readonly risks: readonly string[];
  readonly validationLevel: ProductValidationLevel;
  readonly validationNote: string;
}

/** Derived part geometry for one finished unit, after parameters are applied. */
export interface ResolvedPart {
  readonly partId: string;
  readonly name: string;
  readonly quantityPerUnit: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number;
  readonly rotatable: boolean;
  readonly continuous: boolean;
}

export interface ResolvedTemplate {
  readonly template: ProductTemplate;
  readonly parameters: Readonly<Record<string, number>>;
  readonly parts: readonly ResolvedPart[];
}

export const KERF_MM_DEFAULT = 3;
export const TRIM_ALLOWANCE_MM_DEFAULT = 5;
