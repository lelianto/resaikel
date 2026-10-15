import { familyOf } from './types';
import type { Material, MaterialFamily } from './types';

/**
 * Material-level validation that runs before any product discovery. It is
 * deliberately conservative: an unverified dimension is treated as absent, not
 * as a guess.
 */

export interface MaterialIssue {
  readonly code:
    | 'MISSING_CATEGORY'
    | 'MISSING_DIMENSIONS'
    | 'MISSING_QUANTITY'
    | 'UNVERIFIED_FIELD'
    | 'SEVERE_CONTAMINATION'
    | 'POOR_CONDITION'
    | 'UNSUPPORTED_FAMILY';
  readonly severity: 'blocking' | 'warning';
  readonly message: string;
  readonly field?: string;
}

export interface MaterialValidation {
  readonly ready: boolean;
  readonly issues: readonly MaterialIssue[];
  readonly blockingIssues: readonly MaterialIssue[];
  readonly warnings: readonly MaterialIssue[];
}

/**
 * Single-token hazard vocabulary. Contamination is free text, so entries are
 * tokenised and matched word-by-word rather than by exact string equality:
 * "Machine oil" must trip the `oil` rule.
 *
 * The matching deliberately errs toward blocking. A false positive costs a user
 * one manual reclassification; a false negative puts hazardous material into a
 * consumer product, so the asymmetry is intentional.
 */
const CONTAMINATION_BLOCKLIST = [
  'oil',
  'grease',
  'chemical',
  'chemicals',
  'hazardous',
  'toxic',
  'mould',
  'mold',
  'mildew',
  'asbestos',
  'pesticide',
  'herbicide',
  'solvent',
  'fuel',
  'diesel',
  'petrol',
  'sewage',
  'rot',
  'rotted',
];

function tokensOf(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isBlockedEntry(entry: string): boolean {
  return tokensOf(entry).some((token) => CONTAMINATION_BLOCKLIST.includes(token));
}

/**
 * True when any recorded contaminant is on the blocklist. Shared with the
 * feasibility engine so the two never disagree about what is safe to reuse.
 */
export function isContaminationBlocked(contamination: readonly string[]): boolean {
  return contamination.some(isBlockedEntry);
}

export function hasSevereContamination(material: Material): boolean {
  return isContaminationBlocked(material.attributes.contamination);
}

export function blockingContaminants(contamination: readonly string[]): string[] {
  return contamination.filter(isBlockedEntry);
}

/** Families the parametric catalogue can currently evaluate. */
export const SUPPORTED_FAMILIES: readonly MaterialFamily[] = [
  'cardboard',
  'sheet_wood',
  'solid_wood',
  'paper',
];

export function validateMaterial(material: Material): MaterialValidation {
  const issues: MaterialIssue[] = [];

  if (material.attributes.category === 'unknown') {
    issues.push({
      code: 'MISSING_CATEGORY',
      severity: 'blocking',
      message: 'The material category is still unknown. Set it before discovering products.',
      field: 'category',
    });
  } else if (!SUPPORTED_FAMILIES.includes(familyOf(material.attributes.category))) {
    issues.push({
      code: 'UNSUPPORTED_FAMILY',
      severity: 'warning',
      message:
        'No validated manufacturing specification exists for this material family yet. ' +
        'Products will be shown as concept only.',
      field: 'category',
    });
  }

  if (material.dimensions.lengthMm === null || material.dimensions.widthMm === null) {
    issues.push({
      code: 'MISSING_DIMENSIONS',
      severity: 'blocking',
      message: 'Length and width are required. Photographs cannot establish them reliably.',
      field: 'dimensions',
    });
  }

  if (material.quantity.value <= 0) {
    issues.push({
      code: 'MISSING_QUANTITY',
      severity: 'blocking',
      message: 'Quantity must be greater than zero.',
      field: 'quantity',
    });
  }

  if (hasSevereContamination(material)) {
    issues.push({
      code: 'SEVERE_CONTAMINATION',
      severity: 'blocking',
      message:
        'The recorded contamination makes this material unsuitable for food-contact or ' +
        'consumer products. Clean or reclassify it first.',
      field: 'contamination',
    });
  }

  if (material.attributes.condition === 'poor') {
    issues.push({
      code: 'POOR_CONDITION',
      severity: 'warning',
      message:
        'Poor condition reduces yield. Expect higher cutting waste and a lower producible quantity.',
      field: 'condition',
    });
  }

  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');

  return {
    ready: blockingIssues.length === 0,
    issues,
    blockingIssues,
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  };
}

/** Consumable stock after reservations, never negative. */
export function availableQuantity(material: Material): number {
  const { availableQuantity: available, reservedQuantity } = material.availability;
  return Math.max(0, available - reservedQuantity);
}
