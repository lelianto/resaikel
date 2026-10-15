import { nowIso } from '../common';
import {
  breakEvenUnits,
  contributionMarginBps,
  money,
  scaleByRatio,
  scaleByRatioUp,
  type Money,
} from '../money';
import {
  COST_ASSUMPTION_DESCRIPTORS,
  COST_LINE_LABELS,
  SAMPLE_COST_ASSUMPTIONS,
  type AssumptionDescriptor,
  type AssumptionKey,
  type CostAssumptions,
  type CostEstimate,
  type CostInput,
  type CostLineItem,
  type RevenueScenario,
} from './types';

/** Hourly rate applied to a duration in minutes, as one exact rational step. */
function rateForMinutes(
  ratePerHourMinor: number,
  minutes: number,
  currency: string,
): number {
  if (ratePerHourMinor <= 0 || minutes <= 0) return 0;
  return scaleByRatio(money(ratePerHourMinor, currency), minutes, 60).amount;
}

/** Per-unit share of a fixed batch cost, rounded up. */
function perUnitShare(batchMinor: number, batchSize: number, currency: string): number {
  if (batchMinor <= 0 || batchSize <= 0) return 0;
  return unitCeil(batchMinor, batchSize, currency);
}

function unitCeil(totalMinor: number, units: number, currency: string): number {
  if (units <= 0) return 0;
  return scaleByRatioUp(money(totalMinor, currency), 1, units).amount;
}

function percentOfAmount(amountMinor: number, percent: number, currency: string): number {
  if (amountMinor <= 0 || percent <= 0) return 0;
  return scaleByRatio(money(amountMinor, currency), Math.round(percent * 100), 10_000).amount;
}

export function defaultCostAssumptions(currency: string): CostAssumptions {
  return { currency, ...SAMPLE_COST_ASSUMPTIONS };
}

/**
 * Merges the sample defaults, catalogue-derived values and any caller overrides
 * into a complete assumption set. Overrides are clamped to the descriptor bounds
 * so a bad value can never produce a nonsense estimate.
 */
export function buildCostAssumptions(input: {
  currency: string;
  labourMinutesPerUnit?: number;
  additionalMaterialsPerUnitMinor?: number;
  materialCostPerUnitMinor?: number;
  overrides?: Partial<Record<AssumptionKey, number>>;
}): AssumptionOverrideResult {
  const base = defaultCostAssumptions(input.currency);

  const seeded: CostAssumptions = {
    ...base,
    ...(input.labourMinutesPerUnit !== undefined
      ? { labourMinutesPerUnit: input.labourMinutesPerUnit }
      : {}),
    ...(input.additionalMaterialsPerUnitMinor !== undefined
      ? { additionalMaterialsPerUnitMinor: input.additionalMaterialsPerUnitMinor }
      : {}),
    ...(input.materialCostPerUnitMinor !== undefined
      ? { materialCostPerUnitMinor: input.materialCostPerUnitMinor }
      : {}),
  };

  return applyAssumptionOverrides(seeded, input.overrides ?? {});
}

export interface AssumptionOverrideResult {
  readonly assumptions: CostAssumptions;
  readonly issues: readonly string[];
}

export function applyAssumptionOverrides(
  base: CostAssumptions,
  overrides: Partial<Record<AssumptionKey, number>>,
): AssumptionOverrideResult {
  const issues: string[] = [];
  const next: CostAssumptions = { ...base };

  for (const descriptor of COST_ASSUMPTION_DESCRIPTORS) {
    const raw = overrides[descriptor.key];
    if (raw === undefined) continue;

    if (!Number.isFinite(raw)) {
      issues.push(`${descriptor.label} was not a number and was ignored.`);
      continue;
    }

    const clamped = Math.min(descriptor.max, Math.max(descriptor.min, raw));
    if (clamped !== raw) {
      issues.push(
        `${descriptor.label} (${raw}) is outside ${descriptor.min}–${descriptor.max} and was clamped.`,
      );
    }

    // Assignment is safe: every descriptor key maps to a numeric field.
    (next as Record<AssumptionKey, number>)[descriptor.key] = clamped;
  }

  return { assumptions: next, issues };
}

export function descriptorFor(key: AssumptionKey): AssumptionDescriptor | undefined {
  return COST_ASSUMPTION_DESCRIPTORS.find((descriptor) => descriptor.key === key);
}

function withHint(base: string, hint: string | undefined): string {
  return hint ? `${base} ${hint}` : base;
}

