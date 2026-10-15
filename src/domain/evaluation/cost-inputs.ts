import type { FeasibilityResult } from '../feasibility/types';

/**
 * Shared cost inputs derived from a feasibility result.
 *
 * Extracted so that the discovery service and the sample scenarios on the landing
 * page cannot drift apart: the material gross-up in particular is the kind of
 * formula that quietly diverges if it is written twice.
 */

/** Indicative value of reclaimed sheet, in minor units per m². Editable assumption. */
export const SAMPLE_MATERIAL_PRICE_PER_M2_MINOR = 15_000;

export interface DerivedCostInput {
  readonly amountMinor: number;
  readonly basis: string;
}

/**
 * Material opportunity cost per finished unit, grossed up for cutting waste.
 *
 * Waste is applied here rather than inside the cost engine because the engine
 * takes a ready per-unit figure and the yield is only known after nesting.
 */
export function materialCostPerUnit(
  feasibility: FeasibilityResult,
  pricePerM2Minor: number = SAMPLE_MATERIAL_PRICE_PER_M2_MINOR,
): DerivedCostInput {
  const areaM2 =
    feasibility.resolvedParts.reduce(
      (total, part) => total + part.lengthMm * part.widthMm * part.quantityPerUnit,
      0,
    ) / 1_000_000;

  const raw = Math.ceil(areaM2 * pricePerM2Minor);
  const waste = feasibility.capacity.wastePercent;

  if (waste <= 0 || waste >= 100) {
    return {
      amountMinor: raw,
      basis:
        `Assumes ${pricePerM2Minor} per m² of reclaimed sheet, applied to ${areaM2.toFixed(4)} m² ` +
        'of parts per unit.',
    };
  }

  const grossedUp = Math.ceil(raw / (1 - waste / 100));

  return {
    amountMinor: grossedUp,
    basis:
      `Assumes ${pricePerM2Minor} per m² of reclaimed sheet. ${areaM2.toFixed(4)} m² of parts per ` +
      `unit is grossed up from ${raw} to ${grossedUp} to cover the ${waste}% cutting waste this ` +
      'layout produces.',
  };
}

/** Consumables cost for one unit, from the template's requirement list. */
export function additionalMaterialsPerUnit(feasibility: FeasibilityResult): number {
  return feasibility.additionalMaterials.reduce(
    (total, item) => total + Math.round(item.quantityPerUnit * item.unitCostMinor),
    0,
  );
}

/** Total consumables cost for a batch, from a scaled requirement list. */
export function additionalMaterialsPerBatch(feasibility: FeasibilityResult): number {
  return feasibility.additionalMaterials.reduce(
    (total, item) => total + item.estimatedCostMinor,
    0,
  );
}
