import { describe, expect, it } from 'vitest';

import { isSupportedFamily, SUPPORTED_FAMILIES } from '@/domain/catalog';
import { familyOf, type MaterialCategory } from '@/domain/materials/types';
import { warningsFor } from '@/server/services/analysis';
import { HttpError } from '@/server/http/errors';
import type { MaterialAnalysis } from '@/ai/schemas';

/**
 * The supported-family gate.
 *
 * One rule, enforced in three places: the catalogue is the single source of truth
 * for which material families can become products, analysis warns early when a
 * material falls outside it, and discovery refuses outright. These tests pin each
 * layer to the same decision.
 */

function analysis(overrides: Partial<MaterialAnalysis> = {}): MaterialAnalysis {
  return {
    category: 'glass',
    subtype: null,
    color: null,
    texture: null,
    shape: null,
    condition: 'good',
    contamination: [],
    defects: [],
    reuseRestrictions: [],
    visibleEvidence: [],
    missingInformation: [],
    warnings: [],
    fieldConfidence: {},
    notes: null,
    ...overrides,
  };
}

const NOTICE = /no product opportunities can be/i;

describe('SUPPORTED_FAMILIES (catalogue is the source of truth)', () => {
  it('derives exactly the families that have at least one template', () => {
    expect([...SUPPORTED_FAMILIES].sort()).toEqual(['cardboard', 'sheet_wood', 'solid_wood']);
  });

  it('excludes families with no template and never includes unknown', () => {
    expect(SUPPORTED_FAMILIES).not.toContain('glass');
    expect(SUPPORTED_FAMILIES).not.toContain('metal');
    expect(SUPPORTED_FAMILIES).not.toContain('unknown');
  });

  it('answers isSupportedFamily per family', () => {
    expect(isSupportedFamily('cardboard')).toBe(true);
    expect(isSupportedFamily('sheet_wood')).toBe(true);
    expect(isSupportedFamily('solid_wood')).toBe(true);
    expect(isSupportedFamily('paper')).toBe(false);
    expect(isSupportedFamily('plastic')).toBe(false);
    expect(isSupportedFamily('textile')).toBe(false);
    expect(isSupportedFamily('metal')).toBe(false);
    expect(isSupportedFamily('glass')).toBe(false);
    expect(isSupportedFamily('unknown')).toBe(false);
  });
});

describe('analysis warning for unsupported families', () => {
  it('warns when the material family cannot be turned into a product', () => {
    const warnings = warningsFor(analysis({ category: 'glass' }), [], false, 'glass');
    expect(warnings.join(' ')).toMatch(NOTICE);
    // The notice names the supported families so the user knows what does work.
    expect(warnings.join(' ')).toMatch(/cardboard/i);
    expect(warnings.join(' ')).toMatch(/wood/i);
  });

  it('stays silent for a supported family', () => {
    const warnings = warningsFor(analysis({ category: 'cardboard' }), [], false, 'cardboard');
    expect(warnings.join(' ')).not.toMatch(NOTICE);
  });

  it('does not warn for unknown: that is handled by missingInformation instead', () => {
    const warnings = warningsFor(analysis({ category: 'unknown' }), [], false, 'unknown');
    expect(warnings.join(' ')).not.toMatch(NOTICE);
  });

  it('still carries reuse restrictions and the mock disclosure alongside the notice', () => {
    const warnings = warningsFor(
      analysis({ category: 'glass', reuseRestrictions: ['Sharp broken edge, do not reuse.'] }),
      [],
      true,
      'glass',
    );
    expect(warnings.join(' ')).toMatch(NOTICE);
    expect(warnings.join(' ')).toMatch(/do not reuse/i);
    expect(warnings.join(' ')).toMatch(/offline mock adapter/i);
  });

  it('deduplicates warnings', () => {
    const warnings = warningsFor(
      analysis({ category: 'glass', warnings: ['Same note.'], reuseRestrictions: ['Same note.'] }),
      [],
      false,
      'glass',
    );
    expect(warnings.filter((entry) => entry === 'Same note.')).toHaveLength(1);
  });
});

describe('discovery gate decision (isSupportedFamily ∘ familyOf)', () => {
  // The discover route blocks a material whose family has no template. This is the
  // exact predicate it evaluates, pinned per category.
  const gated = (category: MaterialCategory): boolean => !isSupportedFamily(familyOf(category));

  it('lets buildable materials through', () => {
    expect(gated('cardboard')).toBe(false);
    expect(gated('plywood')).toBe(false);
    expect(gated('mdf')).toBe(false);
    expect(gated('wood')).toBe(false);
  });

  it('blocks materials with no product template', () => {
    expect(gated('paper')).toBe(true);
    expect(gated('plastic')).toBe(true);
    expect(gated('textile')).toBe(true);
    expect(gated('metal')).toBe(true);
    expect(gated('glass')).toBe(true);
  });
});

describe('MATERIAL_FAMILY_UNSUPPORTED error', () => {
  it('is an unprocessable-entity (422) domain error', () => {
    const error = new HttpError('MATERIAL_FAMILY_UNSUPPORTED', 'Glass is not supported yet.');
    expect(error.code).toBe('MATERIAL_FAMILY_UNSUPPORTED');
    expect(error.status).toBe(422);
  });
});
