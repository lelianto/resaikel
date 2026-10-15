import { describe, expect, it } from 'vitest';

import { evaluateFeasibility } from '@/domain/feasibility/engine';
import { isFeasible, isRankable } from '@/domain/feasibility/types';
import {
  CARDBOARD_400x300,
  CARDBOARD_TOO_SMALL,
  PLYWOOD_600x400,
  UNKNOWN_MATERIAL,
  WORKSHOP_WOOD_FULL,
  WORKSHOP_WOOD_MISSING_SANDER,
  feasibilityInput,
} from '../fixtures/materials';

describe('evaluateFeasibility', () => {
  it('reports a geometrically feasible product when no workshop profile is supplied', () => {
    const result = evaluateFeasibility(
      feasibilityInput({ templateId: 'sheetwood-phone-stand', material: PLYWOOD_600x400 }),
    );

    expect(result.status).toBe('geometrically_feasible');
    expect(isFeasible(result.status)).toBe(true);
    expect(result.capacity.maxUnits).toBeGreaterThan(0);
    expect(result.checks.find((check) => check.id === 'tooling')?.outcome).toBe('skipped');
    expect(result.disclaimer).toMatch(/not a production drawing/i);
  });

  it('reports process feasible when every required tool is available', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: PLYWOOD_600x400,
        capability: WORKSHOP_WOOD_FULL,
      }),
    );

    expect(result.status).toBe('process_feasible');
    expect(result.missingTools).toHaveLength(0);
  });

  it('downgrades to conditionally feasible when a required tool is missing', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: PLYWOOD_600x400,
        capability: WORKSHOP_WOOD_MISSING_SANDER,
      }),
    );

    expect(result.status).toBe('conditionally_feasible');
    expect(result.missingTools).toContain('orbital_sander');
    expect(result.warnings.join(' ')).toMatch(/not listed in the workshop profile/);
  });

  it('returns not_evaluated for an unknown material instead of guessing', () => {
    const result = evaluateFeasibility(
      feasibilityInput({ templateId: 'sheetwood-phone-stand', material: UNKNOWN_MATERIAL }),
    );

    expect(result.status).toBe('not_evaluated');
    expect(isFeasible(result.status)).toBe(false);
    expect(isRankable(result.status)).toBe(false);
    expect(result.capacity.maxUnits).toBe(0);
  });

  it('returns not_evaluated while the material is unconfirmed', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, verified: false },
      }),
    );

    expect(result.status).toBe('not_evaluated');
    expect(result.rejectReasons.join(' ')).toMatch(/Confirm the material properties/);
  });

  it('rejects cardboard that is too small for the packaging dieline', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'cardboard-shipping-box-small',
        material: CARDBOARD_TOO_SMALL,
      }),
    );

    expect(result.status).toBe('not_feasible');
    expect(isRankable(result.status)).toBe(false);
    expect(result.rejectReasons.join(' ')).toMatch(/RSC blank/);
    expect(result.rejectReasons.join(' ')).toMatch(/larger than the 300 x 200 mm sheet/);
    expect(result.checks.find((check) => check.id === 'stock_fit')?.outcome).toBe('fail');
  });

  it('accepts cardboard that is large enough for a packaging insert', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'cardboard-packaging-insert',
        material: CARDBOARD_400x300,
        parameters: { length: 300, width: 200, height: 40 },
      }),
    );

    expect(isFeasible(result.status)).toBe(true);
    expect(result.capacity.maxUnits).toBeGreaterThan(0);
  });

  it('rejects a product whose material family does not match', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'cardboard-shipping-box-small',
        material: { ...PLYWOOD_600x400 },
      }),
    );

    expect(result.status).toBe('not_feasible');
    expect(result.rejectReasons.join(' ')).toMatch(/Sheet wood/);
  });

  it('stops the evaluation when a structural thickness was never measured', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, thicknessMm: null },
      }),
    );

    expect(result.status).toBe('not_evaluated');
    expect(result.rejectReasons.join(' ')).toMatch(/Measure the sheet thickness/);
  });

  it('assumes a nominal thickness for thin sheet goods rather than blocking', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'cardboard-packaging-insert',
        material: { ...CARDBOARD_400x300, thicknessMm: null },
      }),
    );

    expect(isFeasible(result.status)).toBe(true);
    expect(result.assumptions.join(' ')).toMatch(/nominal thickness/);
  });

  it('rejects board that is thinner than the product requires', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, thicknessMm: 6 },
      }),
    );

    expect(result.status).toBe('not_feasible');
    expect(result.rejectReasons.join(' ')).toMatch(/at least 9 mm/);
  });

  it('rejects material with blocking contamination', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, contamination: ['Machine oil'] },
      }),
    );

    expect(result.status).toBe('not_feasible');
    expect(result.rejectReasons.join(' ')).toMatch(/contamination/i);
  });

  it('warns but continues when condition is poor', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, condition: 'poor' },
        capability: WORKSHOP_WOOD_FULL,
      }),
    );

    expect(result.status).toBe('conditionally_feasible');
    expect(result.warnings.join(' ')).toMatch(/yield will be below/);
  });

  it('ignores unavailable quantity', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, reservedQuantity: 4 },
      }),
    );

    expect(result.capacity.maxUnits).toBe(0);
    expect(result.rejectReasons.join(' ')).toMatch(/after reservations/);
  });

  it('always states its assumptions and never claims certification', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: PLYWOOD_600x400,
        capability: WORKSHOP_WOOD_FULL,
      }),
    );

    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions.join(' ')).toMatch(/kerf/i);
    expect(result.assumptions.join(' ')).toMatch(/guillotine/i);
    expect(result.disclaimer).toMatch(/not a production drawing/i);
    expect(result.disclaimer).toMatch(/does not prove structural safety/i);
  });

  it('scales additional materials to the producible batch', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: PLYWOOD_600x400,
        capability: WORKSHOP_WOOD_FULL,
      }),
    );

    const glue = result.additionalMaterials.find((item) => item.name === 'Wood glue');
    expect(glue).toBeDefined();
    expect(glue?.totalQuantity).toBeCloseTo(12 * result.capacity.maxUnits, 3);
  });

  it('leaves every packaging checklist item unverified', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'cardboard-shipping-box-small',
        material: CARDBOARD_400x300,
        parameters: { length: 150, width: 120, height: 80 },
      }),
    );

    expect(result.packagingChecklist.length).toBeGreaterThan(0);
    for (const item of result.packagingChecklist) {
      expect(item.satisfied).toBeNull();
    }
  });

  it('notes that unrecorded defect positions are not excluded from the layout', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: { ...PLYWOOD_600x400, defects: ['Edge crush'] },
      }),
    );

    expect(result.assumptions.join(' ')).toMatch(/defects are not excluded/);
  });

  it('produces a one-unit layout for the cutting diagram', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-phone-stand',
        material: PLYWOOD_600x400,
      }),
    );

    expect(result.unitLayout.length).toBeGreaterThan(0);
    expect(result.unitLayout[0]?.placements).toHaveLength(3);
  });

  it('clamps out-of-range parameter proposals instead of failing', () => {
    const result = evaluateFeasibility(
      feasibilityInput({
        templateId: 'sheetwood-coaster-set',
        material: PLYWOOD_600x400,
        parameters: { size: 999, holderLength: -50 },
      }),
    );

    expect(result.resolvedParameters.size).toBe(130);
    expect(result.resolvedParameters.holderLength).toBe(100);
  });

  it('is deterministic for identical input', () => {
    const input = () =>
      feasibilityInput({
        templateId: 'sheetwood-desk-organiser',
        material: PLYWOOD_600x400,
        capability: WORKSHOP_WOOD_FULL,
      });

    const first = evaluateFeasibility(input());
    const second = evaluateFeasibility(input());

    expect({ ...first, evaluatedAt: '' }).toEqual({ ...second, evaluatedAt: '' });
  });
});
