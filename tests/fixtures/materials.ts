import { getTemplate } from '@/domain/catalog';
import type { FeasibilityInput, FeasibilityMaterialInput } from '@/domain/feasibility/types';
import type { WorkshopCapabilityInput } from '@/domain/feasibility/types';

export const PLYWOOD_600x400: FeasibilityMaterialInput = {
  category: 'plywood',
  lengthMm: 600,
  widthMm: 400,
  thicknessMm: 12,
  quantityValue: 4,
  quantityUnit: 'sheet',
  reservedQuantity: 0,
  condition: 'good',
  contamination: [],
  defects: [],
  verified: true,
};

export const CARDBOARD_400x300: FeasibilityMaterialInput = {
  category: 'cardboard',
  lengthMm: 400,
  widthMm: 300,
  thicknessMm: 3,
  quantityValue: 3,
  quantityUnit: 'sheet',
  reservedQuantity: 0,
  condition: 'good',
  contamination: [],
  defects: [],
  verified: true,
};

/** Too small for any RSC blank the shipping-box template can produce. */
export const CARDBOARD_TOO_SMALL: FeasibilityMaterialInput = {
  ...CARDBOARD_400x300,
  lengthMm: 300,
  widthMm: 200,
  quantityValue: 2,
};

export const UNKNOWN_MATERIAL: FeasibilityMaterialInput = {
  ...PLYWOOD_600x400,
  category: 'unknown',
};

export const WORKSHOP_WOOD_FULL: WorkshopCapabilityInput = {
  name: 'Pilot workshop (full)',
  tools: [
    'measuring_tape',
    'ruler_square',
    'circular_saw',
    'hand_drill',
    'orbital_sander',
    'clamps',
    'drill_press',
    'jig_saw',
  ],
  processes: [
    'measure_mark',
    'cut_straight',
    'cut_curve',
    'drill',
    'sand',
    'glue',
    'assemble',
    'surface_finish',
  ],
  supportedFamilies: ['sheet_wood', 'solid_wood', 'cardboard'],
};

export const WORKSHOP_WOOD_MISSING_SANDER: WorkshopCapabilityInput = {
  ...WORKSHOP_WOOD_FULL,
  name: 'Pilot workshop (no sander)',
  tools: ['measuring_tape', 'ruler_square', 'circular_saw', 'hand_drill', 'clamps'],
};

export function feasibilityInput(
  overrides: Partial<FeasibilityInput> & {
    templateId: string;
    material?: FeasibilityMaterialInput;
  },
): FeasibilityInput {
  const template = getTemplate(overrides.templateId);
  if (!template) throw new Error(`Unknown template in fixture: ${overrides.templateId}`);

  return {
    template,
    parameters: overrides.parameters ?? {},
    material: overrides.material ?? PLYWOOD_600x400,
    capability: overrides.capability ?? null,
    ...(overrides.options ? { options: overrides.options } : {}),
  };
}
