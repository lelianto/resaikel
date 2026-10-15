import type { Metadata } from 'next';

import { Alert } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import {
  DiscoveryRunner,
  type DiscoverableMaterial,
} from '@/components/opportunity/discovery-runner';
import { MATERIAL_CATEGORY_LABELS } from '@/domain/materials/types';
import { requireCurrentAuth } from '@/server/auth/current';
import { getWorkshopCapability } from '@/server/repos/identity';
import { listMaterialDocuments } from '@/server/repos/materials';

export const metadata: Metadata = { title: 'Discover' };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ materialId?: string }>;
}) {
  const auth = await requireCurrentAuth();
  const params = await searchParams;

  const [verified, capability] = await Promise.all([
    listMaterialDocuments(auth.orgId, { status: 'verified', limit: 40 }),
    getWorkshopCapability(auth.orgId),
  ]);

  const materials: DiscoverableMaterial[] = verified.items.map((item) => ({
    id: item.id,
    title: item.title,
    category: MATERIAL_CATEGORY_LABELS[item.attributes.category].toLowerCase(),
    dimensions: item.dimensions,
    quantity: item.quantity,
  }));

  return (
    <Container width="default" className="space-y-6 py-8">
      <PageHeader
        eyebrow="Product intelligence"
        title="Discover what this material could become"
        description="Candidates come from a curated catalogue of validated specifications. Each one is then put through deterministic feasibility gates, a transparent cost model, whatever market evidence exists, and buyer matching."
      />

      <DiscoveryRunner
        materials={materials}
        initialMaterialId={params.materialId ?? null}
        hasCapability={capability !== null}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="micro-label">Step 1</p>
          <p className="mt-1 text-sm text-ink">Candidates selected from the catalogue</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            The model may only choose among validated templates and set parameters within their
            declared bounds.
          </p>
        </div>
        <div className="panel p-4">
          <p className="micro-label">Step 2</p>
          <p className="mt-1 text-sm text-ink">Hard constraints applied</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Material family, sheet size, thickness, condition, contamination and tooling. A failure
            here removes the candidate from ranking.
          </p>
        </div>
        <div className="panel p-4">
          <p className="micro-label">Step 3</p>
          <p className="mt-1 text-sm text-ink">Costed, evidenced and ranked</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Integer money arithmetic, market evidence labelled by source, and unknowns left unknown
            rather than scored as zero.
          </p>
        </div>
      </div>

      {materials.length > 0 ? (
        <Alert tone="info" title="What you will see">
          Some candidates will be rejected, and that is the point: a rejection with a stated reason is
          more useful than a plausible number. Where no market evidence exists you will see
          “Insufficient Market Data” instead of an estimated price.
        </Alert>
      ) : null}
    </Container>
  );
}
