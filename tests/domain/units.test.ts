import { describe, expect, it } from 'vitest';

import {
  areaSquareMeters,
  cmToMm,
  feetToMm,
  formatArea,
  formatDimensions,
  formatMm,
  fromMm,
  inchToMm,
  mToMm,
  mmToInch,
  roundMm,
  toMm,
} from '@/domain/units';

describe('units', () => {
  it('converts every supported unit to whole millimetres', () => {
    expect(cmToMm(12.5)).toBe(125);
    expect(mToMm(1.2)).toBe(1200);
    expect(inchToMm(1)).toBe(25);
    expect(feetToMm(1)).toBe(305);
  });

  it('round-trips lengths without drifting', () => {
    expect(mmToInch(inchToMm(6))).toBeCloseTo(6, 1);
    expect(fromMm(toMm(3, 'cm'), 'cm')).toBeCloseTo(3, 6);
  });

  it('rounds to a nominal integer millimetre', () => {
    expect(roundMm(12.4)).toBe(12);
    expect(roundMm(12.5)).toBe(13);
    expect(roundMm(Number.NaN)).toBe(0);
  });

  it('computes area in square metres from millimetre inputs', () => {
    expect(areaSquareMeters(1000, 1000)).toBe(1);
    expect(areaSquareMeters(600, 400)).toBeCloseTo(0.24, 6);
  });

  it('formats dimensions with an explicit unit so metadata is unambiguous', () => {
    expect(formatDimensions(600, 400, 12)).toBe('600 mm x 400 mm x 12 mm');
    expect(formatDimensions(600, 400)).toBe('600 mm x 400 mm');
    expect(formatMm(1250, 'm')).toBe('1.25 m');
  });

  it('switches area units for very small surfaces', () => {
    expect(formatArea(1.24)).toBe('1.24 m²');
    expect(formatArea(0.004)).toBe('40 cm²');
  });
});
