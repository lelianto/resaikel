import type { IsoDateTime } from '../common';
import type { CurrencyCode } from '../money';
import type { PriceBands } from '../market/types';

/**
 * Production cost model.
 *
 * Two rules govern this module:
 *
 *  1. Every number is derived from a *named, editable assumption*. The engine
 *     returns the assumptions it used alongside the result, and every line item
 *     carries a `basis` string explaining its own arithmetic.
 *  2. Gemini never computes any of it. A language model may phrase an
 *     explanation of a number produced here, but the number itself always comes
 *     from integer arithmetic in this file.
 */

export const COST_LINE_IDS = [
  'material',
  'additional_materials',
  'labour',
  'machine',
  'electricity',
  'cutting_finishing',
  'packaging',
  'defect_allowance',
  'overhead',
  'transport',
  'platform_fee',
] as const;

export type CostLineId = (typeof COST_LINE_IDS)[number];

export const COST_LINE_LABELS: Record<CostLineId, string> = {
  material: 'Material opportunity cost',
  additional_materials: 'Additional materials',
  labour: 'Labour',
  machine: 'Machine time',
  electricity: 'Electricity',
  cutting_finishing: 'Cutting and finishing',
  packaging: 'Packaging',
  defect_allowance: 'Defect allowance',
  overhead: 'Overhead',
  transport: 'Transport',
  platform_fee: 'Platform fee',
};

/** Lines that scale with the number of units produced. */
export const VARIABLE_LINE_IDS: readonly CostLineId[] = [
  'material',
  'additional_materials',
  'labour',
  'machine',
  'electricity',
  'cutting_finishing',
  'packaging',
  'defect_allowance',
];

/** Lines that are incurred once per batch regardless of unit count. */
export const FIXED_LINE_IDS: readonly CostLineId[] = ['overhead', 'transport'];

export interface CostAssumptions {
  readonly currency: CurrencyCode;
  readonly batchSize: number;
  /** Opportunity cost of the sheet area consumed per unit, waste included. */
  readonly materialCostPerUnitMinor: number;
  readonly additionalMaterialsPerUnitMinor: number;
  readonly labourMinutesPerUnit: number;
  readonly labourRatePerHourMinor: number;
  readonly machineMinutesPerUnit: number;
  readonly machineRatePerHourMinor: number;
  readonly electricityKwhPerUnit: number;
  readonly electricityTariffPerKwhMinor: number;
  readonly cuttingFinishingPerUnitMinor: number;
  readonly packagingPerUnitMinor: number;
  readonly transportPerBatchMinor: number;
  readonly defectAllowancePercent: number;
  readonly overheadPerBatchMinor: number;
  readonly platformFeePercent: number;
  readonly targetMarginPercent: number;
}

export type AssumptionKey = keyof Omit<CostAssumptions, 'currency'>;

export type AssumptionGroup = 'material' | 'production' | 'energy' | 'overheads' | 'commercial';

