import { defaultParameters, resolveTemplate } from '@/domain/catalog';
import type { ProductTemplate } from '@/domain/catalog/types';
import type { MaterialCategory, MaterialFamily } from '@/domain/materials/types';
import { MATERIAL_CATEGORY_LABELS, MATERIAL_FAMILY_LABELS } from '@/domain/materials/types';
import { BUYER_SEGMENTS } from '@/domain/buyers/segments';
import type { BuyerSegmentId } from '@/domain/buyers/segments';

import type { BuyerSegmentSuggestion, MaterialAnalysis } from './schemas';
import type { FeasibilityExplanation, OpportunitySummary, ProductCandidateSet } from './schemas';
import type {
  BuyerSegmentsInput,
  DiscoveryInput,
  FeasibilityExplanationInput,
  MaterialAnalysisInput,
  OpportunitySummaryInput,
} from './types';

/**
 * Deterministic offline adapter.
 *
 * Used whenever `AI_MODE=mock`, when no Gemini key is present, and in every
 * automated test. It is deliberately *derived from its input* rather than a
 * fixed string: the keyword scan and the fit check mean the mock responds
 * plausibly to whatever it is given, which keeps the UI, the flows and the tests
 * exercised without spending a cent or requiring a network.
 *
 * It obeys the same contract as the live path, including never inventing a
 * measurement.
 */

const MOCK_NOTE =
  'Produced by the offline mock adapter. No AI model was called, and no model output influenced ' +
  'this result.';

const CATEGORY_KEYWORDS: readonly { category: MaterialCategory; keywords: readonly string[] }[] = [
  { category: 'cardboard', keywords: ['cardboard', 'carton', 'corrugated', 'kardus', 'box'] },
  { category: 'plywood', keywords: ['plywood', 'multiplex', 'triplek'] },
  { category: 'mdf', keywords: ['mdf', 'hdf', 'fibreboard'] },
  { category: 'wood', keywords: ['wood', 'timber', 'kayu', 'pine', 'teak', 'oak', 'pallet'] },
  { category: 'paper', keywords: ['paper', 'kertas', 'kraft', 'newspaper'] },
  { category: 'plastic', keywords: ['plastic', 'plastik', 'hdpe', 'pet', 'polypropylene', 'acrylic'] },
  { category: 'textile', keywords: ['fabric', 'textile', 'cloth', 'canvas', 'kain', 'denim'] },
  { category: 'metal', keywords: ['metal', 'steel', 'aluminium', 'aluminum', 'besi', 'tin'] },
  { category: 'glass', keywords: ['glass', 'kaca'] },
];

const POOR_CONDITION_KEYWORDS = ['broken', 'torn', 'cracked', 'crushed', 'rotten', 'soaked', 'rusak'];

const CONTAMINATION_KEYWORDS: readonly { token: string; label: string }[] = [
  { token: 'oil', label: 'Oil staining' },
  { token: 'paint', label: 'Paint residue' },
  { token: 'dirt', label: 'Loose dirt' },
  { token: 'soil', label: 'Soil or grit' },
  { token: 'mould', label: 'Mould' },
  { token: 'mold', label: 'Mould' },
  { token: 'grease', label: 'Grease' },
  { token: 'tape', label: 'Adhesive tape residue' },
];

function haystack(input: MaterialAnalysisInput): string {
  return [input.title ?? '', input.origin ?? '', input.userNotes ?? ''].join(' ').toLowerCase();
}

function deriveCategory(input: MaterialAnalysisInput): MaterialCategory {
  if (input.categoryHint && input.categoryHint !== 'unknown') return input.categoryHint;

  const text = haystack(input);
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) return entry.category;
  }
  return 'unknown';
}

function deriveContamination(input: MaterialAnalysisInput): string[] {
  const text = haystack(input);
  const found = new Set<string>();
  for (const entry of CONTAMINATION_KEYWORDS) {
    if (text.includes(entry.token)) found.add(entry.label);
  }
  return [...found].sort();
}

const SUBTYPE_BY_CATEGORY: Record<MaterialCategory, string | null> = {
  cardboard: 'Corrugated sheet',
  plywood: 'Plywood panel',
  mdf: 'Fibreboard panel',
  wood: 'Solid timber',
  paper: 'Paper stock',
  plastic: 'Rigid plastic sheet',
  textile: 'Woven fabric',
  metal: 'Sheet metal',
  glass: 'Flat glass',
  unknown: null,
};

