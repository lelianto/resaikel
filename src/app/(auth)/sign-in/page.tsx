import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthPanel } from '@/components/auth/auth-panel';
import { getAuthContext, getSessionUser } from '@/server/auth/guards';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to resaikel.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  // Already signed in? Skip the form rather than showing it again.
  const user = await getSessionUser();
  if (user) {
    const auth = await getAuthContext();
    redirect(auth ? (params.next ?? '/overview') : '/onboarding');
  }

  const requested = params.next ?? '/overview';
  // Only same-origin paths are honoured, so `next` cannot be used as an open
  // redirect.
  const nextPath = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/overview';

  return <AuthPanel nextPath={nextPath} />;
}
