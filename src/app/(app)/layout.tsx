import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { ORG_ROLE_LABELS, USER_ROLE_LABELS } from '@/domain/identity/types';
import { getAuthContext, getSessionUser } from '@/server/auth/guards';

/**
 * Authenticated application layout.
 *
 * Authorisation happens here, on the server, before a single byte of tenant data
 * is rendered. A signed-in user with no organisation is sent to onboarding rather
 * than shown an empty shell.
 *
 * `force-dynamic` is deliberate: every screen in this group reads tenant data
 * through the session, so there is nothing safe to cache statically.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const auth = await getAuthContext();
  if (!auth) redirect('/onboarding');

  return (
    <AppShell
      identity={{
        displayName: user.displayName ?? user.email ?? 'Your account',
        email: user.email,
        orgName: auth.orgName,
        roleLabel: ORG_ROLE_LABELS[auth.role],
        currency: auth.currency,
        country: auth.country,
        roleLabels: auth.roles.map((role) => USER_ROLE_LABELS[role]),
        onboarded: auth.onboardingCompleted,
      }}
    >
      {children}
    </AppShell>
  );
}
