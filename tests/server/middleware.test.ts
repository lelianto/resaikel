import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { config, middleware } from '@/middleware';

/**
 * Edge middleware tests.
 *
 * Verifies optimistic session checks at the edge:
 *   1. Protected routes without a session cookie redirect to /sign-in, preserving
 *      the requested pathname and query string in `next`.
 *   2. The /circularity dashboard is fully protected at the edge alongside all other
 *      authenticated app routes.
 *   3. Authenticated requests with a session cookie pass through.
 *   4. Public marketing routes pass through unauthenticated.
 *   5. Custom SESSION_COOKIE_NAME configuration is respected.
 */

const BASE_URL = 'https://resaikel.app';

function createRequest(path: string, cookieValue?: string, cookieName = 'resaikel_session'): NextRequest {
  const headers = new Headers();
  if (cookieValue) {
    headers.set('cookie', `${cookieName}=${cookieValue}`);
  }
  return new NextRequest(`${BASE_URL}${path}`, { headers });
}

describe('Edge Middleware', () => {
  const originalEnv = process.env.SESSION_COOKIE_NAME;

  beforeEach(() => {
    delete process.env.SESSION_COOKIE_NAME;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SESSION_COOKIE_NAME = originalEnv;
    } else {
      delete process.env.SESSION_COOKIE_NAME;
    }
  });

  describe('Unauthenticated access to protected routes', () => {
    const protectedPaths = [
      '/overview',
      '/materials',
      '/materials/new',
      '/materials/mat-123',
      '/discover',
      '/opportunities',
      '/opportunities/opp-123',
      '/workspace',
      '/workspace/settings',
      '/circularity',
      '/onboarding',
    ];

    for (const path of protectedPaths) {
      it(`redirects unauthenticated access to ${path} to /sign-in`, () => {
        const req = createRequest(path);
        const res = middleware(req);

        expect(res.status).toBe(307);
        const location = res.headers.get('location');
        expect(location).not.toBeNull();

        const redirectUrl = new URL(location!);
        expect(redirectUrl.pathname).toBe('/sign-in');
        expect(redirectUrl.searchParams.get('next')).toBe(path);
      });
    }

    it('preserves query parameters in next parameter when redirecting', () => {
      const req = createRequest('/discover?materialId=mat_abc123&focus=feasibility');
      const res = middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).not.toBeNull();

      const redirectUrl = new URL(location!);
      expect(redirectUrl.pathname).toBe('/sign-in');
      expect(redirectUrl.searchParams.get('next')).toBe('/discover?materialId=mat_abc123&focus=feasibility');
    });
  });

  describe('Authenticated access to protected routes', () => {
    it('allows access to protected routes when session cookie is present', () => {
      const req = createRequest('/circularity', 'valid-session-token');
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('respects custom SESSION_COOKIE_NAME from environment', () => {
      process.env.SESSION_COOKIE_NAME = 'custom_auth_cookie';

      const unauthedReq = createRequest('/overview', 'token', 'resaikel_session');
      const unauthedRes = middleware(unauthedReq);
      expect(unauthedRes.status).toBe(307);

      const authedReq = createRequest('/overview', 'token', 'custom_auth_cookie');
      const authedRes = middleware(authedReq);
      expect(authedRes.status).toBe(200);
      expect(authedRes.headers.get('location')).toBeNull();
    });
  });

  describe('Public marketing and unauthenticated routes', () => {
    const publicPaths = [
      '/',
      '/about',
      '/community',
      '/how-it-works',
      '/impact',
      '/sign-in',
      '/api/auth/session',
    ];

    for (const path of publicPaths) {
      it(`allows unauthenticated access to ${path}`, () => {
        const req = createRequest(path);
        const res = middleware(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      });
    }
  });

  describe('Route matcher configuration', () => {
    it('includes circularity in route matcher', () => {
      expect(config.matcher).toContain('/circularity/:path*');
    });
  });
});

