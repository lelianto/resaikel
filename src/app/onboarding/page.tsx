import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingWizard } from '@/components/auth/onboarding-wizard';
import { Logo } from '@/components/signature/logo';
import { Container } from '@/components/ui/layout';
import { getAuthContext, getSessionUser } from '@/server/auth/guards';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Set up your organisation',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Onboarding lives outside the `(app)` group on purpose: that layout redirects a
 * user with no organisation straight here, so nesting this page inside it would
 * loop. It requires a session but not an organisation.
 */
export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const auth = await getAuthContext();
  if (auth) redirect('/overview');

  const suggestedOrg =
    user.displayName !== null && user.displayName.trim().length > 0
      ? `${user.displayName.trim().split(/\s+/)[0]}’s workshop`
      : '';

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <Container width="default" className="flex h-14 items-center">
          <Logo />
        </Container>
      </header>

      <Container width="narrow" className="py-10 sm:py-14">
        <div className="space-y-2">
          <div className="micro-label">Setup</div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-ink">
            Three questions, then you are in
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            resaikel is one product with role-based capabilities, not three separate applications.
            Your answers decide what is put in front of you first.
          </p>
        </div>

        <div className="mt-8">
          <OnboardingWizard
            defaultName={user.displayName ?? ''}
            defaultOrgName={suggestedOrg}
            defaultCurrency={serverConfig.defaults.currency}
            defaultCountry={serverConfig.defaults.country}
            defaultLocale={serverConfig.defaults.locale}
          />
        </div>
      </Container>
    </div>
  );
}
