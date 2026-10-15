/**
 * Canonical unit handling.
 *
 * resaikel stores every physical dimension in **millimetres** as integers.
 * Anything the user types in another unit is converted at the boundary and
 * stored canonically. `mm` is a nominal integer; sub-millimetre precision is
 * meaningless for the materials this product deals with.
 */

export const MM_PER_CM = 10;
export const MM_PER_M = 1000;
export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** Nominal integer millimetres. */
export function roundMm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function cmToMm(value: number): number {
  return roundMm(value * MM_PER_CM);
}

export function mToMm(value: number): number {
  return roundMm(value * MM_PER_M);
}

export function inchToMm(value: number): number {
  return roundMm(value * MM_PER_INCH);
}

export function feetToMm(value: number): number {
  return roundMm(value * MM_PER_FOOT);
}

export function mmToCm(valueMm: number): number {
  return valueMm / MM_PER_CM;
}

export function mmToM(valueMm: number): number {
  return valueMm / MM_PER_M;
}

export function mmToInch(valueMm: number): number {
  return valueMm / MM_PER_INCH;
}

const MM_PER_UNIT: Record<LengthUnit, number> = {
  mm: 1,
  cm: MM_PER_CM,
  m: MM_PER_M,
  in: MM_PER_INCH,
  ft: MM_PER_FOOT,
};

export function toMm(value: number, unit: LengthUnit): number {
  return roundMm(value * MM_PER_UNIT[unit]);
}

export function fromMm(valueMm: number, unit: LengthUnit): number {
  return valueMm / MM_PER_UNIT[unit];
}

/** Area in square metres, derived from millimetre inputs. */
export function areaSquareMeters(lengthMm: number, widthMm: number): number {
  return (lengthMm / MM_PER_M) * (widthMm / MM_PER_M);
}

/** Total area in square metres for a number of identical rectangular pieces. */
export function totalAreaSquareMeters(
  lengthMm: number,
  widthMm: number,
  quantity: number,
): number {
  return areaSquareMeters(lengthMm, widthMm) * quantity;
}

/**
 * Formats a millimetre value for display, always suffixed with the unit so that
 * technical metadata in the UI is unambiguous.
 */
export function formatMm(valueMm: number, unit: LengthUnit = 'mm'): string {
  const converted = fromMm(valueMm, unit);
  const decimals = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  return `${converted.toFixed(decimals)} ${unit}`;
}

/** Compact `L x W x T` triple for dense metadata rows. */
export function formatDimensions(
  lengthMm: number,
  widthMm: number,
  thicknessMm?: number,
  unit: LengthUnit = 'mm',
): string {
  const parts = [formatMm(lengthMm, unit), formatMm(widthMm, unit)];
  if (thicknessMm !== undefined && thicknessMm > 0) parts.push(formatMm(thicknessMm, unit));
  return parts.join(' x ');
}

/** `1.24 m²` */
export function formatArea(squareMeters: number): string {
  if (squareMeters < 0.01) return `${Math.round(squareMeters * 10_000)} cm²`;
  return `${squareMeters.toFixed(2)} m²`;
}
