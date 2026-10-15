/**
 * Exact monetary arithmetic.
 *
 * Every amount is an integer count of **minor units** (sen for IDR, cents for
 * USD, ...) paired with an ISO-4217 currency code. Binary floating point is
 * never used for money: ratios and percentages are computed with integer
 * numerator/denominator arithmetic and a single deterministic rounding step.
 *
 * IDR has zero decimal digits, so 1 IDR === 1 minor unit. USD has two, so
 * 1 USD === 100 minor units. `minorUnitDigits` is the single place that knows
 * the difference.
 */

export type CurrencyCode = string;

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** Currencies with a non-two-digit minor unit. Default is 2. */
const MINOR_UNIT_DIGITS: Record<string, number> = {
  IDR: 0,
  VND: 0,
  KRW: 0,
  JPY: 0,
  CLP: 0,
  ISK: 0,
  HUF: 0,
  TWD: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
};

export function minorUnitDigits(currency: CurrencyCode): number {
  return MINOR_UNIT_DIGITS[currency.toUpperCase()] ?? 2;
}

export function money(amount: number, currency: CurrencyCode): Money {
  return { amount: Math.round(amount), currency };
}

export function zero(currency: CurrencyCode): Money {
  return { amount: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function sum(values: readonly Money[], currency: CurrencyCode): Money {
  let total = 0;
  for (const value of values) {
    if (value.currency !== currency) {
      throw new Error(`Currency mismatch: expected ${currency}, received ${value.currency}`);
    }
    total += value.amount;
  }
  return { amount: total, currency };
}

/** Multiplies by a whole number of units - exact, no rounding needed. */
export function multiplyByQuantity(value: Money, quantity: number): Money {
  return { amount: value.amount * Math.round(quantity), currency: value.currency };
}

/**
 * Scales by `numerator / denominator` using integer arithmetic with a single
 * half-up rounding step. Use this for percentages, margins, tax and any other
 * rational factor instead of multiplying by a float.
 */
export function scaleByRatio(
  value: Money,
  numerator: number,
  denominator: number,
): Money {
  if (denominator === 0) {
    throw new Error('scaleByRatio: denominator must not be zero');
  }
  return {
    amount: Math.round((value.amount * numerator) / denominator),
    currency: value.currency,
  };
}

/** `applyPercent(m, 15)` -> 15% of `m`, half-up. */
export function percentOf(value: Money, percent: number): Money {
  return scaleByRatio(value, percent, 100);
}

/**
 * Like `scaleByRatio` but rounds **up**. Used where rounding down would let a
 * quote understate a real cost.
 */
export function scaleByRatioUp(value: Money, numerator: number, denominator: number): Money {
  if (denominator === 0) {
    throw new Error('scaleByRatioUp: denominator must not be zero');
  }
  return {
    amount: Math.ceil((value.amount * numerator) / denominator),
    currency: value.currency,
  };
}

/**
 * Percentage with two decimal places of precision, expressed in hundredths of a
 * percent so the arithmetic stays integral: `percentOfPrecise(m, 2.5)` applies
 * exactly 2.5%.
 */
export function percentOfPrecise(value: Money, percent: number): Money {
  return scaleByRatio(value, Math.round(percent * 100), 10_000);
}

export function percentOfPreciseUp(value: Money, percent: number): Money {
  return scaleByRatioUp(value, Math.round(percent * 100), 10_000);
}

export function addPercent(value: Money, percent: number): Money {
  return add(value, percentOf(value, percent));
}

/**
 * Allocation of a lump sum across weighted shares without losing or inventing a
 * single minor unit: the remainder is distributed one unit at a time to the
 * largest fractional shares (largest-remainder / Hare-Niemeyer method).
 */
export function allocate(
  total: Money,
  weights: readonly number[],
): Money[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum <= 0) {
    return weights.map(() => zero(total.currency));
  }

  const exact = weights.map((w) => (total.amount * w) / weightSum);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = total.amount - floored.reduce((acc, v) => acc + v, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => (b.fraction === a.fraction ? a.index - b.index : b.fraction - a.fraction));

  const result = [...floored];
  for (const entry of order) {
    if (remainder <= 0) break;
    result[entry.index] = (result[entry.index] ?? 0) + 1;
    remainder -= 1;
  }

  return result.map((amount) => ({ amount, currency: total.currency }));
}

/**
 * Derives a unit price from a batch total, always rounding **up** so that a
 * batch is never priced below its cost.
 */
export function unitPriceFromBatch(batch: Money, quantity: number): Money {
  if (quantity <= 0) throw new Error('unitPriceFromBatch: quantity must be positive');
  return {
    amount: Math.ceil(batch.amount / quantity),
    currency: batch.currency,
  };
}

/**
 * Gross contribution margin in basis points (1 bps = 0.01%), derived from exact
 * integers so the figure is stable across platforms. Returns `null` when the
 * selling price is zero, because a margin is undefined rather than infinite.
 */
export function contributionMarginBps(cost: Money, price: Money): number | null {
  assertSameCurrency(cost, price);
  if (price.amount === 0) return null;
  const contribution = price.amount - cost.amount;
  return Math.round((contribution * 10_000) / price.amount);
}

/** Break-even quantity: how many units must sell to recover a fixed cost. */
export function breakEvenUnits(fixedCost: Money, contributionPerUnit: Money): number | null {
  assertSameCurrency(fixedCost, contributionPerUnit);
  if (contributionPerUnit.amount <= 0) return null;
  return Math.ceil(fixedCost.amount / contributionPerUnit.amount);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  value: Money,
  locale = 'id-ID',
  options: { compact?: boolean; withCurrency?: boolean } = {},
): string {
  const digits = minorUnitDigits(value.currency);
  const divisor = 10 ** digits;
  const key = `${locale}|${value.currency}|${options.compact ? 1 : 0}|${options.withCurrency === false ? 0 : 1}`;

  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: options.withCurrency === false ? 'decimal' : 'currency',
      currency: options.withCurrency === false ? undefined : value.currency,
      notation: options.compact ? 'compact' : 'standard',
      maximumFractionDigits: digits,
      minimumFractionDigits: options.compact ? 0 : digits,
    });
    formatterCache.set(key, formatter);
  }

  return formatter.format(value.amount / divisor);
}

/** Plain decimal string without grouping or currency symbol - for CSV/export. */
export function toDecimalString(value: Money): string {
  const digits = minorUnitDigits(value.currency);
  if (digits === 0) return String(value.amount);
  const sign = value.amount < 0 ? '-' : '';
  const absolute = Math.abs(value.amount);
  const divisor = 10 ** digits;
  const whole = Math.floor(absolute / divisor);
  const fraction = String(absolute % divisor).padStart(digits, '0');
  return `${sign}${whole}.${fraction}`;
}
