import { nowIso } from '../common';
import type {
  FieldProvenance,
  Material,
  MaterialAttributeKey,
  ProvenanceMap,
  ProvenanceSource,
} from './types';
import { CRITICAL_ATTRIBUTE_KEYS, MATERIAL_ATTRIBUTE_KEYS } from './types';

export function fieldProvenance(
  source: ProvenanceSource,
  options: { confidence?: number; note?: string; recordedAt?: string } = {},
): FieldProvenance {
  const base: FieldProvenance = {
    source,
    recordedAt: options.recordedAt ?? nowIso(),
  };
  // `exactOptionalPropertyTypes` is on: only attach optional keys when present.
  return {
    ...base,
    ...(options.confidence !== undefined ? { confidence: options.confidence } : {}),
    ...(options.note !== undefined ? { note: options.note } : {}),
  };
}

export function withProvenance(
  map: ProvenanceMap,
  key: MaterialAttributeKey,
  provenance: FieldProvenance,
): ProvenanceMap {
  return { ...map, [key]: provenance };
}

export function provenanceOf(
  map: ProvenanceMap,
  key: MaterialAttributeKey,
): FieldProvenance {
  return map[key] ?? { source: 'unknown', recordedAt: nowIso() };
}

/**
 * A field counts as human-verified when the user typed, measured, or explicitly
 * confirmed it. AI inference and "unknown" do not qualify - this is the rule
 * that keeps an AI guess from being treated as a physical fact.
 */
export function isHumanVerified(map: ProvenanceMap, key: MaterialAttributeKey): boolean {
  const source = provenanceOf(map, key).source;
  return source === 'user' || source === 'measured';
}

export function unverifiedCriticalKeys(material: Material): MaterialAttributeKey[] {
  return CRITICAL_ATTRIBUTE_KEYS.filter((key) => {
    if (materialHasValue(material, key) === false) return true;
    return !isHumanVerified(material.provenance, key);
  });
}

function materialHasValue(material: Material, key: MaterialAttributeKey): boolean {
  switch (key) {
    case 'category':
      return material.attributes.category !== 'unknown';
    case 'lengthMm':
      return material.dimensions.lengthMm !== null && material.dimensions.lengthMm > 0;
    case 'widthMm':
      return material.dimensions.widthMm !== null && material.dimensions.widthMm > 0;
    case 'thicknessMm':
      return material.dimensions.thicknessMm !== null && material.dimensions.thicknessMm > 0;
    case 'quantity':
      return material.quantity.value > 0;
    case 'subtype':
      return material.attributes.subtype !== null && material.attributes.subtype.length > 0;
    case 'color':
      return material.attributes.color !== null;
    case 'texture':
      return material.attributes.texture !== null;
    case 'shape':
      return material.attributes.shape !== null;
    case 'condition':
      return material.attributes.condition !== 'unknown';
    case 'contamination':
      return true;
    case 'defects':
      return true;
    default:
      return false;
  }
}

/**
 * Recomputes "which attributes are still unknown" from the record itself, so the
 * confirmation screen always reflects reality rather than a stale AI payload.
 */
export function unresolvedAttributeKeys(material: Material): MaterialAttributeKey[] {
  return MATERIAL_ATTRIBUTE_KEYS.filter((key) => !materialHasValue(material, key));
}

export function provenanceSummary(
  map: ProvenanceMap,
): Record<ProvenanceSource, number> {
  const summary: Record<ProvenanceSource, number> = { ai: 0, user: 0, measured: 0, unknown: 0 };
  for (const key of MATERIAL_ATTRIBUTE_KEYS) {
    const entry = map[key];
    if (entry) summary[entry.source] += 1;
    else summary.unknown += 1;
  }
  return summary;
}
