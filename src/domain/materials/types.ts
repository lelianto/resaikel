import { isIsoDate } from '../common';
import type { IsoDateTime } from '../common';

/**
 * Material taxonomy.
 *
 * `MaterialCategory` is what the user and the vision model reason about.
 * `MaterialFamily` is the coarse grouping the parametric product catalogue uses
 * for its compatibility gate, because a plywood template cares about "sheet
 * wood", not about whether the sheet is plywood or MDF.
 */

export const MATERIAL_CATEGORIES = [
  'wood',
  'plywood',
  'mdf',
  'cardboard',
  'paper',
  'plastic',
  'textile',
  'metal',
  'glass',
  'unknown',
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood: 'Wood',
  plywood: 'Plywood',
  mdf: 'MDF',
  cardboard: 'Cardboard',
  paper: 'Paper',
  plastic: 'Plastic',
  textile: 'Textile',
  metal: 'Metal',
  glass: 'Glass',
  unknown: 'Unknown',
};

export const MATERIAL_FAMILIES = [
  'cardboard',
  'sheet_wood',
  'solid_wood',
  'paper',
  'textile',
  'plastic',
  'metal',
  'glass',
  'unknown',
] as const;

export type MaterialFamily = (typeof MATERIAL_FAMILIES)[number];

export const MATERIAL_FAMILY_LABELS: Record<MaterialFamily, string> = {
  cardboard: 'Cardboard',
  sheet_wood: 'Sheet wood',
  solid_wood: 'Solid wood',
  paper: 'Paper',
  textile: 'Textile',
  plastic: 'Plastic',
  metal: 'Metal',
  glass: 'Glass',
  unknown: 'Unknown',
};

const CATEGORY_TO_FAMILY: Record<MaterialCategory, MaterialFamily> = {
  plywood: 'sheet_wood',
  mdf: 'sheet_wood',
  wood: 'solid_wood',
  cardboard: 'cardboard',
  paper: 'paper',
  textile: 'textile',
  plastic: 'plastic',
  metal: 'metal',
  glass: 'glass',
  unknown: 'unknown',
};

export function familyOf(category: MaterialCategory): MaterialFamily {
  return CATEGORY_TO_FAMILY[category];
}

/** Families that are commonly sold and cut as flat sheets. */
export function isSheetFamily(family: MaterialFamily): boolean {
  return family === 'cardboard' || family === 'sheet_wood' || family === 'paper';
}

/**
 * Provenance for a single material attribute.
 *
 * A single global "confidence" number is never used to represent physical
 * safety. Each critical field records *how* its value came to exist, so the UI
 * can distinguish an AI guess from a tape measure.
 */
export const PROVENANCE_SOURCES = ['ai', 'user', 'measured', 'unknown'] as const;

export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export const PROVENANCE_LABELS: Record<ProvenanceSource, string> = {
  ai: 'AI inferred',
  user: 'User confirmed',
  measured: 'Measured',
  unknown: 'Unknown',
};

export interface FieldProvenance {
  readonly source: ProvenanceSource;
  /** Model self-reported confidence in [0,1]. Only meaningful for `ai`. */
  readonly confidence?: number;
  readonly note?: string;
  readonly recordedAt: IsoDateTime;
}

export const MATERIAL_ATTRIBUTE_KEYS = [
  'category',
  'subtype',
  'color',
  'texture',
  'shape',
  'condition',
  'lengthMm',
  'widthMm',
  'thicknessMm',
  'quantity',
  'contamination',
  'defects',
] as const;

export type MaterialAttributeKey = (typeof MATERIAL_ATTRIBUTE_KEYS)[number];

export type ProvenanceMap = Partial<Record<MaterialAttributeKey, FieldProvenance>>;

/**
 * Fields the feasibility engine cannot reason without. Until these carry a
 * `user` or `measured` provenance the material is not eligible for discovery.
 */
export const CRITICAL_ATTRIBUTE_KEYS: readonly MaterialAttributeKey[] = [
  'category',
  'lengthMm',
  'widthMm',
  'quantity',
];

export type ConditionGrade = 'new' | 'good' | 'fair' | 'poor' | 'unknown';

/** Declared as a tuple so it can drive a Zod enum without a cast. */
export const CONDITION_GRADES = ['new', 'good', 'fair', 'poor', 'unknown'] as const;

export const CONDITION_LABELS: Record<ConditionGrade, string> = {
  new: 'New / unused',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unknown: 'Unknown',
};

export type MaterialStatus =
  | 'draft'
  | 'analyzing'
  | 'needs_confirmation'
  | 'verified'
  | 'archived';

export const MATERIAL_STATUSES = [
  'draft',
  'analyzing',
  'needs_confirmation',
  'verified',
  'archived',
] as const;

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  draft: 'Draft',
  analyzing: 'Analysing',
  needs_confirmation: 'Needs confirmation',
  verified: 'Verified',
  archived: 'Archived',
};

export type QuantityUnit = 'piece' | 'sheet' | 'kg' | 'm2';

/** Declared as a tuple so it can drive a Zod enum without a cast. */
export const QUANTITY_UNITS = ['piece', 'sheet', 'kg', 'm2'] as const;

export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  piece: 'pieces',
  sheet: 'sheets',
  kg: 'kg',
  m2: 'm²',
};

export interface MaterialQuantity {
  readonly value: number;
  readonly unit: QuantityUnit;
}

export interface MaterialDimensions {
  readonly lengthMm: number | null;
  readonly widthMm: number | null;
  readonly thicknessMm: number | null;
}

export interface MaterialAvailability {
  readonly availableQuantity: number;
  readonly reservedQuantity: number;
  readonly usedQuantity: number;
}

export interface MaterialAttributes {
  readonly category: MaterialCategory;
  readonly subtype: string | null;
  readonly color: string | null;
  readonly texture: string | null;
  readonly shape: string | null;
  readonly condition: ConditionGrade;
  readonly contamination: readonly string[];
  readonly defects: readonly string[];
}

export interface MaterialPhoto {
  readonly id: string;
  readonly orgId: string;
  readonly materialId: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly order: number;
  readonly createdAt: IsoDateTime;
}

export interface Material {
  readonly id: string;
  readonly orgId: string;
  readonly schemaVersion: number;
  readonly createdBy: string;
  readonly title: string;
  readonly origin: string | null;
  readonly notes: string | null;
  readonly attributes: MaterialAttributes;
  readonly quantity: MaterialQuantity;
  readonly dimensions: MaterialDimensions;
  readonly provenance: ProvenanceMap;
  readonly availability: MaterialAvailability;
  readonly status: MaterialStatus;
  readonly photos: readonly MaterialPhoto[];
  /** Attributes the AI could not determine and the user must still supply. */
  readonly missingInformation: readonly string[];
  /** Explicit warnings surfaced from analysis or validation. */
  readonly warnings: readonly string[];
  /** Set when the record is demo data, never mixed with real user records. */
  readonly isSampleData: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly verifiedAt: IsoDateTime | null;
}

export type MaterialSummary = Omit<Material, 'photos' | 'provenance' | 'missingInformation'> & {
  readonly photoCount: number;
  readonly primaryPhotoId: string | null;
};

export function isDateLike(value: string): boolean {
  return isIsoDate(value);
}