export interface AssumptionDescriptor {
  readonly key: AssumptionKey;
  readonly label: string;
  readonly unit: 'currency' | 'percent' | 'minutes' | 'hours' | 'kwh' | 'count';
  readonly group: AssumptionGroup;
  readonly help: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const ASSUMPTION_GROUP_LABELS: Record<AssumptionGroup, string> = {
  material: 'Material',
  production: 'Production',
  energy: 'Energy',
  overheads: 'Overheads',
  commercial: 'Commercial',
};

/**
 * Drives the assumptions editor generically, so adding a cost input means adding
 * one descriptor rather than touching the form.
 */
export const COST_ASSUMPTION_DESCRIPTORS: readonly AssumptionDescriptor[] = [
  {
    key: 'batchSize',
    label: 'Batch size',
    unit: 'count',
    group: 'production',
    help: 'Number of units this estimate is calculated for.',
    min: 1,
    max: 10_000,
    step: 1,
  },
  {
    key: 'materialCostPerUnitMinor',
    label: 'Material cost per unit',
    unit: 'currency',
    group: 'material',
    help: 'Value of the sheet area one unit consumes, grossed up for cutting waste.',
    min: 0,
    max: 100_000_000,
    step: 100,
  },
  {
    key: 'additionalMaterialsPerUnitMinor',
    label: 'Additional materials per unit',
    unit: 'currency',
    group: 'material',
    help: 'Glue, tape, fixings, finish and any other consumable the product needs.',
    min: 0,
    max: 100_000_000,
    step: 100,
  },
  {
    key: 'labourMinutesPerUnit',
    label: 'Labour minutes per unit',
    unit: 'minutes',
    group: 'production',
    help: 'Hands-on time to cut, assemble and finish one unit. Seeded from the catalogue.',
    min: 0,
    max: 4_800,
    step: 1,
  },
  {
    key: 'labourRatePerHourMinor',
    label: 'Labour rate',
    unit: 'currency',
    group: 'production',
    help: 'Fully loaded cost of an hour of the maker’s time.',
    min: 0,
    max: 100_000_000,
    step: 1_000,
  },
  {
    key: 'machineMinutesPerUnit',
    label: 'Machine minutes per unit',
    unit: 'minutes',
    group: 'production',
    help: 'Powered machine time per unit, excluding hand tools.',
    min: 0,
    max: 4_800,
    step: 1,
  },
  {
    key: 'machineRatePerHourMinor',
    label: 'Machine rate',
    unit: 'currency',
    group: 'production',
    help: 'Hourly cost of the machine: wear, blades and depreciation, excluding power.',
    min: 0,
    max: 100_000_000,
    step: 500,
  },
  {
    key: 'electricityKwhPerUnit',
    label: 'Electricity per unit',
    unit: 'kwh',
    group: 'energy',
    help: 'Energy drawn per unit. A small hand-tool job is a few hundredths of a kWh.',
    min: 0,
    max: 100,
    step: 0.01,
  },
  {
    key: 'electricityTariffPerKwhMinor',
    label: 'Electricity tariff',
    unit: 'currency',
    group: 'energy',
    help: 'Price per kilowatt hour at the workshop.',
    min: 0,
    max: 10_000_000,
    step: 50,
  },
  {
    key: 'cuttingFinishingPerUnitMinor',
    label: 'Cutting and finishing',
    unit: 'currency',
    group: 'production',
    help: 'Blades, sanding consumables and finishing applied per unit.',
    min: 0,
    max: 100_000_000,
    step: 100,
  },
  {
    key: 'packagingPerUnitMinor',
    label: 'Packaging per unit',
    unit: 'currency',
    group: 'material',
    help: 'Outer packaging and protection for one finished unit.',
    min: 0,
    max: 100_000_000,
    step: 100,
  },
  {
    key: 'transportPerBatchMinor',
    label: 'Transport per batch',
    unit: 'currency',
    group: 'overheads',
    help: 'Delivery cost for the whole batch, incurred once.',
    min: 0,
    max: 1_000_000_000,
    step: 5_000,
  },
  {
    key: 'defectAllowancePercent',
    label: 'Defect allowance',
    unit: 'percent',
    group: 'production',
    help: 'Share of production expected to fail or be rejected and have to be remade.',
    min: 0,
    max: 50,
    step: 0.5,
  },
  {
    key: 'overheadPerBatchMinor',
    label: 'Overhead per batch',
    unit: 'currency',
    group: 'overheads',
    help: 'Workshop space, administration and other costs that do not vary with unit count.',
    min: 0,
    max: 1_000_000_000,
    step: 10_000,
  },
  {
    key: 'platformFeePercent',
    label: 'Platform fee',
    unit: 'percent',
    group: 'commercial',
    help: 'Commission taken on the selling price by any marketplace or channel.',
    min: 0,
    max: 60,
    step: 0.5,
  },
  {
    key: 'targetMarginPercent',
    label: 'Target margin',
    unit: 'percent',
    group: 'commercial',
    help: 'Margin the maker wants to keep, expressed as a share of the selling price.',
    min: 0,
    max: 90,
    step: 1,
  },
];

/**
 * Starting assumptions denominated in IDR.
 *
 * These are illustrative sample values, not measured costs for any workshop.
 * They exist so a first estimate is possible; the assumptions editor tells the
 * user to replace them with their own numbers.
 */
export const SAMPLE_COST_ASSUMPTIONS: Omit<CostAssumptions, 'currency'> = {
  batchSize: 25,
  materialCostPerUnitMinor: 3_500,
  additionalMaterialsPerUnitMinor: 1_200,
  labourMinutesPerUnit: 12,
  labourRatePerHourMinor: 30_000,
  machineMinutesPerUnit: 6,
  machineRatePerHourMinor: 9_000,
  electricityKwhPerUnit: 0.04,
  electricityTariffPerKwhMinor: 1_700,
  cuttingFinishingPerUnitMinor: 800,
  packagingPerUnitMinor: 1_500,
  transportPerBatchMinor: 75_000,
  defectAllowancePercent: 5,
  overheadPerBatchMinor: 150_000,
  platformFeePercent: 8,
  targetMarginPercent: 35,
};

export interface CostLineItem {
  readonly id: CostLineId;
  readonly label: string;
  readonly perUnitMinor: number;
  readonly batchMinor: number;
  /** Human-readable derivation of this line, including the assumption used. */
  readonly basis: string;
  readonly editableAssumptionKeys: readonly AssumptionKey[];
  readonly fixed: boolean;
  /**
   * True for the platform fee, which is charged on the selling price rather
   * than incurred in production, and therefore is not part of `unitCostMinor`.
   */
  readonly excludedFromUnitCost: boolean;
}

export interface RevenueScenario {
  readonly id: 'low' | 'reference' | 'high';
  readonly label: string;
  readonly pricePerUnitMinor: number;
  /** Price less the *fully loaded* unit cost and the platform fee. */
  readonly contributionPerUnitMinor: number;
  /**
   * Price less the *variable* unit cost and the platform fee. This is the figure
   * that break-even consumes, because fixed batch costs are divided by it rather
   * than allocated into it (which would double-count them).
   */
  readonly variableContributionPerUnitMinor: number;
  readonly contributionMarginBps: number | null;
  readonly batchRevenueMinor: number;
  readonly batchContributionMinor: number;
}

export interface CostEstimate {
  readonly currency: CurrencyCode;
  readonly assumptions: CostAssumptions;
  readonly lineItems: readonly CostLineItem[];
  /** Sum of the per-unit variable lines before allowances. */
  readonly variableCostPerUnitMinor: number;
  /**
   * Variable lines plus the defect allowance: every cost that scales with the
   * number of units produced. Break-even is derived from this value.
   */
  readonly variableCostIncludingAllowanceMinor: number;
  /** Fully loaded production cost of one unit, allowances and overhead included. */
  readonly unitCostMinor: number;
  readonly batchCostMinor: number;
  readonly fixedBatchCostMinor: number;
  /** `null` when the fee plus target margin leaves no room for a price. */
  readonly minViablePricePerUnitMinor: number | null;
  readonly priceBandsAvailable: boolean;
  readonly scenarios: readonly RevenueScenario[];
  readonly breakEvenUnits: number | null;
  readonly notes: readonly string[];
  readonly warnings: readonly string[];
  readonly computedAt: IsoDateTime;
}

export interface CostInput {
  readonly assumptions: CostAssumptions;
  readonly priceBands?: PriceBands | null;
  /** Service-supplied derivations, e.g. how the material cost was grossed up. */
  readonly hints?: Partial<Record<CostLineId, string>>;
}
