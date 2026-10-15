import { ArrowLeft, Compass, Sparkle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AnalysisPanel, type AnalysisView } from '@/components/material/analysis-panel';
import { ConfirmationForm } from '@/components/material/confirmation-form';
import { PhotoGallery } from '@/components/material/photo-gallery';
import { MaterialStatusBadge, SampleDataBadge } from '@/components/material/status-badge';
import { GridBackdrop } from '@/components/signature/annotations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, SpecList, SpecRow } from '@/components/ui/card';
import { Container, PageHeader } from '@/components/ui/layout';
import { SOURCE_LABELS } from '@/lib/labels';
import {
  MATERIAL_CATEGORY_LABELS,
  QUANTITY_UNIT_LABELS,
} from '@/domain/materials/types';
import { formatArea, formatDimensions } from '@/domain/units';
import { requireCurrentAuth } from '@/server/auth/current';
import { getWorkshopCapability } from '@/server/repos/identity';
import {
  getLatestAnalysisJob,
  listMaterialPhotoDocuments,
  toDomainMaterial,
} from '@/server/repos/materials';
import { countOpportunities } from '@/server/repos/opportunities';
import { checkConfirmable, loadMaterialDocumentOrThrow } from '@/server/services/materials';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = { title: 'Material' };

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireCurrentAuth();

  let document;
  try {
    document = await loadMaterialDocumentOrThrow(auth.orgId, id);
  } catch {
    notFound();
  }

  const [photos, latestJob, opportunityCount, capability] = await Promise.all([
    listMaterialPhotoDocuments(auth.orgId, id),
    getLatestAnalysisJob(auth.orgId, id),
    countOpportunities(auth.orgId),
    getWorkshopCapability(auth.orgId),
  ]);

  const material = toDomainMaterial(document, photos);
  const confirmation = checkConfirmable(material);

  const analysis: AnalysisView | null = latestJob
    ? {
        model: latestJob.model,
        mock: latestJob.mock,
        finishedAt: latestJob.finishedAt,
        unsupportedClaims: latestJob.unsupportedClaims,
        output: latestJob.output,
        error: latestJob.error,
      }
    : null;

  const usingMass = material.quantity.unit === 'kg' || material.quantity.unit === 'm2';

  return (
    <Container width="wide" className="space-y-6 py-8">
      <Link
        href="/materials"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All materials
      </Link>

      <PageHeader
        eyebrow="Material"
        title={material.title}
        description={
          material.origin
            ? `Origin: ${material.origin}`
            : 'No origin recorded. It is worth noting where offcuts came from — it affects what they are safe for.'
        }
        actions={
          <>
            <MaterialStatusBadge status={material.status} />
            {material.isSampleData ? <SampleDataBadge /> : null}
            {material.status === 'verified' ? (
              <Link href={`/discover?materialId=${material.id}`}>
                <Button size="sm" iconLeft={<Compass className="size-4" aria-hidden />}>
                  Find products
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      {material.missingInformation.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <span className="font-medium">
            {material.missingInformation.length} item(s) still needed before evaluation:
          </span>
          <span>{material.missingInformation.join(' ')}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <PhotoGallery materialId={material.id} photos={material.photos} title={material.title} />

          <Card>
            <CardHeader
              eyebrow="Specification"
              title="Recorded properties"
              description="Values only. Where each one came from is shown next to the field on the confirmation form."
            />
            <CardBody>
              <SpecList>
                <SpecRow label="Category">
                  {MATERIAL_CATEGORY_LABELS[material.attributes.category]}
                </SpecRow>
                <SpecRow label="Condition">{material.attributes.condition}</SpecRow>
                <SpecRow label="Subtype">{material.attributes.subtype ?? 'Not set'}</SpecRow>
                <SpecRow label="Sheet" mono>
                  {material.dimensions.lengthMm !== null && material.dimensions.widthMm !== null
                    ? formatDimensions(
                        material.dimensions.lengthMm,
                        material.dimensions.widthMm,
                        material.dimensions.thicknessMm ?? undefined,
                      )
                    : 'Not measured'}
                </SpecRow>
                <SpecRow label="Sheet area" mono>
                  {material.dimensions.lengthMm !== null && material.dimensions.widthMm !== null
                    ? formatArea(
                        ((material.dimensions.lengthMm ?? 0) / 1000) *
                          ((material.dimensions.widthMm ?? 0) / 1000),
                      )
                    : '—'}
                </SpecRow>
                <SpecRow label="Quantity" mono>
                  {material.quantity.value} {QUANTITY_UNIT_LABELS[material.quantity.unit]}
                </SpecRow>
                <SpecRow label="Reserved" mono>
                  {material.availability.reservedQuantity}
                </SpecRow>
                <SpecRow label="Used" mono>
                  {material.availability.usedQuantity}
                </SpecRow>
                <SpecRow label="Contamination">
                  {material.attributes.contamination.length > 0
                    ? material.attributes.contamination.join(', ')
                    : 'None recorded'}
                </SpecRow>
                <SpecRow label="Defects">
                  {material.attributes.defects.length > 0
                    ? material.attributes.defects.join(', ')
                    : 'None recorded'}
                </SpecRow>
              </SpecList>

              {usingMass ? (
                <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
                  Quantity is recorded by {material.quantity.unit === 'kg' ? 'mass' : 'area'}. Sheet
                  count will be derived for nesting, and that derivation is stated as an explicit
                  assumption on any feasibility result rather than being hidden.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="Next" title="Related work" />
            <CardBody className="space-y-3">
              <div className="relative isolate overflow-hidden rounded-md border border-line bg-surface-sunken px-4 py-3">
                <GridBackdrop className="opacity-50" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="micro-label">Opportunities from this material</p>
                    <p className="tnum font-mono text-lg text-ink">{opportunityCount}</p>
                  </div>
                  <Link href="/opportunities">
                    <Button variant="outline" size="sm" iconLeft={<Sparkle className="size-4" aria-hidden />}>
                      View all
                    </Button>
                  </Link>
                </div>
              </div>

              {!capability ? (
                <p className="text-xs leading-relaxed text-ink-muted">
                  No workshop capability profile is set up, so tooling cannot be verified and results
                  stop at “geometrically feasible”.{' '}
                  <Link href="/workspace" className="underline underline-offset-2">
                    Add your tools
                  </Link>{' '}
                  to get a full process verdict.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-ink-muted">
                  Feasibility will be checked against your workshop profile using{' '}
                  {capability.tools.length} tool(s) and {capability.processes.length} process step(s).
                </p>
              )}

              <p className="text-xs leading-relaxed text-ink-faint">
                Cross-checked against {SOURCE_LABELS.marketEvidenceSourceCount} curated market
                reference categories. resaikel never scrapes marketplaces and never invents a price.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <AnalysisPanel
            materialId={material.id}
            photoCount={material.photos.length}
            analysis={analysis}
            running={material.status === 'analyzing'}
          />

          <ConfirmationForm material={material} confirmation={confirmation} />

          {material.warnings.length > 0 ? (
            <Card>
              <CardHeader eyebrow="Guardrails" title="What resaikel will not claim" />
              <CardBody>
                <ul className="space-y-2 text-sm text-ink-muted">
                  <li>
                    It will not state a dimension, weight or strength it did not receive from you or
                    measure itself.
                  </li>
                  <li>
                    It will not certify a product, a board grade, a fire rating or food contact
                    safety.
                  </li>
                  <li>
                    It will not invent a selling price when no market evidence exists — it reports
                    “Insufficient Market Data”.
                  </li>
                  <li>
                    It will not name a company as a buyer. Buyer output is always a category of
                    buyer unless a registered request exists.
                  </li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">Conservative by design</Badge>
                  <Badge tone="neutral">
                    Max upload {Math.round(serverConfig.upload.maxBytes / 1024 / 1024)} MB
                  </Badge>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
