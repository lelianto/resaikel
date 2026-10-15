import { describe, expect, it } from 'vitest';

import { packParts, stockUsableAreaMm2 } from '@/domain/feasibility/packing';
import type { PartToPack, StockPiece } from '@/domain/feasibility/packing';

function sheet(overrides: Partial<StockPiece> = {}): StockPiece {
  return { id: 's1', label: 'Sheet', lengthMm: 600, widthMm: 400, quantity: 1, ...overrides };
}

function part(overrides: Partial<PartToPack> = {}): PartToPack {
  return { id: 'p1', name: 'Panel', lengthMm: 100, widthMm: 100, quantity: 1, rotatable: true, ...overrides };
}

describe('packParts', () => {
  it('places exactly one part when the part fills the sheet', () => {
    const result = packParts({
      stock: [sheet({ lengthMm: 100, widthMm: 100 })],
      parts: [part({ quantity: 2 })],
      kerfMm: 3,
    });

    expect(result.placements).toHaveLength(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]?.quantity).toBe(1);
    expect(result.wastePercent).toBe(0);
  });

  it('rotates a part when that is the only way it fits', () => {
    const result = packParts({
      stock: [sheet({ lengthMm: 100, widthMm: 140 })],
      parts: [part({ lengthMm: 120, widthMm: 80 })],
      kerfMm: 0,
    });

    expect(result.unplaced).toHaveLength(0);
    expect(result.placements[0]?.rotated).toBe(true);
    expect(result.placements[0]?.lengthMm).toBe(80);
    expect(result.placements[0]?.widthMm).toBe(120);
  });

  it('refuses to rotate a part that is not rotatable', () => {
    const result = packParts({
      stock: [sheet({ lengthMm: 100, widthMm: 140 })],
      parts: [part({ lengthMm: 120, widthMm: 80, rotatable: false })],
      kerfMm: 0,
    });

    expect(result.placements).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
  });

  it('deducts kerf between adjacent parts', () => {
    // Two 100mm parts side by side need 100 + 3 + 100 = 203mm of width.
    const tight = packParts({
      stock: [sheet({ lengthMm: 202, widthMm: 100 })],
      parts: [part({ quantity: 2 })],
      kerfMm: 3,
    });
    expect(tight.unplaced).toHaveLength(1);

    const roomy = packParts({
      stock: [sheet({ lengthMm: 203, widthMm: 100 })],
      parts: [part({ quantity: 2 })],
      kerfMm: 3,
    });
    expect(roomy.unplaced).toHaveLength(0);
  });

  it('keeps placements disjoint', () => {
    const result = packParts({
      stock: [sheet({ lengthMm: 400, widthMm: 300 })],
      parts: [part({ lengthMm: 150, widthMm: 100, quantity: 6 })],
      kerfMm: 3,
    });

    const rects = result.placements.map((placement) => ({
      x1: placement.xMm,
      y1: placement.yMm,
      x2: placement.xMm + placement.lengthMm,
      y2: placement.yMm + placement.widthMm,
    }));

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        if (!a || !b) continue;
        const overlaps = a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
        expect(overlaps, `placements ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  it('keeps every placement inside its sheet', () => {
    const stock = sheet({ lengthMm: 300, widthMm: 200, quantity: 3 });
    const result = packParts({
      stock: [stock],
      parts: [part({ lengthMm: 140, widthMm: 90, quantity: 8 })],
      kerfMm: 3,
    });

    for (const placement of result.placements) {
      expect(placement.xMm).toBeGreaterThanOrEqual(0);
      expect(placement.yMm).toBeGreaterThanOrEqual(0);
      expect(placement.xMm + placement.lengthMm).toBeLessThanOrEqual(stock.lengthMm);
      expect(placement.yMm + placement.widthMm).toBeLessThanOrEqual(stock.widthMm);
    }
  });

  it('never consumes more sheets than were supplied', () => {
    const result = packParts({
      stock: [sheet({ lengthMm: 300, widthMm: 200, quantity: 2 })],
      parts: [part({ lengthMm: 140, widthMm: 90, quantity: 20 })],
      kerfMm: 3,
    });

    expect(result.stockConsumed).toBeLessThanOrEqual(2);
    expect(result.stockAvailable).toBe(2);
    expect(result.unplaced.length).toBeGreaterThan(0);
  });

  it('excludes defect zones from the usable area', () => {
    const stock = sheet({
      lengthMm: 200,
      widthMm: 100,
      defectZones: [{ xMm: 0, yMm: 0, widthMm: 200, heightMm: 50 }],
    });

    // 60mm tall part cannot fit in the surviving 50mm band.
    const blocked = packParts({ stock: [stock], parts: [part({ lengthMm: 100, widthMm: 60 })], kerfMm: 0 });
    expect(blocked.placements).toHaveLength(0);

    // A 40mm tall part fits.
    const ok = packParts({ stock: [stock], parts: [part({ lengthMm: 100, widthMm: 40 })], kerfMm: 0 });
    expect(ok.placements).toHaveLength(1);
    expect(ok.placements[0]?.yMm).toBe(50);
  });

  it('reports defective area as unusable, not as waste', () => {
    const stock = sheet({
      lengthMm: 200,
      widthMm: 100,
      quantity: 1,
      defectZones: [{ xMm: 0, yMm: 0, widthMm: 200, heightMm: 50 }],
    });
    expect(stockUsableAreaMm2([stock])).toBe(200 * 100 - 200 * 50);
  });

  it('is deterministic for identical input', () => {
    const build = () =>
      packParts({
        stock: [sheet({ lengthMm: 600, widthMm: 400, quantity: 3 })],
        parts: [
          part({ id: 'a', name: 'A', lengthMm: 220, widthMm: 140, quantity: 4 }),
          part({ id: 'b', name: 'B', lengthMm: 120, widthMm: 90, quantity: 6 }),
          part({ id: 'c', name: 'C', lengthMm: 300, widthMm: 40, quantity: 3 }),
        ],
        kerfMm: 3,
      });

    expect(build()).toEqual(build());
  });

  it('prefers the cheaper sheet when a part fits more than one way', () => {
    // A wide part should be placed in the wide orientation rather than rotated
    // into a tall one when both fit.
    const result = packParts({
      stock: [sheet({ lengthMm: 400, widthMm: 200 })],
      parts: [part({ lengthMm: 300, widthMm: 100, quantity: 1 })],
      kerfMm: 0,
    });
    expect(result.placements[0]?.rotated).toBe(false);
  });

  it('bails out with a limit notice instead of hanging on a pathological input', () => {
    const result = packParts({
      stock: [sheet({ quantity: 50 })],
      parts: [part({ quantity: 5_000 })],
      kerfMm: 3,
      maxParts: 400,
    });

    expect(result.limitReached).toBe(true);
    expect(result.placements).toHaveLength(0);
    expect(result.unplaced.length).toBeGreaterThan(0);
  });
});
