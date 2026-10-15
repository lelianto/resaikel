import { resolveTemplate, unitPartAreaMm2, type ResolvedTemplate } from '../catalog';
import { nowIso } from '../common';
import { blockingContaminants, isContaminationBlocked } from '../materials/rules';
import { familyOf, MATERIAL_FAMILY_LABELS } from '../materials/types';
import {
  packParts,
  stockUsableAreaMm2,
  type PackingResult,
  type PartToPack,
  type StockPiece,
} from './packing';
import {
  FEASIBILITY_DISCLAIMER,
  type FeasibilityCheck,
  type FeasibilityInput,
  type FeasibilityResult,
  type FeasibilityStatus,
  type ScaledMaterialRequirement,
  type WorkshopCapabilityInput,
} from './types';

const KERF_MM_DEFAULT = 3;
const MAX_UNITS_CAP_DEFAULT = 2_000;

/**
 * Below this stock thickness, an unrecorded thickness is treated as an
 * assumption rather than a blocker, because thin sheet goods are usually
 * recognisable and the template's nominal thickness is a reasonable default.
 * At or above it the product is structural, so a missing measurement stops the
 * evaluation instead of being guessed.
 */
const STRUCTURAL_THICKNESS_MM = 6;

interface SheetCountDerivation {
  readonly sheets: number;
  readonly assumption: string | null;
}

/**
 * Converts a recorded quantity into a number of usable sheets. Mass cannot be
 * converted without a density measurement, so that case is recorded as an
 * explicit assumption rather than silently invented.
 */
function deriveSheetCount(input: FeasibilityInput['material']): SheetCountDerivation {
  const usable = Math.max(0, input.quantityValue - input.reservedQuantity);
  if (usable <= 0) return { sheets: 0, assumption: null };

  if (input.quantityUnit === 'piece' || input.quantityUnit === 'sheet') {
    return { sheets: Math.floor(usable), assumption: null };
  }

  if (input.quantityUnit === 'm2') {
    const { lengthMm, widthMm } = input;
    if (!lengthMm || !widthMm) return { sheets: 0, assumption: null };
    const perSheetM2 = (lengthMm * widthMm) / 1_000_000;
    if (perSheetM2 <= 0) return { sheets: 0, assumption: null };
    return {
      sheets: Math.floor(usable / perSheetM2),
      assumption:
        `Quantity was recorded as ${usable} m² and converted using ${perSheetM2.toFixed(4)} m² ` +
        'per sheet.',
    };
  }

  const sheets = Math.floor(usable);
  return {
    sheets,
    assumption:
      `Quantity was recorded by mass (${usable} kg). Without a density measurement it cannot be ` +
      `converted to sheet count, so ${sheets} sheet(s) were assumed.`,
  };
}

/** Area-based upper bound on how many units could possibly fit. */
function areaUpperBound(
  resolved: ResolvedTemplate,
  stock: readonly StockPiece[],
  kerfMm: number,
  cap: number,
): number {
  const usable = stockUsableAreaMm2(stock);
  const perUnit = resolved.parts.reduce(
    (total, part) =>
      total +
      part.quantityPerUnit * (part.lengthMm + kerfMm) * (part.widthMm + kerfMm),
    0,
  );
  if (perUnit <= 0 || usable <= 0) return 0;
  return Math.min(cap, Math.floor(usable / perUnit));
}

/** Maps resolved parts to the packer's input shape for `units` finished units. */
function packableParts(resolved: ResolvedTemplate, units: number): PartToPack[] {
  return resolved.parts.map((part) => ({
    id: part.partId,
    name: part.name,
    lengthMm: part.lengthMm,
    widthMm: part.widthMm,
    quantity: part.quantityPerUnit * units,
    rotatable: part.rotatable,
  }));
}

interface CapacityComputation {
  readonly maxUnits: number;
  readonly packing: PackingResult | null;
  readonly unitsPerSheet: number | null;
}

