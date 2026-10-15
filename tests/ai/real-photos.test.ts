import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyzeMaterial } from '@/ai/service';
import { findUnsupportedClaims, MaterialAnalysisSchema } from '@/ai/schemas';
import { detectImageType } from '@/server/firebase/storage';
import { MAX_UPLOAD_BYTES } from '@/lib/image';

/**
 * Real-photograph tests.
 *
 * These run genuine JPEG bytes — downloaded from Wikimedia Commons, not
 * synthesised — through the same byte-level validation the upload route uses and
 * through the material-analysis contract.
 *
 * The AI_MODE=mock environment makes the analysis deterministic and free, so this
 * suite exercises the schema, the guardrails and the adapter boundary with real
 * image data and no network or API cost. Set AI_MODE=live and GEMINI_API_KEY to
 * have it hit the real model instead.
 *
 * The fixtures are skipped rather than failed when absent, so the suite still runs
 * in a checkout without them.
 */

const PHOTO_DIR = fileURLToPath(new URL('../fixtures/photos/', import.meta.url));

function load(name: string): Buffer | null {
  const path = `${PHOTO_DIR}${name}`;
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

const plywood = load('small-plywood-offcuts.jpg');
const cardboard = load('small-corrugated-cardboard.jpg');
const fixturesPresent = plywood !== null && cardboard !== null;

describe.skipIf(!fixturesPresent)('real photographs', () => {
  it('identifies a real JPEG from its leading bytes', () => {
    expect(detectImageType(plywood!)).toBe('image/jpeg');
    expect(detectImageType(cardboard!)).toBe('image/jpeg');
  });

  it('accepts real photographs within the upload limit', () => {
    expect(plywood!.byteLength).toBeGreaterThan(10_000);
    expect(plywood!.byteLength).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(cardboard!.byteLength).toBeGreaterThan(10_000);
    expect(cardboard!.byteLength).toBeLessThan(MAX_UPLOAD_BYTES);
  });

  it('rejects a file whose bytes do not match its declared type', () => {
    // A text file renamed to .jpg is exactly the case the signature check exists
    // for: the browser-supplied MIME type would have claimed image/jpeg.
    expect(detectImageType(Buffer.from('PK\u0003\u0004 this is a zip file', 'utf8'))).toBeNull();
    expect(detectImageType(Buffer.from('<html><body>hello</body></html>', 'utf8'))).toBeNull();
    expect(detectImageType(Buffer.alloc(4))).toBeNull();
  });

  it('still recognises a PNG signature', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageType(png)).toBe('image/png');
  });

  it('analyses a real plywood photograph into a schema-valid result', async () => {
    const outcome = await analyzeMaterial({
      title: 'Plywood offcuts from a cabinet job',
      origin: 'Cabinet workshop',
      userNotes: 'Stored indoors for two months.',
      knownMeasurements: null,
      photoCount: 1,
      images: [{ mimeType: 'image/jpeg', dataBase64: plywood!.toString('base64') }],
      categoryHint: 'plywood',
    });

    // The response passed the schema, or analyzeMaterial would have thrown.
    expect(MaterialAnalysisSchema.safeParse(outcome.analysis).success).toBe(true);
    expect(outcome.analysis.category).toBe('plywood');
    expect(outcome.meta.mock).toBe(true);
    expect(outcome.meta.usage.totalTokens).toBe(0);
  });

  it('analyses a real cardboard photograph', async () => {
    const outcome = await analyzeMaterial({
      title: 'Corrugated cardboard sheets',
      origin: null,
      userNotes: null,
      knownMeasurements: null,
      photoCount: 1,
      images: [{ mimeType: 'image/jpeg', dataBase64: cardboard!.toString('base64') }],
      categoryHint: 'cardboard',
    });

    expect(outcome.analysis.category).toBe('cardboard');
    expect(outcome.analysis.condition).toBe('good');
  });

  it('never lets a real photograph produce a fabricated measurement', async () => {
    const outcome = await analyzeMaterial({
      title: 'Plywood offcuts',
      origin: null,
      userNotes: 'Roughly a metre across, I think.',
      knownMeasurements: null,
      photoCount: 1,
      images: [{ mimeType: 'image/jpeg', dataBase64: plywood!.toString('base64') }],
      categoryHint: 'plywood',
    });

    // The schema has no field a dimension could be stored in, and any
    // measurement-like prose is surfaced as a discarded claim.
    expect(findUnsupportedClaims(outcome.analysis)).toEqual([]);
    expect(Object.keys(MaterialAnalysisSchema.shape)).not.toContain('thicknessMm');
    expect(outcome.analysis.missingInformation.join(' ')).toMatch(/length and width/i);
  });
});

describe.skipIf(fixturesPresent)('real photographs (fixtures absent)', () => {
  it('skips without failing the suite', () => {
    expect(fixturesPresent).toBe(false);
  });
});
