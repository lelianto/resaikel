import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SettingsForm } from '@/components/workspace/settings-form';
import { Container, PageHeader } from '@/components/ui/layout';
import { canAdminister } from '@/domain/identity/types';
import { requireCurrentAuth } from '@/server/auth/current';
import { getOrganization } from '@/server/repos/identity';

export const metadata: Metadata = { title: 'Settings' };

export default async function WorkspaceSettingsPage() {
  const auth = await requireCurrentAuth();
  const organization = await getOrganization(auth.orgId);
  if (!organization) notFound();

  return (
    <Container width="default" className="space-y-6 py-8">
      <Link
        href="/workspace"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Workspace
      </Link>

      <PageHeader
        eyebrow="Settings"
        title="Organisation"
        description="Country, city, currency and formatting. City is used for local buyer matching, and currency decides how every monetary figure in the product is expressed."
      />

      <SettingsForm
        canEdit={canAdminister(auth.role)}
        initial={{
          name: organization.name,
          country: organization.country,
          city: organization.city ?? '',
          currency: organization.currency,
          locale: organization.locale,
        }}
      />
    </Container>
  );
}
