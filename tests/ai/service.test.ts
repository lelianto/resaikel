import { describe, expect, it } from 'vitest';

import { analysisInputHash, contentDigest } from '@/ai/cache';
import { AiError } from '@/ai/errors';
import { findUnsafeClaims, resolveCandidateSet } from '@/ai/service';
import { AI_PROMPT_VERSION, findUnsupportedClaims } from '@/ai/schemas';
import { mockFamilyLabel, MOCK_ADAPTER_NOTE } from '@/ai/mock';
import { generateProductCandidates, analyzeMaterial } from '@/ai/service';
import { getTemplate, templatesForFamily } from '@/domain/catalog';
import type { ProductCandidateSet } from '@/ai/schemas';
import type { DiscoveryInput, MaterialAnalysisInput } from '@/ai/types';

function materialInput(overrides: Partial<MaterialAnalysisInput> = {}): MaterialAnalysisInput {
  return {
    title: 'Plywood offcuts from a cabinet job',
    origin: 'Workshop offcut bin',
    userNotes: null,
    knownMeasurements: null,
    photoCount: 2,
    images: [{ mimeType: 'image/jpeg', dataBase64: 'ZmFrZQ==' }],
    ...overrides,
  };
}

function discoveryInput(overrides: Partial<DiscoveryInput> = {}): DiscoveryInput {
  return {
    materialFamily: 'sheet_wood',
    materialCategory: 'plywood',
    materialSubtype: 'Plywood panel',
    condition: 'good',
    lengthMm: 600,
    widthMm: 400,
    thicknessMm: 12,
    sheetCount: 4,
    availableAreaM2: 0.96,
    templates: templatesForFamily('sheet_wood'),
    toolsAvailable: ['circular_saw', 'orbital_sander', 'hand_drill', 'clamps'],
    targetMarket: 'Indonesia',
    budget: { maxCandidates: 5 },
    ...overrides,
  };
}

const validCandidateSet = (candidates: ProductCandidateSet['candidates']): ProductCandidateSet => ({
  candidates,
  rejectedIdeas: [],
  notes: [],
});

describe('analysis caching', () => {
  it('produces the same key regardless of photograph order', () => {
    const forward = analysisInputHash({
      imageDigests: ['a', 'b', 'c'],
      promptVersion: AI_PROMPT_VERSION,
      model: 'gemini-2.5-flash-lite',
      context: 'plywood',
    });

    const reversed = analysisInputHash({
      imageDigests: ['c', 'b', 'a'],
      promptVersion: AI_PROMPT_VERSION,
      model: 'gemini-2.5-flash-lite',
      context: 'plywood',
    });

    expect(forward).toBe(reversed);
  });

  it('changes the key when a different model would be used', () => {
    const base = {
      imageDigests: ['a'],
      promptVersion: AI_PROMPT_VERSION,
      context: 'plywood',
    };
    expect(analysisInputHash({ ...base, model: 'm1' })).not.toBe(
      analysisInputHash({ ...base, model: 'm2' }),
    );
  });

  it('changes the key when the prompt contract changes', () => {
    const base = { imageDigests: ['a'], model: 'm1', context: 'plywood' };
    expect(analysisInputHash({ ...base, promptVersion: 'v1' })).not.toBe(
      analysisInputHash({ ...base, promptVersion: 'v2' }),
    );
  });

  it('digests image bytes', () => {
    expect(contentDigest('abc')).toHaveLength(64);
    expect(contentDigest('abc')).toBe(contentDigest('abc'));
    expect(contentDigest('abc')).not.toBe(contentDigest('abd'));
  });
});

describe('analyzeMaterial (mock adapter)', () => {
  it('infers a category from the owner description', async () => {
    const outcome = await analyzeMaterial(materialInput());
    expect(outcome.analysis.category).toBe('plywood');
    expect(outcome.meta.mock).toBe(true);
    expect(outcome.meta.usage.totalTokens).toBe(0);
  });

  it('recognises cardboard from the description', async () => {
    const outcome = await analyzeMaterial(
      materialInput({ title: 'Clean corrugated cardboard sheets' }),
    );
    expect(outcome.analysis.category).toBe('cardboard');
  });

  it('returns unknown rather than guessing when nothing is recognisable', async () => {
    const outcome = await analyzeMaterial(
      materialInput({ title: 'Some stuff', origin: null, userNotes: null }),
    );
    expect(outcome.analysis.category).toBe('unknown');
    expect(outcome.analysis.missingInformation.join(' ')).toMatch(/category must be chosen/);
  });

  it('always asks a person for the dimensions', async () => {
    const outcome = await analyzeMaterial(materialInput());
    expect(outcome.analysis.missingInformation.join(' ')).toMatch(/length and width/i);
    expect(outcome.analysis.missingInformation.join(' ')).toMatch(/thickness/i);
  });

  it('never reports a measurement it cannot see', async () => {
    const outcome = await analyzeMaterial(materialInput());
    expect(findUnsupportedClaims(outcome.analysis)).toEqual([]);
    expect(outcome.analysis.color).toBeNull();
    expect(outcome.analysis.texture).toBeNull();
  });

  it('projects contamination from the description into reuse restrictions', async () => {
    const outcome = await analyzeMaterial(
      materialInput({ userNotes: 'There is some oil staining on one corner.' }),
    );
    expect(outcome.analysis.contamination.length).toBeGreaterThan(0);
    expect(outcome.analysis.reuseRestrictions.join(' ')).toMatch(/removed before/);
  });

  it('marks reported damage as only fair condition', async () => {
    const outcome = await analyzeMaterial(
      materialInput({ userNotes: 'The corner is cracked and the edge is torn.' }),
    );
    expect(outcome.analysis.condition).toBe('fair');
    expect(outcome.analysis.defects.length).toBeGreaterThan(0);
  });

  it('discloses that no model was called', async () => {
    const outcome = await analyzeMaterial(materialInput());
    expect(outcome.analysis.notes).toBe(MOCK_ADAPTER_NOTE);
  });
});

