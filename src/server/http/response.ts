import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { newRequestId } from '@/domain/ids';
import type { AuthContext, OrgRole } from '@/domain/identity/types';

import { requireAuth, requireRole } from '../auth/guards';
import { HttpError, toHttpError } from './errors';

/**
 * HTTP envelope and route wrapper.
 *
 * Every response is either `{ data, meta }` or `{ error, meta }`. The wrapper
 * owns request-id generation, authentication, error translation and logging, so
 * a route handler only contains domain logic.
 */

export interface SuccessBody<T> {
  readonly data: T;
  readonly meta: { readonly requestId: string };
}

export interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: Record<string, unknown>;
  };
  readonly meta: { readonly requestId: string };
}

export function jsonOk<T>(data: T, requestId: string, status = 200): NextResponse<SuccessBody<T>> {
  return NextResponse.json({ data, meta: { requestId } }, { status });
}

export function jsonAccepted<T>(
  data: T,
  requestId: string,
): NextResponse<SuccessBody<T>> {
  return NextResponse.json({ data, meta: { requestId } }, { status: 202 });
}

export function jsonError(error: HttpError, requestId: string): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      error: { code: error.code, message: error.message, details: error.details },
      meta: { requestId },
    },
    { status: error.status },
  );
}

type Params = Record<string, string>;

export interface PublicContext<P extends Params> {
  readonly request: NextRequest;
  readonly requestId: string;
  readonly params: P;
}

export interface AuthedContext<P extends Params> extends PublicContext<P> {
  readonly auth: AuthContext;
}

async function resolveParams<P extends Params>(
  context: { params: Promise<P> },
): Promise<P> {
  return context.params;
}

function logFailure(requestId: string, error: unknown): void {
  // Structured, single-line, no secrets and no request body.
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );
}

/** Route handler that does not require a session. */
export function publicRoute<P extends Params = Params>(
  handler: (context: PublicContext<P>) => Promise<NextResponse | undefined> | NextResponse | undefined,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      const params = await resolveParams(context);
      const response = await handler({ request, requestId, params });
      return response ?? jsonOk(null, requestId);
    } catch (error) {
      if (toHttpError(error).status >= 500) logFailure(requestId, error);
      return jsonError(toHttpError(error), requestId);
    }
  };
}

/**
 * Route handler that requires a verified session and, optionally, a minimum
 * organisation role. Authorisation is always resolved server-side from
 * `organization_members`; nothing the client sends is trusted for this.
 */
export function authedRoute<P extends Params = Params>(
  handler: (context: AuthedContext<P>) => Promise<NextResponse | undefined> | NextResponse | undefined,
  options: { readonly roles?: readonly OrgRole[] } = {},
) {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      const params = await resolveParams(context);
      const auth = await requireAuth();
      if (options.roles) requireRole(auth, options.roles);
      const response = await handler({ request, requestId, params, auth });
      return response ?? jsonOk(null, requestId);
    } catch (error) {
      if (toHttpError(error).status >= 500) logFailure(requestId, error);
      return jsonError(toHttpError(error), requestId);
    }
  };
}

/** Parses and validates a JSON body, rejecting anything that is not an object. */
export async function readJson<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError('INVALID_INPUT', 'The request body was not valid JSON.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError('INVALID_INPUT', 'The request body failed validation.', {
      details: {
        issues: parsed.error.issues.slice(0, 12).map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  return parsed.data as z.output<T>;
}

export function readQuery<T extends z.ZodTypeAny>(request: NextRequest, schema: T): z.output<T> {
  const entries: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    entries[key] = value;
  });

  const parsed = schema.safeParse(entries);
  if (!parsed.success) {
    throw new HttpError('INVALID_INPUT', 'The query parameters failed validation.', {
      details: {
        issues: parsed.error.issues.slice(0, 12).map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
  return parsed.data as z.output<T>;
}
