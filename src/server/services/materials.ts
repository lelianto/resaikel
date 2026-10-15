import { newRequestId } from '@/domain/ids';
import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import type { AuthContext } from '@/domain/identity/types';
import {
  CRITICAL_ATTRIBUTE_KEYS,
  type Material,
  type MaterialAttributeKey,
  type MaterialStatus,
  type ProvenanceMap,
} from '@/domain/materials/types';
import { unresolvedAttributeKeys, unverifiedCriticalKeys } from '@/domain/materials/provenance';
import type { z } from 'zod';

import { HttpError } from '../http/errors';
import type { materialPatchSchema } from '../http/schemas';
import {
  getMaterialDocument,
  listMaterialPhotoDocuments,
  toDomainMaterial,
  updateMaterialDocument,
} from '../repos/materials';
import type { MaterialDocument } from '../repos/types';

/**
 * Material write helpers.
 *
 * The important rule here: a field's *provenance* is updated in lockstep with its
 * value. There is no path that changes a dimension without recording whether a
 * person measured it or merely estimated it, which is what keeps an estimate from
 * later being read as a measurement.
 */

export type MaterialPatch = z.output<typeof materialPatchSchema>;

export function buildMaterialDocument(input: {
  auth: AuthContext;
  materialId: string;
  title: string;
  origin: string | null;
  notes: string | null;
  category: Material['attributes']['category'];
  condition: Material['attributes']['condition'];
  contamination: readonly string[];
  defects: readonly string[];
  quantityValue: number;
  quantityUnit: Material['quantity']['unit'];
  lengthMm: number | null;
  widthMm: number | null;
  thicknessMm: number | null;
  isSampleData: boolean;
}): MaterialDocument {
  const timestamp = nowIso();

  const provenance: ProvenanceMap = {};
  if (input.category !== 'unknown') {
    provenance.category = { source: 'user', recordedAt: timestamp };
  }
  if (input.lengthMm !== null) {
    provenance.lengthMm = { source: 'measured', recordedAt: timestamp };
  }
  if (input.widthMm !== null) {
    provenance.widthMm = { source: 'measured', recordedAt: timestamp };
  }
  if (input.thicknessMm !== null) {
    provenance.thicknessMm = { source: 'measured', recordedAt: timestamp };
  }
  if (input.condition !== 'unknown') {
    provenance.condition = { source: 'user', recordedAt: timestamp };
  }

  const missing: string[] = [];
  if (input.lengthMm === null || input.widthMm === null) {
    missing.push('Measure the sheet length and width. A photograph cannot establish them.');
  }
  if (input.category === 'unknown') {
    missing.push('Choose the material category.');
  }

  return {
    id: input.materialId,
    orgId: input.auth.orgId,
    schemaVersion: SCHEMA_VERSION,
    createdBy: input.auth.uid,
    title: input.title,
    origin: input.origin,
    notes: input.notes,
    attributes: {
      category: input.category,
      subtype: null,
      color: null,
      texture: null,
      shape: null,
      condition: input.condition,
      contamination: [...input.contamination],
      defects: [...input.defects],
    },
    quantity: { value: input.quantityValue, unit: input.quantityUnit },
    dimensions: {
      lengthMm: input.lengthMm,
      widthMm: input.widthMm,
      thicknessMm: input.thicknessMm,
    },
    provenance,
    availability: {
      availableQuantity: input.quantityValue,
      reservedQuantity: 0,
      usedQuantity: 0,
    },
    status: 'draft',
    photoCount: 0,
    primaryPhotoId: null,
    missingInformation: missing,
    warnings: [],
    isSampleData: input.isSampleData,
    createdAt: timestamp,
    updatedAt: timestamp,
    verifiedAt: null,
  };
}

export async function loadMaterialDocumentOrThrow(
  orgId: string,
  materialId: string,
): Promise<MaterialDocument> {
  const document = await getMaterialDocument(orgId, materialId);
  if (!document) {
    throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');
  }
  return document;
}

