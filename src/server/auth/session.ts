import { cookies } from 'next/headers';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { serverConfig } from '@/lib/config';

import { adminAuth } from '../firebase/admin';

/**
 * Session handling.
 *
 * The browser signs in with the Firebase client SDK, which yields a short-lived
 * ID token. That token is exchanged once for an httpOnly session cookie so the
 * cookie is never readable by JavaScript and cannot be lifted by an XSS bug.
 *
 * The ID token is never stored and never sent to the client on the way back.
 */

export interface SessionCookie {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: 'lax';
  readonly path: '/';
  readonly maxAgeSeconds: number;
}

export async function createSessionCookie(idToken: string): Promise<SessionCookie> {
  const auth = adminAuth();

  // Verifies the token first, so an invalid or revoked token never mints a cookie.
  await auth.verifyIdToken(idToken, true);

  const value = await auth.createSessionCookie(idToken, {
    expiresIn: serverConfig.sessionMaxAgeMs,
  });

  return {
    name: serverConfig.sessionCookieName,
    value,
    httpOnly: true,
    // The emulator suite runs over plain HTTP, so `secure` is only set where
    // cookies can actually be protected.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAgeSeconds: Math.floor(serverConfig.sessionMaxAgeMs / 1000),
  };
}

export async function verifySessionCookie(value: string): Promise<DecodedIdToken | null> {
  try {
    // checkRevoked=true makes a disabled or signed-out account take effect
    // immediately rather than at cookie expiry.
    return await adminAuth().verifySessionCookie(value, true);
  } catch {
    return null;
  }
}

/** Reads and verifies the session from the incoming request cookies. */
export async function readSession(): Promise<DecodedIdToken | null> {
  const store = await cookies();
  const value = store.get(serverConfig.sessionCookieName)?.value;
  if (!value) return null;
  return verifySessionCookie(value);
}

export function clearSessionCookie(): SessionCookie {
  return {
    name: serverConfig.sessionCookieName,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAgeSeconds: 0,
  };
}

/** Invalidates every session for a user, including the current one. */
export async function revokeSessions(uid: string): Promise<void> {
  await adminAuth().revokeRefreshTokens(uid);
}
