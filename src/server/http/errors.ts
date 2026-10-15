import { AiError, type AiErrorCode } from '@/ai/errors';

/**
 * Application error taxonomy.
 *
 * HTTP status conveys transport semantics; `code` conveys domain semantics. The
 * two are deliberately not redundant - a 409 can be an idempotency conflict or a
 * status-transition conflict, and the client needs to tell them apart.
 */

export const APP_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'MATERIAL_NOT_FOUND',
  'MATERIAL_NOT_VERIFIED',
  'OPPORTUNITY_NOT_FOUND',
  'JOB_NOT_FOUND',
  'RATE_LIMITED',
  'AI_QUOTA_EXCEEDED',
  'IDEMPOTENCY_CONFLICT',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'INSUFFICIENT_MARKET_DATA',
  'AI_UNAVAILABLE',
  'AI_INVALID_OUTPUT',
  'AI_NOT_CONFIGURED',
  'AI_TIMEOUT',
  'AI_UNSAFE_RECOMMENDATION',
  'INTERNAL',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  MATERIAL_NOT_FOUND: 404,
  OPPORTUNITY_NOT_FOUND: 404,
  JOB_NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  AI_QUOTA_EXCEEDED: 429,
  INSUFFICIENT_MARKET_DATA: 422,
  AI_UNAVAILABLE: 503,
  AI_INVALID_OUTPUT: 502,
  AI_NOT_CONFIGURED: 503,
  AI_TIMEOUT: 504,
  AI_UNSAFE_RECOMMENDATION: 422,
  MATERIAL_NOT_VERIFIED: 422,
  INTERNAL: 500,
};

export interface HttpErrorOptions {
  readonly details?: Record<string, unknown>;
  readonly status?: number;
}

export class HttpError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: AppErrorCode, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.details = options.details ?? {};
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): HttpError {
  return new HttpError('INVALID_INPUT', message, details ? { details } : {});
}

export function unauthenticated(message = 'Sign in to continue.'): HttpError {
  return new HttpError('UNAUTHENTICATED', message);
}

export function forbidden(message = 'You do not have access to this resource.'): HttpError {
  return new HttpError('FORBIDDEN', message);
}

export function notFound(code: AppErrorCode, message: string): HttpError {
  return new HttpError(code, message);
}

const AI_CODE_MAP: Record<AiErrorCode, AppErrorCode> = {
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMITED: 'RATE_LIMITED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  AI_UNSAFE_RECOMMENDATION: 'AI_UNSAFE_RECOMMENDATION',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
};

/**
 * Converts anything thrown inside a route into a safe, typed HTTP error.
 *
 * The message for an unexpected failure is deliberately generic: internal
 * details belong in the server log, never in a response body.
 */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  if (error instanceof AiError) {
    return new HttpError(AI_CODE_MAP[error.code], error.message, {
      details: error.details.length > 0 ? { issues: error.details } : {},
    });
  }

  return new HttpError('INTERNAL', 'Something went wrong on our side. The failure was logged.');
}

/** True for failures that should not be reported to the client verbatim. */
export function isServerFault(error: unknown): boolean {
  return toHttpError(error).status >= 500;
}
