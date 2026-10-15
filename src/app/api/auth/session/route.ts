import type { NextRequest } from 'next/server';

import { newRequestId } from '@/domain/ids';
import { getAuthContext, requireSessionUser } from '@/server/auth/guards';
import { clearSessionCookie, createSessionCookie } from '@/server/auth/session';
import { adminAuth } from '@/server/firebase/admin';
import { HttpError, toHttpError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { jsonError, jsonOk, publicRoute, readJson } from '@/server/http/response';
import { sessionCreateSchema } from '@/server/http/schemas';
import { upsertUserProfile } from '@/server/repos/identity';

/**
 * Session exchange.
 *
 * The browser holds a short-lived Firebase ID token. This endpoint is the only
 * place it is accepted, and it is immediately exchanged for an httpOnly session
 * cookie. The token itself is never persisted and never echoed back.
 */
export const POST = publicRoute(async ({ request, requestId }) => {
  const body = await readJson(request, sessionCreateSchema);

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(body.idToken, true);
  } catch {
    throw new HttpError('UNAUTHENTICATED', 'That sign-in token is not valid or has expired.');
  }

  await upsertUserProfile({
    uid: decoded.uid,
    email: decoded.email ?? null,
    emailVerified: decoded.email_verified === true,
    displayName: typeof decoded.name === 'string' ? decoded.name : null,
  });

  const session = await createSessionCookie(body.idToken);
  const response = jsonOk(
    {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified === true,
    },
    requestId,
  );

  response.cookies.set({
    name: session.name,
    value: session.value,
    httpOnly: session.httpOnly,
    secure: session.secure,
    sameSite: session.sameSite,
    path: session.path,
    maxAge: session.maxAgeSeconds,
  });

  return response;
});

/** Sign out. Clears the cookie; revocation is available for privileged sessions. */
export function DELETE(request: NextRequest) {
  void request;
  const requestId = newRequestId();
  try {
    const response = jsonOk({ signedOut: true }, requestId);
    const cookie = clearSessionCookie();
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAgeSeconds,
    });
    return response;
  } catch (error) {
    return jsonError(toHttpError(error), requestId);
  }
}

/** Profile probe for client components, so they need no full page reload. */
export const GET = publicRoute(async ({ requestId }) => {
  const user = await requireSessionUser();
  const auth = await getAuthContext();

  if (auth) await enforceRateLimit(auth, 'api');

  return jsonOk(
    {
      user,
      organisation: auth
        ? {
            orgId: auth.orgId,
            name: auth.orgName,
            role: auth.role,
            currency: auth.currency,
            country: auth.country,
            onboardingCompleted: auth.onboardingCompleted,
          }
        : null,
    },
    requestId,
  );
});