export function mockAnalyzeMaterial(input: MaterialAnalysisInput): MaterialAnalysis {
  const category = deriveCategory(input);
  const contamination = deriveContamination(input);
  const text = haystack(input);
  const looksDamaged = POOR_CONDITION_KEYWORDS.some((keyword) => text.includes(keyword));

  const condition: MaterialAnalysis['condition'] =
    category === 'unknown' ? 'unknown' : looksDamaged ? 'fair' : 'good';

  const reuseRestrictions: string[] = [];
  if (contamination.length > 0) {
    reuseRestrictions.push(
      `Visible ${contamination.join(', ').toLowerCase()} would need to be removed before this ` +
        'could be used for consumer-facing products.',
    );
  }
  if (looksDamaged) {
    reuseRestrictions.push(
      'The owner reported damage, so yield will be lower than a clean sheet of the same size.',
    );
  }

  const missingInformation = [
    'Sheet length and width must be measured; a photograph cannot establish them.',
    'Sheet thickness must be measured with a gauge.',
  ];
  if (category === 'unknown') {
    missingInformation.push('The material category must be chosen by a person.');
  }

  return {
    category,
    subtype: SUBTYPE_BY_CATEGORY[category],
    color: null,
    texture: null,
    shape: 'Flat sheet',
    condition,
    contamination,
    defects: looksDamaged ? ['Reported damage (not located in the photograph)'] : [],
    reuseRestrictions,
    visibleEvidence: [
      'Flat, sheet-like form factor with roughly parallel edges.',
      category === 'unknown'
        ? 'Surface appearance does not match any category with confidence.'
        : `Surface appearance is consistent with ${MATERIAL_CATEGORY_LABELS[category].toLowerCase()}.`,
    ],
    missingInformation,
    warnings: [
      'Colour and texture could not be determined reliably from the supplied description.',
      'No reuse safety conclusion is drawn. A person must confirm suitability.',
    ],
    fieldConfidence: {
      category: category === 'unknown' ? 0.2 : 0.6,
      condition: 0.4,
      shape: 0.8,
    },
    notes: MOCK_NOTE,
  };
}

function templateFits(template: ProductTemplate, context: DiscoveryInput): boolean {
  const resolved = resolveTemplate(template, {});
  return resolved.parts.every((part) => {
    const straight = part.lengthMm <= context.lengthMm && part.widthMm <= context.widthMm;
    const rotated =
      part.rotatable && part.widthMm <= context.lengthMm && part.lengthMm <= context.widthMm;
    return straight || rotated;
  });
}

export function mockGenerateCandidates(context: DiscoveryInput): ProductCandidateSet {
  const limit = Math.max(1, context.budget.maxCandidates);
  const fitting = context.templates.filter((template) => templateFits(template, context));

  if (fitting.length === 0) {
    return {
      candidates: [
        {
          kind: 'concept',
          templateId: null,
          parameters: {},
          conceptName: 'Custom panel assembly',
          conceptDescription:
            `A bespoke flat-panel product sized to a ${context.lengthMm} x ${context.widthMm} mm ` +
            'sheet. No validated manufacturing specification exists for this idea in the catalogue, ' +
            'so no geometry, tooling or cost has been estimated.',
          rationale:
            'No validated template in the catalogue can be cut from a sheet of this size, so only ' +
            'a concept can be suggested.',
          targetSegments: [],
          risks: [
            'Concept only. Manufacturing validation is required before this can be quoted.',
            'No cutting layout, tooling list or cost estimate has been produced.',
          ],
        },
      ],
      rejectedIdeas: [],
      notes: [
        MOCK_NOTE,
        `None of the ${context.templates.length} candidate template(s) fit a ` +
          `${context.lengthMm} x ${context.widthMm} mm sheet.`,
      ],
    };
  }

  const chosen = fitting.slice(0, limit);

  return {
    candidates: chosen.map((template) => ({
      kind: 'template' as const,
      templateId: template.id,
      parameters: defaultParameters(template),
      conceptName: null,
      conceptDescription: null,
      rationale:
        `${template.name} can be cut from ${MATERIAL_FAMILY_LABELS[context.materialFamily]} of this ` +
        `size, and needs ${template.requiredTools.length} tool(s) at ${template.complexity} ` +
        'complexity.',
      targetSegments: [...template.targetSegments].slice(0, 3),
      risks: [...template.risks].slice(0, 2),
    })),
    rejectedIdeas: context.templates
      .filter((template) => !fitting.includes(template))
      .map((template) => `${template.name}: no panel fits a ${context.lengthMm} x ${context.widthMm} mm sheet.`),
    notes: [MOCK_NOTE],
  };
}

