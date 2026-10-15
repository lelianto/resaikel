import { cache } from 'react';
import { redirect } from 'next/navigation';

import type { AuthContext } from '@/domain/identity/types';

import { getAuthContext, getSessionUser } from './guards';

/**
 * Per-request memoised session access for React Server Components.
 *
 * `cache()` means the layout and every page beneath it share a single set of
 * Firestore reads instead of each re-resolving the session. It lives in its own
 * module because `cache()` is a React server primitive and must not be imported
 * into a route handler.
 */

export const currentUser = cache(async () => getSessionUser());

export const currentAuth = cache(async () => getAuthContext());

/** Auth context or a redirect. Use from any page inside the `(app)` group. */
export async function requireCurrentAuth(): Promise<AuthContext> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const auth = await currentAuth();
  if (!auth) redirect('/onboarding');

  return auth;
}
