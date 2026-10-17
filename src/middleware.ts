import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware.
 *
 * This runs on the edge runtime, which cannot load firebase-admin, so it performs
 * an *optimistic* check only: is a session cookie present at all? A missing cookie
 * is redirected to sign-in immediately; a present cookie is allowed through and
 * verified properly - with revocation checking - in the server layout and in every
 * API route via `requireAuth`.
 *
 * It is a redirect optimisation and a first line of defence, never the
 * authorisation decision.
 */

const PROTECTED_PREFIXES = [
  '/overview',
  '/materials',
  '/discover',
  '/opportunities',
  '/circularity',
  '/workspace',
  '/onboarding',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();

  const cookieName = process.env.SESSION_COOKIE_NAME?.trim() || 'resaikel_session';
  const hasSession = Boolean(request.cookies.get(cookieName)?.value);

  if (hasSession) return NextResponse.next();

  const signInUrl = new URL('/sign-in', request.url);
  signInUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    '/overview/:path*',
    '/materials/:path*',
    '/discover/:path*',
    '/opportunities/:path*',
    '/circularity/:path*',
    '/workspace/:path*',
    '/onboarding/:path*',
  ],
};
