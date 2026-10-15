/** ISO-8601 UTC timestamp string. All persisted dates use this representation. */
export type IsoDateTime = string;

/** ISO-8601 calendar date (`YYYY-MM-DD`), used for observation dates. */
export type IsoDate = string;

export const SCHEMA_VERSION = 1;

export interface OrgScoped {
  readonly orgId: string;
}

export interface Timestamped {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface Versioned {
  readonly schemaVersion: number;
}

/** Every persisted document in resaikel carries these fields. */
export interface BaseDocument extends OrgScoped, Timestamped, Versioned {
  readonly id: string;
}

export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Whole days between two instants; used for evidence freshness. */
export function daysBetween(from: IsoDateTime, to: IsoDateTime): number {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return Number.POSITIVE_INFINITY;
  return Math.floor((toMs - fromMs) / 86_400_000);
}

export type SortDirection = 'asc' | 'desc';

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