export async function loadMaterialWithPhotos(
  orgId: string,
  materialId: string,
): Promise<{ document: MaterialDocument; material: Material }> {
  const document = await loadMaterialDocumentOrThrow(orgId, materialId);
  const photos = await listMaterialPhotoDocuments(orgId, materialId);
  return { document, material: toDomainMaterial(document, photos) };
}

/**
 * A material patch with the `readonly` modifiers stripped.
 *
 * The domain types are deeply readonly, which is what stops them being mutated in
 * place, but a patch is by definition built up field by field. This mapped type
 * keeps the field names and value types while allowing local assignment, and the
 * result is still assignable to the read-only persistence type.
 */
type MutableMaterialPatch = {
  -readonly [K in keyof Omit<MaterialDocument, 'id' | 'orgId'>]?: Omit<
    MaterialDocument,
    'id' | 'orgId'
  >[K];
};

export interface PatchApplication {
  readonly patch: MutableMaterialPatch;
  readonly changed: readonly MaterialAttributeKey[];
  readonly changedFields: readonly string[];
}

export function applyMaterialPatch(
  document: MaterialDocument,
  patch: MaterialPatch,
): PatchApplication {
  const timestamp = nowIso();
  const provenance: ProvenanceMap = { ...document.provenance };
  const attributes = { ...document.attributes };
  const dimensions = { ...document.dimensions };
  const quantity = { ...document.quantity };
  const availability = { ...document.availability };
  const changed: MaterialAttributeKey[] = [];
  const changedFields: string[] = [];
  const out: MutableMaterialPatch = {};

  const dimensionSource = patch.dimensionSource ?? 'measured';

  const markField = (key: MaterialAttributeKey): void => {
    provenance[key] = { source: 'user', recordedAt: timestamp };
    if (!changed.includes(key)) changed.push(key);
  };

  const markDimension = (key: MaterialAttributeKey): void => {
    provenance[key] = { source: dimensionSource, recordedAt: timestamp };
    if (!changed.includes(key)) changed.push(key);
  };

  if (patch.title !== undefined) {
    out.title = patch.title;
    changedFields.push('title');
  }
  if (patch.origin !== undefined) {
    out.origin = patch.origin;
    changedFields.push('origin');
  }
  if (patch.notes !== undefined) {
    out.notes = patch.notes;
    changedFields.push('notes');
  }

  if (patch.category !== undefined) {
    attributes.category = patch.category;
    markField('category');
    changedFields.push('category');
  }
  if (patch.subtype !== undefined) {
    attributes.subtype = patch.subtype;
    markField('subtype');
    changedFields.push('subtype');
  }
  if (patch.color !== undefined) {
    attributes.color = patch.color;
    markField('color');
    changedFields.push('color');
  }
  if (patch.texture !== undefined) {
    attributes.texture = patch.texture;
    markField('texture');
    changedFields.push('texture');
  }
  if (patch.shape !== undefined) {
    attributes.shape = patch.shape;
    markField('shape');
    changedFields.push('shape');
  }
  if (patch.condition !== undefined) {
    attributes.condition = patch.condition;
    markField('condition');
    changedFields.push('condition');
  }
  if (patch.contamination !== undefined) {
    attributes.contamination = [...patch.contamination];
    markField('contamination');
    changedFields.push('contamination');
  }
  if (patch.defects !== undefined) {
    attributes.defects = [...patch.defects];
    markField('defects');
    changedFields.push('defects');
  }

  if (patch.lengthMm !== undefined) {
    dimensions.lengthMm = patch.lengthMm;
    markDimension('lengthMm');
    changedFields.push('lengthMm');
  }
  if (patch.widthMm !== undefined) {
    dimensions.widthMm = patch.widthMm;
    markDimension('widthMm');
    changedFields.push('widthMm');
  }
  if (patch.thicknessMm !== undefined) {
    dimensions.thicknessMm = patch.thicknessMm;
    markDimension('thicknessMm');
    changedFields.push('thicknessMm');
  }

  if (patch.quantityValue !== undefined) {
    const delta = patch.quantityValue - document.quantity.value;
    quantity.value = patch.quantityValue;
    availability.availableQuantity = Math.max(0, availability.availableQuantity + delta);
    markField('quantity');
    changedFields.push('quantityValue');
  }
  if (patch.quantityUnit !== undefined) {
    quantity.unit = patch.quantityUnit;
    changedFields.push('quantityUnit');
  }
  if (patch.reservedQuantity !== undefined) {
    availability.reservedQuantity = patch.reservedQuantity;
    changedFields.push('reservedQuantity');
  }

  out.attributes = attributes;
  out.dimensions = dimensions;
  out.quantity = quantity;
  out.availability = availability;
  out.provenance = provenance;
  out.updatedAt = timestamp;

  // Recompute what is still outstanding from the patched record itself rather
  // than trusting a stale list produced by an earlier analysis.
  const updated = { ...document, ...out } as MaterialDocument;
  out.missingInformation = missingInformationFor(updated);

  // Editing a confirmed material invalidates the confirmation.
  if (document.status === 'verified' && changedFields.length > 0) {
    out.status = 'needs_confirmation';
    out.verifiedAt = null;
    out.warnings = [
      ...document.warnings.filter((warning) => !warning.startsWith('Edited after confirmation')),
      'Edited after confirmation. Confirm the material again before relying on the analysis.',
    ];
  }

  return { patch: out, changed, changedFields };
}