function computeCapacity(
  resolved: ResolvedTemplate,
  stock: readonly StockPiece[],
  kerfMm: number,
  cap: number,
): CapacityComputation {
  const upper = areaUpperBound(resolved, stock, kerfMm, cap);

  if (upper <= 0) {
    const packing = packParts({
      stock,
      parts: packableParts(resolved, 1),
      kerfMm,
    });
    return { maxUnits: 0, packing, unitsPerSheet: null };
  }

  let low = 1;
  let high = upper;
  let bestUnits = 0;
  let bestPacking: PackingResult | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const attempt = packParts({
      stock,
      parts: packableParts(resolved, mid),
      kerfMm,
    });

    if (attempt.unplaced.length === 0 && attempt.limitReached === false) {
      bestUnits = mid;
      bestPacking = attempt;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestPacking === null) {
    const packing = packParts({ stock, parts: packableParts(resolved, 1), kerfMm });
    return { maxUnits: 0, packing, unitsPerSheet: null };
  }

  return {
    maxUnits: bestUnits,
    packing: bestPacking,
    unitsPerSheet: Math.round((bestUnits / Math.max(1, bestPacking.stockConsumed)) * 100) / 100,
  };
}

function capabilityNote(capability: WorkshopCapabilityInput | null | undefined): string {
  return capability
    ? `Capability profile "${capability.name}" was used for the tool and process checks.`
    : 'No workshop capability profile was supplied, so tooling and process steps could not be verified.';
}

/**
 * The deterministic feasibility engine.
 *
 * Every gate is evaluated and reported, even when an earlier gate has already
 * decided the outcome, so the UI can explain *all* the reasons a product is or
 * is not viable rather than only the first one encountered.
 */
