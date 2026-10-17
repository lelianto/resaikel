import type { MaterialFamily } from '../materials/types';
import { PRODUCT_TEMPLATE_BY_ID, PRODUCT_TEMPLATES } from './templates';
import type {
  PartDimensionRule,
  ProductTemplate,
  ResolvedPart,
  ResolvedTemplate,
  TemplateParameter,
} from './types';

export * from './types';
export { PRODUCT_TEMPLATES, PRODUCT_TEMPLATE_BY_ID } from './templates';

export function getTemplate(templateId: string): ProductTemplate | null {
  return PRODUCT_TEMPLATE_BY_ID[templateId] ?? null;
}

export function templatesForFamily(family: MaterialFamily): ProductTemplate[] {
  return PRODUCT_TEMPLATES.filter((template) => template.materialFamilies.includes(family));
}

/** Templates whose stock requirements this family can plausibly satisfy. */
export function selectableTemplates(families: readonly MaterialFamily[]): ProductTemplate[] {
  const set = new Set(families);
  return PRODUCT_TEMPLATES.filter((template) =>
    template.materialFamilies.some((family) => set.has(family)),
  );
}

/**
 * Material families the catalogue can actually turn into products: every family
 * named by at least one template. Derived from the catalogue itself so adding a
 * template for a new family (metal, glass, …) opens the gate automatically, with
 * no second list to keep in sync. This is the single source of truth for "which
 * materials are supported" across analysis warnings and the discovery gate.
 */
export const SUPPORTED_FAMILIES: readonly MaterialFamily[] = [
  ...new Set(PRODUCT_TEMPLATES.flatMap((template) => template.materialFamilies)),
];

/** Whether the catalogue can turn this material family into any product yet. */
export function isSupportedFamily(family: MaterialFamily): boolean {
  return SUPPORTED_FAMILIES.includes(family);
}

/** Every template in a given category, regardless of material. */
export function templatesByCategory(category: ProductTemplate['category']): ProductTemplate[] {
  return PRODUCT_TEMPLATES.filter((template) => template.category === category);
}

export function defaultParameters(template: ProductTemplate): Record<string, number> {
  const result: Record<string, number> = {};
  for (const parameter of template.parameters) {
    result[parameter.key] = parameter.default;
  }
  return result;
}

function snapToStep(value: number, parameter: TemplateParameter): number {
  const steps = Math.round((value - parameter.min) / parameter.step);
  const snapped = parameter.min + steps * parameter.step;
  return Math.min(parameter.max, Math.max(parameter.min, snapped));
}

/**
 * Coerces arbitrary (often model-generated) parameter values into the declared
 * bounds and step grid. Out-of-range proposals are clamped rather than rejected,
 * so a slightly over-eager model suggestion still yields a buildable product.
 */
export function clampParameters(
  template: ProductTemplate,
  input: Readonly<Record<string, number | undefined>>,
): Record<string, number> {
  const result = defaultParameters(template);
  for (const parameter of template.parameters) {
    const raw = input[parameter.key];
    if (raw === undefined || !Number.isFinite(raw)) continue;
    result[parameter.key] = snapToStep(raw, parameter);
  }
  return result;
}

export interface ParameterIssue {
  readonly key: string;
  readonly message: string;
  readonly severity: 'clamped' | 'ignored' | 'blocking';
}

export function validateParameters(
  template: ProductTemplate,
  input: Readonly<Record<string, number | undefined>>,
): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const knownKeys = new Set(template.parameters.map((p) => p.key));

  for (const key of Object.keys(input)) {
    if (!knownKeys.has(key)) {
      issues.push({
        key,
        message: `Parameter "${key}" is not part of template ${template.id} and was ignored.`,
        severity: 'ignored',
      });
    }
  }

  for (const parameter of template.parameters) {
    const raw = input[parameter.key];
    if (raw === undefined) continue;
    if (!Number.isFinite(raw)) {
      issues.push({
        key: parameter.key,
        message: `${parameter.label} was not a number; the default was used.`,
        severity: 'ignored',
      });
      continue;
    }
    if (raw < parameter.min || raw > parameter.max) {
      issues.push({
        key: parameter.key,
        message: `${parameter.label} (${raw} mm) is outside ${parameter.min}-${parameter.max} mm and was clamped.`,
        severity: 'clamped',
      });
    }
  }

  return issues;
}

function groupRulesByPart(rules: readonly PartDimensionRule[]): Map<string, PartDimensionRule[]> {
  const grouped = new Map<string, PartDimensionRule[]>();
  for (const rule of rules) {
    const existing = grouped.get(rule.partId);
    if (existing) existing.push(rule);
    else grouped.set(rule.partId, [rule]);
  }
  return grouped;
}

/**
 * Applies the parameter rules to produce concrete part geometry. This is the
 * only place part dimensions are derived, so the feasibility engine, the cost
 * engine and the cutting diagram all operate on the same numbers.
 */
export function resolveTemplate(
  template: ProductTemplate,
  input: Readonly<Record<string, number | undefined>> = {},
): ResolvedTemplate {
  const parameters = clampParameters(template, input);
  const rulesByPart = groupRulesByPart(template.partDimensionRules);

  const parts: ResolvedPart[] = template.parts.map((part) => {
    let lengthMm = part.lengthMm;
    let widthMm = part.widthMm;
    let thicknessMm = part.thicknessMm;

    for (const rule of rulesByPart.get(part.id) ?? []) {
      let value = rule.base;
      for (const [key, coefficient] of Object.entries(rule.coefficients)) {
        value += coefficient * (parameters[key] ?? 0);
      }
      const resolved = Math.max(rule.clampMin ?? 1, Math.round(value));
      if (rule.dimension === 'lengthMm') lengthMm = resolved;
      else if (rule.dimension === 'widthMm') widthMm = resolved;
      else thicknessMm = resolved;
    }

    return {
      partId: part.id,
      name: part.name,
      quantityPerUnit: part.quantityPerUnit,
      lengthMm,
      widthMm,
      thicknessMm,
      rotatable: part.rotatable,
      continuous: part.continuous,
    };
  });

  return { template, parameters, parts };
}

/** Total flat area of the parts needed for one finished unit, in mm². */
export function unitPartAreaMm2(resolved: ResolvedTemplate): number {
  return resolved.parts.reduce(
    (total, part) => total + part.lengthMm * part.widthMm * part.quantityPerUnit,
    0,
  );
}

/** Highest part thickness, used for the stock thickness gate. */
export function requiredThicknessMm(resolved: ResolvedTemplate): number {
  return resolved.parts.reduce((max, part) => Math.max(max, part.thicknessMm), 0);
}