/**
 * Recomputes the outstanding-information list. Dimensions are always required;
 * the rest only until a person supplies them.
 */
export function missingInformationFor(document: MaterialDocument): string[] {
  const items: string[] = [];

  if (document.dimensions.lengthMm === null || document.dimensions.widthMm === null) {
    items.push('Measure the sheet length and width. A photograph cannot establish them.');
  }
  if (document.attributes.category === 'unknown') {
    items.push('Choose the material category.');
  }
  if (document.quantity.value <= 0) {
    items.push('Enter how much of this material is available.');
  }

  return items;
}

export interface ConfirmationCheck {
  readonly ready: boolean;
  readonly blocking: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Whether a material may be confirmed. Critical attributes must carry a
 * `user`/`measured` provenance - an AI inference is never enough - and the
 * material must physically exist in a workable condition.
 */
export function checkConfirmable(material: Material): ConfirmationCheck {
  const blocking: string[] = [];
  const warnings: string[] = [...material.warnings];

  const unverified = unverifiedCriticalKeys(material);
  if (unverified.length > 0) {
    blocking.push(
      `These must be confirmed by a person before anything is evaluated: ${unverified.join(', ')}.`,
    );
  }

  if (material.attributes.category === 'unknown') {
    blocking.push('The material category is still unknown.');
  }

  const unresolved = unresolvedAttributeKeys(material);
  if (unresolved.length > 0) {
    warnings.push(
      `Still unknown and treated as unknown, not assumed: ${unresolved.join(', ')}.`,
    );
  }

  for (const key of CRITICAL_ATTRIBUTE_KEYS) {
    if (material.provenance[key]?.source === 'ai') {
      warnings.push(`"${key}" came from image analysis and has not been verified by a person.`);
    }
  }

  return { ready: blocking.length === 0, blocking, warnings: [...new Set(warnings)] };
}

export async function transitionStatus(
  orgId: string,
  materialId: string,
  status: MaterialStatus,
  extra: Partial<Omit<MaterialDocument, 'id' | 'orgId'>> = {},
): Promise<MaterialDocument> {
  const updated = await updateMaterialDocument(orgId, materialId, {
    status,
    updatedAt: nowIso(),
    ...extra,
  });

  if (!updated) {
    throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');
  }
  return updated;
}

export function newMaterialId(): string {
  return newRequestId();
}