/**
 * Computes the production cost estimate.
 *
 * The platform fee is deliberately excluded from `unitCostMinor`: it is charged
 * on the selling price, so folding it into production cost would be circular and
 * would overstate what it actually costs to make the product.
 */
export function computeCost(input: CostInput): CostEstimate {
  const assumptions = input.assumptions;
  const currency = assumptions.currency;
  const hints = input.hints ?? {};
  const batchSize = Math.max(1, Math.floor(assumptions.batchSize));

  const notes: string[] = [];
  const warnings: string[] = [];

  const labourPerUnit = rateForMinutes(
    assumptions.labourRatePerHourMinor,
    assumptions.labourMinutesPerUnit,
    currency,
  );
  const machinePerUnit = rateForMinutes(
    assumptions.machineRatePerHourMinor,
    assumptions.machineMinutesPerUnit,
    currency,
  );
  const electricityPerUnit =
    assumptions.electricityKwhPerUnit > 0 && assumptions.electricityTariffPerKwhMinor > 0
      ? scaleByRatio(
          money(assumptions.electricityTariffPerKwhMinor, currency),
          Math.round(assumptions.electricityKwhPerUnit * 1_000),
          1_000,
        ).amount
      : 0;

  const overheadPerUnit = perUnitShare(assumptions.overheadPerBatchMinor, batchSize, currency);
  const transportPerUnit = perUnitShare(assumptions.transportPerBatchMinor, batchSize, currency);

  const variableSubtotal =
    assumptions.materialCostPerUnitMinor +
    assumptions.additionalMaterialsPerUnitMinor +
    labourPerUnit +
    machinePerUnit +
    electricityPerUnit +
    assumptions.cuttingFinishingPerUnitMinor +
    assumptions.packagingPerUnitMinor;

  const defectAllowancePerUnit = percentOfAmount(
    variableSubtotal,
    assumptions.defectAllowancePercent,
    currency,
  );

  const variableCostIncludingAllowanceMinor = variableSubtotal + defectAllowancePerUnit;
  const unitCostMinor = variableCostIncludingAllowanceMinor + overheadPerUnit + transportPerUnit;
  const batchCostMinor = unitCostMinor * batchSize;
  const fixedBatchCostMinor =
    assumptions.overheadPerBatchMinor + assumptions.transportPerBatchMinor;

  const combinedFeePercent = assumptions.platformFeePercent + assumptions.targetMarginPercent;
  const priceCeilingHundredths = 10_000 - Math.round(combinedFeePercent * 100);
  const minViablePricePerUnitMinor =
    priceCeilingHundredths > 0
      ? Math.ceil((unitCostMinor * 10_000) / priceCeilingHundredths)
      : null;

  if (minViablePricePerUnitMinor === null) {
    warnings.push(
      `The platform fee (${assumptions.platformFeePercent}%) and target margin ` +
        `(${assumptions.targetMarginPercent}%) together reach 100%, so no selling price can cover ` +
        'the production cost. Reduce one of them.',
    );
  } else if (combinedFeePercent >= 85) {
    warnings.push(
      `The platform fee and target margin together consume ${combinedFeePercent}% of the price, ` +
        'leaving very little room for production cost.',
    );
  }

  const feeBaseMinor = input.priceBands?.referenceMinor ?? minViablePricePerUnitMinor ?? null;
  const platformFeePerUnit = feeBaseMinor
    ? percentOfAmount(feeBaseMinor, assumptions.platformFeePercent, currency)
    : 0;

  if (feeBaseMinor === null) {
    notes.push(
      'The platform fee could not be quantified because there is no selling price to charge it on.',
    );
  } else if (input.priceBands?.referenceMinor === undefined && minViablePricePerUnitMinor !== null) {
    notes.push(
      'The platform fee is shown against the minimum viable price, because no market reference ' +
        'price is available yet.',
    );
  }

  const lineItems: CostLineItem[] = [
    {
      id: 'material',
      label: COST_LINE_LABELS.material,
      perUnitMinor: assumptions.materialCostPerUnitMinor,
      batchMinor: assumptions.materialCostPerUnitMinor * batchSize,
      basis: withHint(
        `Assumption: ${assumptions.materialCostPerUnitMinor} per unit.`,
        hints.material,
      ),
      editableAssumptionKeys: ['materialCostPerUnitMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'additional_materials',
      label: COST_LINE_LABELS.additional_materials,
      perUnitMinor: assumptions.additionalMaterialsPerUnitMinor,
      batchMinor: assumptions.additionalMaterialsPerUnitMinor * batchSize,
      basis: withHint(
        `Assumption: ${assumptions.additionalMaterialsPerUnitMinor} per unit.`,
        hints.additional_materials,
      ),
      editableAssumptionKeys: ['additionalMaterialsPerUnitMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'labour',
      label: COST_LINE_LABELS.labour,
      perUnitMinor: labourPerUnit,
      batchMinor: labourPerUnit * batchSize,
      basis:
        `${assumptions.labourMinutesPerUnit} min/unit at ${assumptions.labourRatePerHourMinor}/hour ` +
        `= ${labourPerUnit} per unit.`,
      editableAssumptionKeys: ['labourMinutesPerUnit', 'labourRatePerHourMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'machine',
      label: COST_LINE_LABELS.machine,
      perUnitMinor: machinePerUnit,
      batchMinor: machinePerUnit * batchSize,
      basis:
        `${assumptions.machineMinutesPerUnit} min/unit at ${assumptions.machineRatePerHourMinor}/hour ` +
        `= ${machinePerUnit} per unit. Excludes power.`,
      editableAssumptionKeys: ['machineMinutesPerUnit', 'machineRatePerHourMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'electricity',
      label: COST_LINE_LABELS.electricity,
      perUnitMinor: electricityPerUnit,
      batchMinor: electricityPerUnit * batchSize,
      basis:
        `${assumptions.electricityKwhPerUnit} kWh/unit at ${assumptions.electricityTariffPerKwhMinor} ` +
        `per kWh = ${electricityPerUnit} per unit.`,
      editableAssumptionKeys: ['electricityKwhPerUnit', 'electricityTariffPerKwhMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'cutting_finishing',
      label: COST_LINE_LABELS.cutting_finishing,
      perUnitMinor: assumptions.cuttingFinishingPerUnitMinor,
      batchMinor: assumptions.cuttingFinishingPerUnitMinor * batchSize,
      basis: `Assumption: ${assumptions.cuttingFinishingPerUnitMinor} per unit.`,
      editableAssumptionKeys: ['cuttingFinishingPerUnitMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'packaging',
      label: COST_LINE_LABELS.packaging,
      perUnitMinor: assumptions.packagingPerUnitMinor,
      batchMinor: assumptions.packagingPerUnitMinor * batchSize,
      basis: `Assumption: ${assumptions.packagingPerUnitMinor} per unit.`,
      editableAssumptionKeys: ['packagingPerUnitMinor'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'defect_allowance',
      label: COST_LINE_LABELS.defect_allowance,
      perUnitMinor: defectAllowancePerUnit,
      batchMinor: defectAllowancePerUnit * batchSize,
      basis:
        `${assumptions.defectAllowancePercent}% of the ${variableSubtotal} variable cost per unit ` +
        `= ${defectAllowancePerUnit}.`,
      editableAssumptionKeys: ['defectAllowancePercent'],
      fixed: false,
      excludedFromUnitCost: false,
    },
    {
      id: 'overhead',
      label: COST_LINE_LABELS.overhead,
      perUnitMinor: overheadPerUnit,
      batchMinor: assumptions.overheadPerBatchMinor,
      basis:
        `${assumptions.overheadPerBatchMinor} per batch spread across ${batchSize} units ` +
        `= ${overheadPerUnit} per unit.`,
      editableAssumptionKeys: ['overheadPerBatchMinor', 'batchSize'],
      fixed: true,
      excludedFromUnitCost: false,
    },
    {
      id: 'transport',
      label: COST_LINE_LABELS.transport,
      perUnitMinor: transportPerUnit,
      batchMinor: assumptions.transportPerBatchMinor,
      basis:
        `${assumptions.transportPerBatchMinor} per batch spread across ${batchSize} units ` +
        `= ${transportPerUnit} per unit.`,
      editableAssumptionKeys: ['transportPerBatchMinor', 'batchSize'],
      fixed: true,
      excludedFromUnitCost: false,
    },
    {
      id: 'platform_fee',
      label: COST_LINE_LABELS.platform_fee,
      perUnitMinor: platformFeePerUnit,
      batchMinor: platformFeePerUnit * batchSize,
      basis:
        `${assumptions.platformFeePercent}% of the ` +
        `${input.priceBands?.referenceMinor !== undefined ? 'reference market price' : 'minimum viable price'} ` +
        `${feeBaseMinor ?? 0} = ${platformFeePerUnit} per unit. Charged on the sale, not on production.`,
      editableAssumptionKeys: ['platformFeePercent'],
      fixed: false,
      excludedFromUnitCost: true,
    },
  ];

  const scenarios = buildScenarios(
    input,
    unitCostMinor,
    variableCostIncludingAllowanceMinor,
    assumptions.platformFeePercent,
    batchSize,
    currency,
  );
  const referenceScenario = scenarios.find((scenario) => scenario.id === 'reference');

  // Break-even divides the fixed batch cost by the *variable* contribution, so
  // the fixed cost is counted exactly once.
  const breakEven =
    referenceScenario && fixedBatchCostMinor > 0
      ? breakEvenUnits(
          money(fixedBatchCostMinor, currency),
          money(referenceScenario.variableContributionPerUnitMinor, currency),
        )
      : null;

  if (breakEven === null && fixedBatchCostMinor > 0 && referenceScenario) {
    warnings.push(
      'Break-even cannot be reached at the reference price because each unit fails to cover its ' +
        'own variable cost.',
    );
  }
  if (referenceScenario && referenceScenario.contributionPerUnitMinor < 0) {
    warnings.push(
      'At the reference market price this product does not cover its production cost. Change the ' +
        'specification, the assumptions, or the target buyer.',
    );
  }
  if (assumptions.labourRatePerHourMinor === 0) {
    warnings.push('Labour is valued at zero, so this estimate covers cash costs only.');
  }
  if (assumptions.materialCostPerUnitMinor === 0) {
    warnings.push(
      'Material opportunity cost is zero. If the offcuts have a value in another use, add it.',
    );
  }
  if (assumptions.defectAllowancePercent === 0) {
    warnings.push('No defect allowance is set, which assumes every unit comes out perfect.');
  }

  notes.push(
    'Every figure here is derived from the assumptions listed alongside it. None of them are ' +
      'measured costs for a specific workshop.',
  );
  notes.push(
    'The platform fee is charged on the selling price and is therefore excluded from the ' +
      'production cost per unit.',
  );
  if (scenarios.length === 0) {
    notes.push(
      'No selling-price scenario is shown because there is no usable market evidence for this ' +
        'product category.',
    );
  }

  return {
    currency,
    assumptions: { ...assumptions, batchSize },
    lineItems,
    variableCostPerUnitMinor: variableSubtotal,
    variableCostIncludingAllowanceMinor,
    unitCostMinor,
    batchCostMinor,
    fixedBatchCostMinor,
    minViablePricePerUnitMinor,
    priceBandsAvailable: input.priceBands !== null && input.priceBands !== undefined,
    scenarios,
    breakEvenUnits: breakEven,
    notes,
    warnings,
    computedAt: nowIso(),
  };
}

function buildScenarios(
  input: CostInput,
  unitCostMinor: number,
  variableCostPerUnitMinor: number,
  platformFeePercent: number,
  batchSize: number,
  currency: string,
): RevenueScenario[] {
  const bands = input.priceBands;
  if (!bands) return [];

  const definitions: readonly { id: RevenueScenario['id']; label: string; price: number }[] = [
    { id: 'low', label: 'Low estimate', price: bands.lowMinor },
    { id: 'reference', label: 'Reference estimate', price: bands.referenceMinor },
    { id: 'high', label: 'High estimate', price: bands.highMinor },
  ];

  return definitions.map((definition) => {
    const platformFee = percentOfAmount(definition.price, platformFeePercent, currency);
    const totalCost = unitCostMinor + platformFee;
    const contributionPerUnitMinor = definition.price - totalCost;
    const variableContributionPerUnitMinor =
      definition.price - variableCostPerUnitMinor - platformFee;

    return {
      id: definition.id,
      label: definition.label,
      pricePerUnitMinor: definition.price,
      contributionPerUnitMinor,
      variableContributionPerUnitMinor,
      contributionMarginBps: contributionMarginBps(
        money(totalCost, currency),
        money(definition.price, currency),
      ),
      batchRevenueMinor: definition.price * batchSize,
      batchContributionMinor: contributionPerUnitMinor * batchSize,
    };
  });
}

/** Convenience for the UI: the total of a set of line items, excluding fees. */
export function totalsFor(lines: readonly CostLineItem[]): {
  variable: number;
  fixed: number;
  fee: number;
} {
  let variable = 0;
  let fixed = 0;
  let fee = 0;
  for (const line of lines) {
    if (line.id === 'platform_fee') fee += line.batchMinor;
    else if (line.fixed) fixed += line.perUnitMinor;
    else variable += line.perUnitMinor;
  }
  return { variable, fixed, fee };
}

export type { Money };