describe('resolveCandidateSet', () => {
  const allowed = [getTemplate('sheetwood-phone-stand')!].filter(Boolean);

  it('accepts a valid template selection', () => {
    const { candidates, dropped } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'template',
          templateId: 'sheetwood-phone-stand',
          parameters: { width: 120 },
          conceptName: null,
          conceptDescription: null,
          rationale: 'Fits the offcut.',
          targetSegments: ['small_office'],
          risks: [],
        },
      ]),
      allowed,
    );

    expect(dropped).toHaveLength(0);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('template');
  });

  it('drops a template the model was not offered', () => {
    const { candidates, dropped } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'template',
          templateId: 'invented-laser-cut-lamp',
          parameters: {},
          conceptName: null,
          conceptDescription: null,
          rationale: 'A nice idea.',
          targetSegments: [],
          risks: [],
        },
      ]),
      allowed,
    );

    expect(candidates).toHaveLength(0);
    expect(dropped[0]?.reason).toMatch(/not in the catalogue subset/);
  });

  it('clamps out-of-range parameters and records why', () => {
    const { candidates } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'template',
          templateId: 'sheetwood-phone-stand',
          parameters: { width: 9999, depth: 80 },
          conceptName: null,
          conceptDescription: null,
          rationale: 'Wide stand.',
          targetSegments: [],
          risks: [],
        },
      ]),
      allowed,
    );

    const candidate = candidates[0];
    expect(candidate?.kind).toBe('template');
    if (candidate?.kind !== 'template') throw new Error('expected a template candidate');
    expect(candidate.parameters.width).toBe(160);
    expect(candidate.parameterIssues.join(' ')).toMatch(/outside/);
  });

  it('drops a candidate that claims certification', () => {
    const { candidates, dropped } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'template',
          templateId: 'sheetwood-phone-stand',
          parameters: {},
          conceptName: null,
          conceptDescription: null,
          rationale: 'This product is certified for food contact.',
          targetSegments: [],
          risks: [],
        },
      ]),
      allowed,
    );

    expect(candidates).toHaveLength(0);
    expect(dropped[0]?.reason).toMatch(/cannot be substantiated/);
  });

  it('keeps a concept as a concept and strips any geometry from it', () => {
    const { candidates } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'concept',
          templateId: null,
          parameters: { length: 400, width: 300 },
          conceptName: 'Modular desk riser',
          conceptDescription: 'A riser assembled from flat panels.',
          rationale: 'No catalogue template covers this shape.',
          targetSegments: ['small_office'],
          risks: ['Needs structural validation.'],
        },
      ]),
      allowed,
    );

    const candidate = candidates[0];
    expect(candidate?.kind).toBe('concept');
    expect(candidate && 'parameters' in candidate).toBe(false);
  });

  it('drops a concept that claims a load rating', () => {
    const { candidates, dropped } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'concept',
          templateId: null,
          parameters: {},
          conceptName: 'Heavy shelf',
          conceptDescription: 'A shelf.',
          rationale: 'Load rated to 40 kg.',
          targetSegments: [],
          risks: [],
        },
      ]),
      allowed,
    );

    expect(candidates).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it('filters target segments down to real ones the template supports', () => {
    const { candidates } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'template',
          templateId: 'sheetwood-phone-stand',
          parameters: {},
          conceptName: null,
          conceptDescription: null,
          rationale: 'Fits.',
          targetSegments: ['refurbishers', 'students', 'not_a_segment'],
          risks: [],
        },
      ]),
      allowed,
    );

    const candidate = candidates[0];
    if (candidate?.kind !== 'template') throw new Error('expected a template candidate');
    expect(candidate.targetSegments).toContain('students');
    expect(candidate.targetSegments).not.toContain('refurbishers');
    expect(candidate.targetSegments).not.toContain('not_a_segment');
  });

  it('deduplicates repeated template candidates from the model', () => {
    const duplicate = {
      kind: 'template' as const,
      templateId: 'sheetwood-phone-stand',
      parameters: { width: 90, depth: 80 },
      conceptName: null,
      conceptDescription: null,
      rationale: 'The available sheet can be cut into a compact stand.',
      targetSegments: ['students'],
      risks: [],
    };

    const { candidates, dropped } = resolveCandidateSet(
      validCandidateSet([
        duplicate,
        { ...duplicate, rationale: 'A second wording for the same product.' },
      ]),
      allowed,
    );

    expect(candidates).toHaveLength(1);
    expect(dropped).toEqual([
      expect.objectContaining({
        label: 'Phone stand',
        reason: expect.stringMatching(/duplicate/i),
      }),
    ]);
  });
});

