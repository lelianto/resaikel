import type { Metadata } from 'next';
import Link from 'next/link';

import { OpportunityGrid } from '@/components/opportunity/opportunity-grid';
import { Container, PageHeader } from '@/components/ui/layout';
import { requireCurrentAuth } from '@/server/auth/current';
import { listOpportunityDocuments } from '@/server/repos/opportunities';

export const metadata: Metadata = { title: 'Opportunities' };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ materialId?: string; saved?: string }>;
}) {
  const auth = await requireCurrentAuth();
  const params = await searchParams;
  const savedOnly = params.saved === 'true';

  const result = await listOpportunityDocuments(auth.orgId, {
    savedOnly,
    materialId: params.materialId ?? null,
    limit: 24,
  });

  return (
    <Container width="wide" className="space-y-6 py-8">
      <PageHeader
        eyebrow="Commercial intelligence"
        title={savedOnly ? 'Saved opportunities' : 'Product opportunities'}
        description="Every candidate that survived the feasibility gates, ranked with its reasoning. Rejected candidates are kept in the list, below the viable ones, with the constraint that failed."
        actions={
          <>
            <Link
              href={savedOnly ? '/opportunities' : '/opportunities?saved=true'}
              className="text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
            >
              {savedOnly ? 'Show all' : 'Show saved only'}
            </Link>
            <Link
              href="/discover"
              className="text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
            >
              Run discovery
            </Link>
          </>
        }
      />

      {params.materialId ? (
        <p className="text-xs text-ink-muted">
          Filtered to one material.{' '}
          <Link href="/opportunities" className="underline underline-offset-2">
            Clear the filter
          </Link>
        </p>
      ) : null}

      <OpportunityGrid items={result.items} locale={auth.locale} />
    </Container>
  );
}