export function mockFeasibilityExplanation(
  context: FeasibilityExplanationInput,
): FeasibilityExplanation {
  const failed = context.checks.filter((check) => check.outcome === 'fail');
  const warned = context.checks.filter((check) => check.outcome === 'warn');

  return {
    summary:
      failed.length > 0
        ? `${context.productName} cannot be produced from this material as it stands. ${failed.length} check(s) failed.`
        : `${context.productName} passes ${context.checks.length - warned.length} of ${context.checks.length} checks against this material.`,
    keyPoints: context.checks
      .filter((check) => check.outcome !== 'skipped')
      .slice(0, 5)
      .map((check) => `${check.label}: ${check.detail}`),
    caveats: [
      ...context.rejectReasons,
      ...context.warnings,
      context.disclaimer,
    ].slice(0, 6),
    nextActions:
      context.rejectReasons.length > 0
        ? [
            'Confirm or correct the material dimensions on the confirmation screen.',
            'Try a smaller product variation that fits the available sheet.',
          ]
        : [
            'Review the assumptions the estimate was built on.',
            'Check the cutting layout before committing to a batch.',
          ],
  };
}

export function mockBuyerSegments(context: BuyerSegmentsInput): BuyerSegmentSuggestion {
  const requested = context.curatedSegments.filter(
    (id): id is BuyerSegmentId => id in BUYER_SEGMENTS,
  );

  return {
    segments: requested.slice(0, 8).map((id) => {
      const segment = BUYER_SEGMENTS[id];
      return {
        segmentId: id,
        fit: segment.kind === 'b2b' ? ('strong' as const) : ('plausible' as const),
        rationale: `${segment.description} These are ${
          segment.kind === 'b2b' ? 'business' : 'consumer'
        } buyers who routinely purchase this kind of product category.`,
      };
    }),
    channelNotes:
      requested.length > 0
        ? [...new Set(requested.flatMap((id) => BUYER_SEGMENTS[id].typicalChannels))].slice(0, 5)
        : [],
    caveats: [
      'These are categories of buyer, not identified businesses. No organisation is claimed to be ' +
        'purchasing this product.',
      context.priceBandsAvailable
        ? 'Price guidance is available, so buyer segments were assessed against it.'
        : 'No market evidence exists for this category, so price was not considered.',
      MOCK_NOTE,
    ],
  };
}

export function mockOpportunitySummary(context: OpportunitySummaryInput): OpportunitySummary {
  return {
    headline: `${context.productName} from ${context.materialSummary}`,
    whyItWorks: [
      `The feasibility engine reports the product as ${context.feasibilityStatus}.`,
      context.maxUnits > 0
        ? `${context.maxUnits} unit(s) can be produced from the material on hand.`
        : 'No units can currently be produced from the material on hand.',
      context.unitCostMinor !== null
        ? `Production cost is ${context.unitCostMinor} ${context.currency} per unit under the stated assumptions.`
        : 'A production cost has not been calculated yet.',
    ],
    assumptions: [
      'Material, labour and overhead figures come from the editable assumptions panel, not from ' +
        'measured workshop costs.',
      'Cutting yield assumes a conservative guillotine layout.',
    ],
    unknowns: [
      context.referencePriceMinor === null
        ? 'No market reference price exists, so revenue cannot be estimated.'
        : 'Evidence quality for the reference price and how it transfers to your market.',
      context.bestBuyerScore === null
        ? 'No buyer segment could be scored.'
        : 'Whether any buyer in a suggested segment will actually order, and at what volume.',
    ],
    nextSteps: [
      'Review and correct the cost assumptions with your own numbers.',
      'Confirm the material dimensions before committing material to a batch.',
      'Open the opportunity to inspect the cutting layout and evidence before quoting a buyer.',
    ],
  };
}

export const MOCK_ADAPTER_NOTE = MOCK_NOTE;

export function mockFamilyLabel(family: MaterialFamily): string {
  return MATERIAL_FAMILY_LABELS[family];
}
