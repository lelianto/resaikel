import { Boxes, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { PhotoPlaceholder, PhotoThumbnail } from '@/components/material/photo-gallery';
import { MaterialStatusBadge, SampleDataBadge } from '@/components/material/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, Grid, PageHeader } from '@/components/ui/layout';
import { QUANTITY_UNIT_LABELS, MATERIAL_CATEGORY_LABELS } from '@/domain/materials/types';
import type { MaterialStatus } from '@/domain/materials/types';
import { formatDimensions } from '@/domain/units';
import { listMaterialDocuments } from '@/server/repos/materials';
import { requireCurrentAuth } from '@/server/auth/current';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Materials' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'needs_confirmation', label: 'Needs confirmation' },
  { value: 'verified', label: 'Verified' },
  { value: 'archived', label: 'Archived' },
] as const;

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const auth = await requireCurrentAuth();
  const params = await searchParams;
  const statusFilter = params.status ?? 'all';

  const result = await listMaterialDocuments(auth.orgId, {
    status: statusFilter === 'all' ? null : (statusFilter as MaterialStatus),
    limit: 24,
  });

  return (
    <Container width="wide" className="space-y-6 py-8">
      <PageHeader
        eyebrow="Inventory"
        title="Materials"
        description="Confirmed leftovers you can evaluate. Only verified materials can be turned into product opportunities."
        actions={
          <Link href="/materials/new">
            <Button iconLeft={<Plus className="size-4" aria-hidden />}>Scan material</Button>
          </Link>
        }
      />

      <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((filter) => {
          const active = filter.value === statusFilter;
          return (
            <Link
              key={filter.value}
              href={filter.value === 'all' ? '/materials' : `/materials?status=${filter.value}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-[0.8125rem] transition-colors',
                active
                  ? 'border-primary bg-primary-soft font-medium text-primary'
                  : 'border-line bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-5" aria-hidden />}
          title={
            statusFilter === 'all'
              ? 'No materials yet'
              : `No materials with the status “${statusFilter.replace(/_/g, ' ')}”`
          }
          description="Photograph some offcuts, let the vision model describe them, then confirm the physical properties yourself. Everything downstream depends on that confirmation."
          action={
            <Link href="/materials/new">
              <Button>Scan your first material</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Grid>
            {result.items.map((material) => {
              const dimensions =
                material.dimensions.lengthMm !== null && material.dimensions.widthMm !== null
                  ? formatDimensions(
                      material.dimensions.lengthMm,
                      material.dimensions.widthMm,
                      material.dimensions.thicknessMm ?? undefined,
                    )
                  : 'Dimensions not measured';

              return (
                <Link
                  key={material.id}
                  href={`/materials/${material.id}`}
                  className="panel group flex flex-col transition-colors hover:border-line-strong"
                >
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-line">
                    {material.primaryPhotoId ? (
                      <PhotoThumbnail
                        materialId={material.id}
                        photoId={material.primaryPhotoId}
                        alt={material.title}
                        className="transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <PhotoPlaceholder label="No photograph" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MaterialStatusBadge status={material.status} />
                        {material.isSampleData ? <SampleDataBadge /> : null}
                      </div>
                      <h2 className="line-clamp-2 text-[0.9375rem] font-medium text-ink">
                        {material.title}
                      </h2>
                    </div>

                    <dl className="mt-auto space-y-1.5 border-t border-line pt-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="micro-label">Category</dt>
                        <dd className="text-xs text-ink">
                          {MATERIAL_CATEGORY_LABELS[material.attributes.category]}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="micro-label">Sheet</dt>
                        <dd className="tnum font-mono text-[0.6875rem] text-ink-muted">
                          {dimensions}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="micro-label">Available</dt>
                        <dd className="tnum font-mono text-[0.6875rem] text-ink-muted">
                          {material.availability.availableQuantity} {QUANTITY_UNIT_LABELS[material.quantity.unit]}
                        </dd>
                      </div>
                    </dl>

                    {material.missingInformation.length > 0 ? (
                      <Badge tone="warning" className="self-start">
                        {material.missingInformation.length} outstanding
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </Grid>

          {result.nextCursor ? (
            <p className="text-xs text-ink-muted">
              Showing the {result.items.length} most recent materials. Narrow the filter to find
              older ones.
            </p>
          ) : null}
        </>
      )}
    </Container>
  );
}