describe('findUnsafeClaims', () => {
  it('catches compliance and safety language', () => {
    expect(findUnsafeClaims(['Fully certified for retail.'])).toHaveLength(1);
    expect(findUnsafeClaims(['Structurally safe for 20 kg.'])).toHaveLength(1);
    expect(findUnsafeClaims(['Fits a 300 mm sheet.'])).toHaveLength(0);
  });
});

describe('generateProductCandidates (mock adapter)', () => {
  it('selects real catalogue templates that fit the sheet', async () => {
    const outcome = await generateProductCandidates(discoveryInput());

    expect(outcome.candidates.length).toBeGreaterThan(0);
    expect(outcome.candidates.every((candidate) => candidate.kind === 'template')).toBe(true);
    expect(outcome.notes.join(' ')).toMatch(/mock adapter/i);

    for (const candidate of outcome.candidates) {
      if (candidate.kind !== 'template') continue;
      expect(allowedTemplateIds()).toContain(candidate.templateId);
    }
  });

  it('refuses to select a template that cannot be cut from the sheet', async () => {
    const outcome = await generateProductCandidates(
      discoveryInput({
        lengthMm: 120,
        widthMm: 90,
        templates: [getTemplate('sheetwood-display-shelf-small')!],
      }),
    );

    expect(outcome.candidates[0]?.kind).toBe('concept');
    expect(outcome.notes.join(' ')).toMatch(/None of the 1 candidate template/);
  });

  it('presents an unvalidatable idea as a concept only', async () => {
    const outcome = await generateProductCandidates(
      discoveryInput({
        lengthMm: 120,
        widthMm: 90,
        templates: [getTemplate('sheetwood-display-shelf-small')!],
      }),
    );

    const concept = outcome.candidates[0];
    if (concept?.kind !== 'concept') throw new Error('expected a concept candidate');
    expect(concept.risks.join(' ')).toMatch(/Concept only/);
    expect(concept.risks.join(' ')).toMatch(/Manufacturing validation is required/);
  });

  it('respects the candidate budget', async () => {
    const outcome = await generateProductCandidates(
      discoveryInput({ budget: { maxCandidates: 2 }, lengthMm: 700, widthMm: 500 }),
    );
    expect(outcome.candidates.length).toBeLessThanOrEqual(2);
  });

  it('reports which templates it rejected and why', async () => {
    // At 200 x 150 mm the desk organiser and shelf templates cannot be cut, but
    // the phone stand can, so some candidates survive and others are rejected.
    const outcome = await generateProductCandidates(
      discoveryInput({ lengthMm: 200, widthMm: 150 }),
    );

    expect(outcome.candidates.length).toBeGreaterThan(0);
    expect(outcome.rejectedIdeas.length).toBeGreaterThan(0);
    expect(outcome.rejectedIdeas.join(' ')).toMatch(/no panel fits/);
  });

  it('falls back to a concept when no templates are offered at all', async () => {
    const outcome = await generateProductCandidates(discoveryInput({ templates: [] }));

    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.candidates[0]?.kind).toBe('concept');
    expect(outcome.notes.join(' ')).toMatch(/No templates were offered/);
  });

  it('surfaces a validation rejection as a typed error', async () => {
    // A model output that survives JSON parsing but fails the catalogue check
    // must never be silently accepted.
    const { candidates, dropped } = resolveCandidateSet(
      validCandidateSet([
        {
          kind: 'template',
          templateId: 'sheetwood-phone-stand',
          parameters: {},
          conceptName: null,
          conceptDescription: null,
          rationale: 'Certified for food contact.',
          targetSegments: [],
          risks: [],
        },
      ]),
      [getTemplate('sheetwood-phone-stand')!],
    );

    expect(candidates).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(new AiError('AI_UNSAFE_RECOMMENDATION', 'x').code).toBe('AI_UNSAFE_RECOMMENDATION');
  });
});

describe('mock helpers', () => {
  it('labels families for prose', () => {
    expect(mockFamilyLabel('sheet_wood')).toBe('Sheet wood');
  });
});

function allowedTemplateIds(): string[] {
  return templatesForFamily('sheet_wood').map((template) => template.id);
}
