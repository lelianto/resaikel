import type { ProductTemplate } from '../catalog/types';
import type { ToolId } from '../catalog/types';
import type { IsoDateTime } from '../common';
import type { ConditionGrade, MaterialCategory, MaterialFamily } from '../materials/types';
import type { QuantityUnit } from '../materials/types';
import type { AdditionalMaterialRequirement } from '../catalog/types';
import type { Placement, StockUsage, UnplacedPart } from './packing';

/**
 * Feasibility outcomes.
 *
 * The five states are deliberately distinct because they answer different
 * questions, and collapsing them would let a geometry result masquerade as a
 * production green light:
 *
 *  - `not_evaluated`            we lack the confirmed inputs to decide anything
 *  - `not_feasible`             a hard constraint fails (wrong material, too small)
 *  - `geometrically_feasible`   the parts nest in the stock, but no workshop
 *                               capability profile was supplied to check the process
 *  - `conditionally_feasible`   it nests, but tools are missing or condition is poor
 *  - `process_feasible`         nests and every required tool is available
 *
 * Even `process_feasible` is a manufacturing *opinion*, not a certification.
 */
export type FeasibilityStatus =
  | 'geometrically_feasible'
  | 'process_feasible'
  | 'conditionally_feasible'
  | 'not_feasible'
  | 'not_evaluated';

export const FEASIBILITY_STATUSES: readonly FeasibilityStatus[] = [
  'process_feasible',
  'geometrically_feasible',
  'conditionally_feasible',
  'not_feasible',
  'not_evaluated',
];

export const FEASIBILITY_LABELS: Record<FeasibilityStatus, string> = {
  geometrically_feasible: 'Geometrically feasible',
  process_feasible: 'Process feasible',
  conditionally_feasible: 'Conditionally feasible',
  not_feasible: 'Not feasible',
  not_evaluated: 'Not evaluated',
};

export const FEASIBILITY_TONE: Record<
  FeasibilityStatus,
  'success' | 'primary' | 'warning' | 'danger' | 'neutral'
> = {
  process_feasible: 'success',
  geometrically_feasible: 'primary',
  conditionally_feasible: 'warning',
  not_feasible: 'danger',
  not_evaluated: 'neutral',
};

export function isFeasible(status: FeasibilityStatus): boolean {
  return status === 'process_feasible' || status === 'geometrically_feasible';
}

export function isRankable(status: FeasibilityStatus): boolean {
  return status !== 'not_feasible' && status !== 'not_evaluated';
}

export type CheckOutcome = 'pass' | 'warn' | 'fail' | 'skipped';

export interface FeasibilityCheck {
  readonly id: string;
  readonly label: string;
  readonly outcome: CheckOutcome;
  readonly detail: string;
}

/** The material/workshop facts the engine is allowed to reason about. */
export interface FeasibilityMaterialInput {
  readonly category: MaterialCategory;
  readonly lengthMm: number | null;
  readonly widthMm: number | null;
  readonly thicknessMm: number | null;
  readonly quantityValue: number;
  readonly quantityUnit: QuantityUnit;
  readonly reservedQuantity: number;
  readonly condition: ConditionGrade;
  readonly contamination: readonly string[];
  readonly defects: readonly string[];
  /** True only when the user has explicitly confirmed the material. */
  readonly verified: boolean;
}

export interface WorkshopCapabilityInput {
  readonly tools: readonly ToolId[];
  readonly processes: readonly string[];
  readonly supportedFamilies: readonly MaterialFamily[];
  readonly name: string;
}

export interface FeasibilityOptions {
  readonly kerfMm?: number;
  readonly trimAllowanceMm?: number;
  readonly maxUnitsCap?: number;
}

export interface FeasibilityInput {
  readonly template: ProductTemplate;
  readonly parameters: Readonly<Record<string, number | undefined>>;
  readonly material: FeasibilityMaterialInput;
  readonly capability?: WorkshopCapabilityInput | null;
  readonly options?: FeasibilityOptions;
}

export interface FeasibilityCapacity {
  readonly maxUnits: number;
  readonly sheetsRequired: number;
  readonly sheetsAvailable: number;
  readonly unitsPerSheet: number | null;
  readonly wastePercent: number;
  readonly usedAreaMm2: number;
  readonly totalStockAreaMm2: number;
}

/** Additional consumables scaled to the full producible batch. */
export interface ScaledMaterialRequirement extends AdditionalMaterialRequirement {
  readonly totalQuantity: number;
  readonly estimatedCostMinor: number;
}

export interface PackagingChecklistStatus {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  /**
   * `null` means "not verified". resaikel never asserts packaging compliance,
   * so a required item stays unverified until a human signs it off.
   */
  readonly satisfied: boolean | null;
}

export interface FeasibilityResult {
  readonly templateId: string;
  readonly templateName: string;
  readonly validationLevel: ProductTemplate['validationLevel'];
  readonly status: FeasibilityStatus;
  readonly checks: readonly FeasibilityCheck[];
  readonly capacity: FeasibilityCapacity;
  readonly unplaced: readonly UnplacedPart[];
  /** Layout for exactly one finished unit - what the cutting diagram renders. */
  readonly unitLayout: readonly StockUsage[];
  readonly unitParts: readonly { partId: string; name: string; quantity: number }[];
  readonly resolvedParts: readonly {
    partId: string;
    name: string;
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    quantityPerUnit: number;
  }[];
  readonly resolvedParameters: Readonly<Record<string, number>>;
  readonly additionalMaterials: readonly ScaledMaterialRequirement[];
  readonly packagingChecklist: readonly PackagingChecklistStatus[];
  readonly missingTools: readonly ToolId[];
  readonly missingProcesses: readonly string[];
  readonly rejectReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly assumptions: readonly string[];
  readonly limitingFactor: string | null;
  readonly disclaimer: string;
  readonly kerfMm: number;
  readonly evaluatedAt: IsoDateTime;
}

export type { Placement, StockUsage, UnplacedPart };

export const FEASIBILITY_DISCLAIMER =
  'This is a conservative 2D rectangular estimate, not a production drawing or a safety ' +
  'certification. Successful nesting does not prove structural safety, load capacity, ' +
  'regulatory compliance or commercial production readiness.';
