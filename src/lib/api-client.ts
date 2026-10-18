import type { ApiFailureBody, ApiSuccessBody } from '@/lib/contracts';

/**
 * Typed client for the resaikel API.
 *
 * Every response is unwrapped from the `{ data, meta }` envelope, and every
 * failure becomes an `ApiError` carrying the stable application error code, so a
 * caller can branch on `code` rather than parsing a message.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Blocking issues, when the server supplied a list. */
  get issues(): string[] {
    const issues = this.details['issues'];
    return Array.isArray(issues) ? issues.map(String) : [];
  }

  get blocking(): string[] {
    const blocking = this.details['blocking'];
    return Array.isArray(blocking) ? blocking.map(String) : [];
  }
}

export interface ApiRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  /** Prevents a retry from creating a second record or a second paid call. */
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  // FormData carries its own multipart content-type (with the boundary), so the
  // browser must set that header itself; forcing JSON here would corrupt it.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined && !isFormData) headers['content-type'] = 'application/json';
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      ...(options.body !== undefined
        ? { body: isFormData ? (options.body as FormData) : JSON.stringify(options.body) }
        : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // A network failure is not a server error, and saying so matters: the user may
    // simply be offline.
    throw new ApiError('NETWORK', 'Could not reach resaikel. Check your connection and try again.', 0);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError('INTERNAL', 'The server returned an unreadable response.', response.status);
    }
  }

  if (!response.ok) {
    const failure = parsed as ApiFailureBody | null;
    throw new ApiError(
      failure?.error?.code ?? 'INTERNAL',
      failure?.error?.message ?? 'Something went wrong.',
      response.status,
      failure?.error?.details ?? {},
    );
  }

  const success = parsed as ApiSuccessBody<T> | null;
  if (!success || success.data === undefined) {
    throw new ApiError('INTERNAL', 'The server returned an empty response.', response.status);
  }

  return success.data;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