export function evaluateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const { template, material, capability } = input;
  const kerfMm = input.options?.kerfMm ?? KERF_MM_DEFAULT;
  const cap = input.options?.maxUnitsCap ?? MAX_UNITS_CAP_DEFAULT;

  const checks: FeasibilityCheck[] = [];
  const rejectReasons: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [
    `Blade kerf of ${kerfMm} mm is deducted on every cut.`,
    'Corner areas lost to guillotine splitting are counted as waste, so the yield is deliberately pessimistic.',
  ];

  const resolved = resolveTemplate(template, input.parameters);
  const family = familyOf(material.category);

  // ---------------------------------------------------------------- gate 1: verified
  checks.push({
    id: 'material_verified',
    label: 'Material properties confirmed by a person',
    outcome: material.verified ? 'pass' : 'fail',
    detail: material.verified
      ? 'The owner confirmed category, dimensions and quantity.'
      : 'The material has not been confirmed. Photographs cannot establish physical dimensions, ' +
        'so nothing is evaluated until a person signs off the properties.',
  });
  if (!material.verified) {
    rejectReasons.push('Confirm the material properties before evaluating production.');
  }

  // ---------------------------------------------------------------- gate 2: family
  const familyKnown = material.category !== 'unknown';
  const familyCompatible = familyKnown && template.materialFamilies.includes(family);
  checks.push({
    id: 'material_family',
    label: 'Material family suits this product',
    outcome: !familyKnown ? 'fail' : familyCompatible ? 'pass' : 'fail',
    detail: !familyKnown
      ? 'The material category is unknown, so no validated specification can be matched.'
      : familyCompatible
        ? `${MATERIAL_FAMILY_LABELS[family]} is a supported input for ${template.name}.`
        : `${template.name} is specified for ${template.materialFamilies
            .map((entry) => MATERIAL_FAMILY_LABELS[entry])
            .join(', ')}, not ${MATERIAL_FAMILY_LABELS[family]}.`,
  });
  if (familyKnown && !familyCompatible) {
    rejectReasons.push(
      `The material is ${MATERIAL_FAMILY_LABELS[family]} but this product requires ` +
        `${template.materialFamilies.map((entry) => MATERIAL_FAMILY_LABELS[entry]).join(' or ')}.`,
    );
  }

  // ---------------------------------------------------------------- gate 3: dimensions
  const hasPlanDimensions =
    material.lengthMm !== null && material.lengthMm > 0 && material.widthMm !== null && material.widthMm > 0;

  checks.push({
    id: 'material_dimensions',
    label: 'Sheet length and width confirmed',
    outcome: hasPlanDimensions ? 'pass' : 'fail',
    detail: hasPlanDimensions
      ? `Sheet recorded as ${material.lengthMm} x ${material.widthMm} mm.`
      : 'Length and width are missing. These cannot be read from a photograph and must be measured.',
  });
  if (!hasPlanDimensions) {
    rejectReasons.push('Measure and confirm the sheet length and width.');
  }

  // ---------------------------------------------------------------- gate 4: thickness
  const minThickness = template.minStockMm.thicknessMm ?? null;
  let thicknessNeedsMeasurement = false;
  let thicknessTooThin = false;
  if (minThickness !== null) {
    const structural = minThickness >= STRUCTURAL_THICKNESS_MM;
    if (material.thicknessMm === null || material.thicknessMm <= 0) {
      if (structural) {
        thicknessNeedsMeasurement = true;
        checks.push({
          id: 'material_thickness',
          label: 'Sheet thickness confirmed',
          outcome: 'fail',
          detail: `${template.name} carries structural load and needs at least ${minThickness} mm. ` +
            'Thickness was not measured, so this cannot be evaluated.',
        });
        rejectReasons.push(`Measure the sheet thickness; at least ${minThickness} mm is required.`);
      } else {
        assumptions.push(
          `Sheet thickness was not recorded. The template's nominal thickness ` +
            `(${resolved.parts[0]?.thicknessMm ?? 0} mm) is assumed instead of the ${minThickness} mm minimum.`,
        );
        checks.push({
          id: 'material_thickness',
          label: 'Sheet thickness confirmed',
          outcome: 'warn',
          detail: `Not measured. Assuming the nominal template thickness; the minimum is ${minThickness} mm.`,
        });
      }
    } else if (material.thicknessMm < minThickness) {
      thicknessTooThin = true;
      checks.push({
        id: 'material_thickness',
        label: 'Sheet thickness confirmed',
        outcome: 'fail',
        detail: `Recorded thickness is ${material.thicknessMm} mm but ${minThickness} mm is required.`,
      });
      rejectReasons.push(
        `The sheet is ${material.thicknessMm} mm thick; this product needs at least ${minThickness} mm.`,
      );
    } else {
      checks.push({
        id: 'material_thickness',
        label: 'Sheet thickness confirmed',
        outcome: 'pass',
        detail: `${material.thicknessMm} mm meets the ${minThickness} mm minimum.`,
      });
    }
  } else {
    checks.push({
      id: 'material_thickness',
      label: 'Sheet thickness confirmed',
      outcome: 'skipped',
      detail: 'This product has no minimum thickness requirement.',
    });
  }

  // ---------------------------------------------------------------- gate 5: condition
  const contaminants = blockingContaminants(material.contamination);
  const contaminated = isContaminationBlocked(material.contamination);
  checks.push({
    id: 'material_condition',
    label: 'Condition and contamination are workable',
    outcome: contaminated ? 'fail' : material.condition === 'poor' ? 'warn' : 'pass',
    detail: contaminated
      ? `Blocking contamination recorded: ${contaminants.join(', ')}.`
      : material.condition === 'poor'
        ? 'Condition is poor, so a lower yield than the calculated maximum should be expected.'
        : 'No blocking contamination is recorded.',
  });
  if (contaminated) {
    rejectReasons.push(
      `Clean or reclassify the material first. Recorded contamination (${contaminants.join(', ')}) ` +
        'makes it unsuitable for consumer products.',
    );
  }
  if (!contaminated && material.condition === 'poor') {
    warnings.push('Poor condition means real-world yield will be below the calculated maximum.');
  }
  if (material.defects.length > 0) {
    assumptions.push(
      'Defect positions were not recorded as coordinates, so defects are not excluded from the ' +
        'nesting area. Reduce the expected yield accordingly.',
    );
    warnings.push(`${material.defects.length} defect(s) recorded but not excluded from the layout.`);
  }

  // ---------------------------------------------------------------- gate 6: stock & fit
  const derived = deriveSheetCount(material);
  if (derived.assumption) assumptions.push(derived.assumption);

  const stock: StockPiece[] =
    hasPlanDimensions && derived.sheets > 0
      ? [
          {
            id: 'material',
            label: `${material.lengthMm} x ${material.widthMm} mm sheet`,
            lengthMm: material.lengthMm ?? 0,
            widthMm: material.widthMm ?? 0,
            quantity: derived.sheets,
          },
        ]
      : [];

  let fitFailures: string[] = [];
  if (hasPlanDimensions) {
    fitFailures = resolved.parts
      .filter((part) => part.quantityPerUnit > 0)
      .filter((part) => {
        const sheetLength = material.lengthMm ?? 0;
        const sheetWidth = material.widthMm ?? 0;
        const fitsStraight = part.lengthMm <= sheetLength && part.widthMm <= sheetWidth;
        const fitsRotated =
          part.rotatable && part.widthMm <= sheetLength && part.lengthMm <= sheetWidth;
        return !fitsStraight && !fitsRotated;
      })
      .map(
        (part) =>
          `"${part.name}" needs a ${part.lengthMm} x ${part.widthMm} mm panel, which is larger ` +
          `than the ${material.lengthMm} x ${material.widthMm} mm sheet in either orientation.`,
      );
  }

  const tooSmallForMinimum =
    hasPlanDimensions &&
    ((material.lengthMm ?? 0) < template.minStockMm.lengthMm ||
      (material.widthMm ?? 0) < template.minStockMm.widthMm);

  checks.push({
    id: 'stock_fit',
    label: 'Every required panel fits on the sheet',
    outcome: !hasPlanDimensions ? 'skipped' : fitFailures.length === 0 ? 'pass' : 'fail',
    detail: !hasPlanDimensions
      ? 'Skipped because the sheet dimensions are unknown.'
      : fitFailures.length === 0
        ? `All ${resolved.parts.length} panel type(s) fit within ${material.lengthMm} x ${material.widthMm} mm.`
        : fitFailures.join(' '),
  });
  rejectReasons.push(...fitFailures);

  if (tooSmallForMinimum && fitFailures.length === 0) {
    rejectReasons.push(
      `The sheet (${material.lengthMm} x ${material.widthMm} mm) is below this product's minimum ` +
        `stock size of ${template.minStockMm.lengthMm} x ${template.minStockMm.widthMm} mm.`,
    );
  }

  if (derived.sheets === 0) {
    rejectReasons.push('No available material quantity remains after reservations.');
  }

  // ---------------------------------------------------------------- gate 7: capacity
  // Capacity is only meaningful once the material family is compatible: nesting
  // a plywood sheet into a cardboard dieline would produce a number that means
  // nothing, and reporting it would be worse than reporting nothing.
  const canAttemptCapacity =
    familyCompatible && hasPlanDimensions && derived.sheets > 0 && fitFailures.length === 0;

  const capacityComputation = canAttemptCapacity
    ? computeCapacity(resolved, stock, kerfMm, cap)
    : { maxUnits: 0, packing: null, unitsPerSheet: null };

  const unitLayoutPacking =
    hasPlanDimensions && familyCompatible
      ? packParts({
          stock: stock.length > 0 ? stock : [],
          parts: packableParts(resolved, 1),
          kerfMm,
        })
      : null;

  checks.push({
    id: 'capacity',
    label: 'Stock yields at least one unit',
    outcome: !canAttemptCapacity ? 'skipped' : capacityComputation.maxUnits > 0 ? 'pass' : 'fail',
    detail: !canAttemptCapacity
      ? 'Skipped because the sheet does not satisfy the earlier constraints.'
      : capacityComputation.maxUnits > 0
        ? `Up to ${capacityComputation.maxUnits} unit(s) fit across ` +
          `${capacityComputation.packing?.stockConsumed ?? 0} sheet(s) with ` +
          `${capacityComputation.packing?.wastePercent ?? 0}% cutting waste.`
        : 'The panels do not fit the available sheets at any quantity. ' +
          (capacityComputation.packing?.unplaced[0]?.reason ?? ''),
  });

  if (canAttemptCapacity && capacityComputation.maxUnits === 0) {
    rejectReasons.push(
      'The available sheet area does not yield even one complete unit at this kerf and panel size.',
    );
  }

  // ---------------------------------------------------------------- gate 8: tooling
  const requiredTools = template.requiredTools;
  const missingTools = capability
    ? requiredTools.filter((tool) => !capability.tools.includes(tool))
    : [];
  const missingProcesses =
    capability && capability.processes.length > 0
      ? template.processes.filter((process) => !capability.processes.includes(process))
      : [];

  checks.push({
    id: 'tooling',
    label: 'Required tools are available',
    outcome: !capability ? 'skipped' : missingTools.length === 0 ? 'pass' : 'warn',
    detail: !capability
      ? capabilityNote(capability)
      : missingTools.length === 0
        ? `All ${requiredTools.length} required tool(s) are listed in the workshop profile.`
        : `Missing: ${missingTools.join(', ')}. The process may still be possible with ` +
          'equivalent equipment.',
  });
  if (missingTools.length > 0) {
    warnings.push(
      `${missingTools.length} required tool(s) are not listed in the workshop profile.`,
    );
  }

  const familyUnsupportedByWorkshop =
    capability !== undefined &&
    capability !== null &&
    capability.supportedFamilies.length > 0 &&
    !capability.supportedFamilies.includes(family);

  if (familyUnsupportedByWorkshop && capability) {
    warnings.push(
      `The workshop profile does not list ${MATERIAL_FAMILY_LABELS[family]} as a supported material.`,
    );
    checks.push({
      id: 'workshop_material',
      label: 'Workshop supports this material family',
      outcome: 'warn',
      detail: `The profile lists ${capability.supportedFamilies
        .map((entry) => MATERIAL_FAMILY_LABELS[entry])
        .join(', ') || 'no materials'}.`,
    });
  }

  // ---------------------------------------------------------------- status
  const missingInformation =
    !material.verified || !familyKnown || !hasPlanDimensions || thicknessNeedsMeasurement;

  let status: FeasibilityStatus;
  if (missingInformation) {
    status = 'not_evaluated';
  } else if (
    !familyCompatible ||
    contaminated ||
    thicknessTooThin ||
    fitFailures.length > 0 ||
    capacityComputation.maxUnits === 0
  ) {
    status = 'not_feasible';
  } else if (!capability) {
    status = 'geometrically_feasible';
  } else if (
    missingTools.length > 0 ||
    missingProcesses.length > 0 ||
    familyUnsupportedByWorkshop ||
    material.condition === 'poor' ||
    material.defects.length > 0
  ) {
    status = 'conditionally_feasible';
  } else {
    status = 'process_feasible';
  }

  const packing = capacityComputation.packing;
  const additionalMaterials: ScaledMaterialRequirement[] = template.additionalMaterials.map(
    (requirement) => {
      const totalQuantity =
        Math.round(requirement.quantityPerUnit * capacityComputation.maxUnits * 1000) / 1000;
      return {
        ...requirement,
        totalQuantity,
        estimatedCostMinor: Math.round(totalQuantity * requirement.unitCostMinor),
      };
    },
  );

  const limitingFactor =
    capacityComputation.maxUnits > 0
      ? `Sheet area supports at most ${capacityComputation.maxUnits} unit(s) at a ` +
        `${packing?.wastePercent ?? 0}% cutting waste rate.`
      : (rejectReasons[0] ?? 'No limiting factor could be determined.');

  return {
    templateId: template.id,
    templateName: template.name,
    validationLevel: template.validationLevel,
    status,
    checks,
    capacity: {
      maxUnits: capacityComputation.maxUnits,
      sheetsRequired: packing?.stockConsumed ?? 0,
      sheetsAvailable: derived.sheets,
      unitsPerSheet: capacityComputation.unitsPerSheet,
      wastePercent: packing?.wastePercent ?? 0,
      usedAreaMm2: packing?.usedAreaMm2 ?? 0,
      totalStockAreaMm2: packing?.totalStockAreaMm2 ?? 0,
    },
    unplaced: packing?.unplaced ?? [],
    unitLayout: unitLayoutPacking?.stockUsage ?? [],
    unitParts: resolved.parts.map((part) => ({
      partId: part.partId,
      name: part.name,
      quantity: part.quantityPerUnit,
    })),
    resolvedParts: resolved.parts.map((part) => ({
      partId: part.partId,
      name: part.name,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      thicknessMm: part.thicknessMm,
      quantityPerUnit: part.quantityPerUnit,
    })),
    resolvedParameters: resolved.parameters,
    additionalMaterials,
    packagingChecklist: template.packagingChecklist.map((item) => ({
      id: item.id,
      label: item.label,
      required: item.required,
      // Never auto-satisfied: resaikel does not claim packaging compliance.
      satisfied: null,
    })),
    missingTools,
    missingProcesses,
    rejectReasons: [...new Set(rejectReasons)],
    warnings: [...new Set(warnings)],
    assumptions,
    limitingFactor,
    disclaimer: FEASIBILITY_DISCLAIMER,
    kerfMm,
    evaluatedAt: nowIso(),
  };
}

/** Unit flat-area demand, exposed for the ranking engine's utilisation score. */
export function unitMaterialDemandMm2(resolved: ResolvedTemplate): number {
  return unitPartAreaMm2(resolved);
}
