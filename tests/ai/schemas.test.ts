import { describe, expect, it } from 'vitest';

import {
  findUnsupportedClaims,
  MaterialAnalysisSchema,
  ProductCandidateSetSchema,
  validateAiResponse,
  type MaterialAnalysis,
} from '@/ai/schemas';

function validAnalysis(): MaterialAnalysis {
  return {
    category: 'cardboard',
    subtype: 'Corrugated sheet',
    color: 'Brown',
    texture: 'Smooth',
    shape: 'Flat sheet',
    condition: 'good',
    contamination: [],
    defects: [],
    reuseRestrictions: [],
    visibleEvidence: ['Flat sheet with parallel edges.'],
    missingInformation: ['Length and width must be measured.'],
    warnings: [],
    fieldConfidence: { category: 0.7 },
    notes: null,
  };
}

describe('MaterialAnalysisSchema', () => {
  it('accepts a complete, honest analysis', () => {
    const result = MaterialAnalysisSchema.safeParse(validAnalysis());
    expect(result.success).toBe(true);
  });

  it('rejects a response that omits a required key rather than filling it in', () => {
    const { fieldConfidence: _dropped, ...incomplete } = validAnalysis();
    const result = MaterialAnalysisSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((i) => i.path.join('.'))).toContain(
      'fieldConfidence',
    );
  });

  it('rejects an unknown material category', () => {
    const result = MaterialAnalysisSchema.safeParse({
      ...validAnalysis(),
      category: 'unobtainium',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown condition grade', () => {
    const result = MaterialAnalysisSchema.safeParse({
      ...validAnalysis(),
      condition: 'pristine',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a confidence outside 0..1', () => {
    const result = MaterialAnalysisSchema.safeParse({
      ...validAnalysis(),
      fieldConfidence: { category: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('has no field in which a fabricated measurement could be stored', () => {
    const keys = Object.keys(MaterialAnalysisSchema.shape);
    for (const forbidden of ['weight', 'weightKg', 'thickness', 'thicknessMm', 'strength', 'grade']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys).toContain('missingInformation');
  });
});

describe('findUnsupportedClaims', () => {
  it('flags measurement-like phrases the model wrote in prose', () => {
    const claims = findUnsupportedClaims({
      ...validAnalysis(),
      notes: 'The sheet measures roughly 1200 mm by 800 mm.',
      visibleEvidence: ['It looks about 5 kg.'],
    });

    expect(claims.join(' ')).toMatch(/1200 mm/);
    expect(claims.join(' ')).toMatch(/800 mm/);
    expect(claims.join(' ')).toMatch(/5 kg/);
  });

  it('flags strength and compliance units too', () => {
    const claims = findUnsupportedClaims({
      ...validAnalysis(),
      notes: 'Rated around 18 MPa and 350 gsm.',
    });
    expect(claims.length).toBeGreaterThan(0);
  });

  it('does not flag honest prose', () => {
    const claims = findUnsupportedClaims({
      ...validAnalysis(),
      notes: 'Length and width could not be determined from the photograph.',
    });
    expect(claims).toEqual([]);
  });

  it('deduplicates repeated claims', () => {
    const claims = findUnsupportedClaims({
      ...validAnalysis(),
      notes: 'About 200 mm.',
      visibleEvidence: ['Roughly 200 mm across.'],
    });
    expect(claims).toEqual(['200 mm']);
  });
});

describe('ProductCandidateSetSchema', () => {
  const templateCandidate = {
    kind: 'template' as const,
    templateId: 'cardboard-packaging-insert',
    parameters: { length: 300 },
    conceptName: null,
    conceptDescription: null,
    rationale: 'Fits the available board.',
    targetSegments: ['gift_companies'],
    risks: [],
  };

  it('accepts a template candidate', () => {
    const result = ProductCandidateSetSchema.safeParse({
      candidates: [templateCandidate],
      rejectedIdeas: [],
      notes: [],
    });
    expect(result.success).toBe(true);
  });

  it('requires a template id when the kind is a template', () => {
    const result = ProductCandidateSetSchema.safeParse({
      candidates: [{ ...templateCandidate, templateId: null }],
      rejectedIdeas: [],
      notes: [],
    });
    expect(result.success).toBe(false);
  });

  it('requires a name when the kind is a concept', () => {
    const result = ProductCandidateSetSchema.safeParse({
      candidates: [{ ...templateCandidate, kind: 'concept', conceptName: null }],
      rejectedIdeas: [],
      notes: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty candidate list', () => {
    const result = ProductCandidateSetSchema.safeParse({
      candidates: [],
      rejectedIdeas: [],
      notes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('validateAiResponse', () => {
  it('returns issues instead of throwing', () => {
    const result = validateAiResponse(MaterialAnalysisSchema, { category: 'cardboard' });
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.join(' ')).toMatch(/Required|expected|invalid/i);
  });

  it('returns the parsed value on success', () => {
    const result = validateAiResponse(MaterialAnalysisSchema, validAnalysis());
    expect(result.ok).toBe(true);
    expect(result.value?.category).toBe('cardboard');
  });
});
