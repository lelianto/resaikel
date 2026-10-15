import { describe, expect, it } from 'vitest';

import {
  add,
  allocate,
  breakEvenUnits,
  contributionMarginBps,
  formatMoney,
  minorUnitDigits,
  money,
  multiplyByQuantity,
  percentOf,
  scaleByRatio,
  subtract,
  sum,
  toDecimalString,
  unitPriceFromBatch,
} from '@/domain/money';

describe('money', () => {
  it('knows the minor unit digits per currency', () => {
    expect(minorUnitDigits('IDR')).toBe(0);
    expect(minorUnitDigits('USD')).toBe(2);
    expect(minorUnitDigits('KWD')).toBe(3);
    expect(minorUnitDigits('XYZ')).toBe(2);
  });

  it('rejects arithmetic across currencies', () => {
    expect(() => add(money(100, 'IDR'), money(100, 'USD'))).toThrow(/Currency mismatch/);
    expect(() => sum([money(1, 'IDR'), money(1, 'USD')], 'IDR')).toThrow(/Currency mismatch/);
  });

  it('adds, subtracts and multiplies exactly in minor units', () => {
    expect(add(money(1250, 'USD'), money(750, 'USD')).amount).toBe(2000);
    expect(subtract(money(1250, 'USD'), money(750, 'USD')).amount).toBe(500);
    expect(multiplyByQuantity(money(333, 'USD'), 3).amount).toBe(999);
  });

  it('rounds ratios half-up from integer arithmetic, never from floats', () => {
    // 1/3 of 100 minor units is 33.333... -> 33
    expect(scaleByRatio(money(100, 'USD'), 1, 3).amount).toBe(33);
    // 2/3 of 100 is 66.666... -> 67
    expect(scaleByRatio(money(100, 'USD'), 2, 3).amount).toBe(67);
    // 15% of 12_345
    expect(percentOf(money(12_345, 'IDR'), 15).amount).toBe(1852);
  });

  it('rejects a zero denominator instead of producing Infinity', () => {
    expect(() => scaleByRatio(money(100, 'USD'), 1, 0)).toThrow(/denominator/);
  });

  it('allocates a lump sum without losing or inventing a minor unit', () => {
    const parts = allocate(money(100, 'USD'), [1, 1, 1]);
    expect(parts.map((part) => part.amount)).toEqual([34, 33, 33]);
    expect(parts.reduce((total, part) => total + part.amount, 0)).toBe(100);

    const weighted = allocate(money(10_000, 'IDR'), [30, 50, 20]);
    expect(weighted.map((part) => part.amount)).toEqual([3000, 5000, 2000]);
    expect(weighted.reduce((total, part) => total + part.amount, 0)).toBe(10_000);
  });

  it('rounds a batch unit price up so a batch is never priced below cost', () => {
    expect(unitPriceFromBatch(money(1000, 'IDR'), 3).amount).toBe(334);
    expect(unitPriceFromBatch(money(999, 'IDR'), 3).amount).toBe(333);
  });

  it('computes contribution margin in basis points and refuses a zero price', () => {
    expect(contributionMarginBps(money(600, 'IDR'), money(1000, 'IDR'))).toBe(4000);
    expect(contributionMarginBps(money(1200, 'IDR'), money(1000, 'IDR'))).toBe(-2000);
    expect(contributionMarginBps(money(100, 'IDR'), money(0, 'IDR'))).toBeNull();
  });

  it('computes break-even units and refuses a non-positive contribution', () => {
    expect(breakEvenUnits(money(10_000, 'IDR'), money(400, 'IDR'))).toBe(25);
    expect(breakEvenUnits(money(10_000, 'IDR'), money(0, 'IDR'))).toBeNull();
    expect(breakEvenUnits(money(10_000, 'IDR'), money(-5, 'IDR'))).toBeNull();
  });

  it('formats whole-rupiah IDR without decimal places', () => {
    const formatted = formatMoney(money(150_000, 'IDR'), 'id-ID');
    expect(formatted).toMatch(/150\.000/);
    expect(formatted).not.toMatch(/,00/);
  });

  it('formats USD from cents', () => {
    const formatted = formatMoney(money(1234, 'USD'), 'en-US');
    expect(formatted).toBe('$12.34');
  });

  it('renders a machine-readable decimal string', () => {
    expect(toDecimalString(money(1234, 'USD'))).toBe('12.34');
    expect(toDecimalString(money(-1234, 'USD'))).toBe('-12.34');
    expect(toDecimalString(money(150_000, 'IDR'))).toBe('150000');
  });
});
