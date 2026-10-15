import { ArrowRight, Boxes, Compass, Sparkle, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { MaterialStatusBadge } from '@/components/material/status-badge';
import { FeasibilityBadge } from '@/components/material/status-badge';
import { GridBackdrop } from '@/components/signature/annotations';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, SpecList, SpecRow } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import { MATERIAL_CATEGORY_LABELS, QUANTITY_UNIT_LABELS } from '@/domain/materials/types';
import { USER_ROLE_LABELS } from '@/domain/identity/types';
import { areaSquareMeters, formatArea } from '@/domain/units';
import { requireCurrentAuth } from '@/server/auth/current';
import { getWorkshopCapability } from '@/server/repos/identity';
import { countMaterials, listMaterialDocuments } from '@/server/repos/materials';
import { countOpportunities, listOpportunityDocuments } from '@/server/repos/opportunities';

export const metadata: Metadata = { title: 'Overview' };

/**
 * Overview.
 *
 * Every number on this page is a count or a sum of records that actually exist.
 * There are no illustrative charts, no invented trend lines and no projected
 * savings: the product measures what it has been given.
 */
export default async function OverviewPage() {
  const auth = await requireCurrentAuth();

  const [
    materialCount,
    verifiedCount,
    pendingCount,
    opportunityCount,
    savedCount,
    recentMaterials,
    topOpportunities,
    capability,
  ] = await Promise.all([
    countMaterials(auth.orgId),
    countMaterials(auth.orgId, 'verified'),
    countMaterials(auth.orgId, 'needs_confirmation'),
    countOpportunities(auth.orgId),
    countOpportunities(auth.orgId, true),
    listMaterialDocuments(auth.orgId, { limit: 5 }),
    listOpportunityDocuments(auth.orgId, { limit: 3 }),
    getWorkshopCapability(auth.orgId),
  ]);

  const registeredArea = recentMaterials.items.reduce((total, material) => {
    if (material.dimensions.lengthMm === null || material.dimensions.widthMm === null) return total;
    return (
      total +
      areaSquareMeters(material.dimensions.lengthMm, material.dimensions.widthMm) *
        material.quantity.value
    );
  }, 0);

  const nextStep =
    materialCount === 0
      ? {
          title: 'Scan your first material',
          description:
            'Photograph some offcuts. The vision model will describe what it can see, and you confirm the rest.',
          href: '/materials/new',
          label: 'Scan a material',
          icon: Boxes,
        }
      : verifiedCount === 0
        ? {
            title: 'Confirm a material',
            description:
              'Nothing can be evaluated until a person has confirmed the dimensions. An AI inference is never treated as a measurement.',
            href: '/materials',
            label: 'Go to inventory',
            icon: Boxes,
          }
        : opportunityCount === 0
          ? {
              title: 'Discover product opportunities',
              description:
                'Run the pipeline on a confirmed material: feasibility gates, transparent costing, market evidence and buyer matching.',
              href: '/discover',
              label: 'Run discovery',
              icon: Compass,
            }
          : {
              title: 'Review your opportunities',
              description:
                'Compare candidates by economic potential, material utilisation, production simplicity or buyer compatibility.',
              href: '/opportunities',
              label: 'Compare opportunities',
              icon: Sparkle,
            };

  const NextIcon = nextStep.icon;

  return (
    <Container width="wide" className="space-y-6 py-8">
      <PageHeader
        eyebrow={`${auth.orgName} · ${auth.currency} · ${auth.country}`}
        title={`Welcome back${auth.displayName ? `, ${auth.displayName.split(' ')[0]}` : ''}`}
        description={
          auth.roles.length > 0
            ? `You signed up as: ${auth.roles.map((role) => USER_ROLE_LABELS[role]).join(', ')}.`
            : 'No role set yet. You can add one from your account.'
        }
        actions={
          <>
            <Link href="/materials/new">
              <Button size="sm" iconLeft={<Boxes className="size-4" aria-hidden />}>
                Scan material
              </Button>
            </Link>
            <Link href="/discover">
              <Button size="sm" variant="outline" iconLeft={<Compass className="size-4" aria-hidden />}>
                Discover
              </Button>
            </Link>
          </>
        }
      />

      {/* next step */}
      <div className="relative isolate overflow-hidden rounded-lg border border-line bg-surface p-6">
        <GridBackdrop className="opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
              <NextIcon className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="micro-label">Suggested next step</p>
              <h2 className="text-[1.0625rem] font-medium text-ink">{nextStep.title}</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
                {nextStep.description}
              </p>
            </div>
          </div>
          <Link href={nextStep.href}>
            <Button iconRight={<ArrowRight className="size-4" aria-hidden />}>
              {nextStep.label}
            </Button>
          </Link>
        </div>
      </div>

      {/* counts */}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Materials registered', value: materialCount, note: 'Records you have created' },
          {
            label: 'Confirmed',
            value: verifiedCount,
            note: `${pendingCount} awaiting confirmation`,
          },
          {
            label: 'Opportunities generated',
            value: opportunityCount,
            note: `${savedCount} saved to the workspace`,
          },
          {
            label: 'Sheet area registered',
            value: formatArea(registeredArea),
            note: 'Across your five most recent records',
          },
        ].map((stat) => (
          <div key={stat.label} className="panel px-5 py-4">
            <dt className="micro-label">{stat.label}</dt>
            <dd className="tnum mt-1 font-mono text-2xl text-ink">{stat.value}</dd>
            <dd className="mt-1 text-xs text-ink-muted">{stat.note}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* recent materials */}
        <Card>
          <CardHeader
            eyebrow="Inventory"
            title="Recent materials"
            actions={
              <Link
                href="/materials"
                className="text-xs text-ink-muted transition-colors hover:text-ink"
              >
                View all
              </Link>
            }
          />
          <CardBody>
            {recentMaterials.items.length === 0 ? (
              <EmptyState
                icon={<Boxes className="size-5" aria-hidden />}
                title="No materials yet"
                description="Everything in resaikel starts with a material record."
                action={
                  <Link href="/materials/new">
                    <Button>Scan a material</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentMaterials.items.map((material) => (
                  <li key={material.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        href={`/materials/${material.id}`}
                        className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {material.title}
                      </Link>
                      <p className="micro-label mt-0.5">
                        {MATERIAL_CATEGORY_LABELS[material.attributes.category]} ·{' '}
                        {material.quantity.value} {QUANTITY_UNIT_LABELS[material.quantity.unit]}
                        {material.photoCount > 0 ? ` · ${material.photoCount} photo(s)` : ''}
                      </p>
                    </div>
                    <MaterialStatusBadge status={material.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* top opportunities */}
        <Card>
          <CardHeader
            eyebrow="Commercial"
            title="Top opportunities"
            actions={
              <Link
                href="/opportunities"
                className="text-xs text-ink-muted transition-colors hover:text-ink"
              >
                View all
              </Link>
            }
          />
          <CardBody>
            {topOpportunities.items.length === 0 ? (
              <EmptyState
                icon={<Sparkle className="size-5" aria-hidden />}
                title="Nothing evaluated yet"
                description={
                  verifiedCount === 0
                    ? 'Confirm a material first: every feasibility gate depends on measured dimensions.'
                    : 'Run discovery on a confirmed material to see ranked, costed candidates.'
                }
                action={
                  <Link href={verifiedCount === 0 ? '/materials' : '/discover'}>
                    <Button>{verifiedCount === 0 ? 'Go to inventory' : 'Run discovery'}</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {topOpportunities.items.map((opportunity) => (
                  <li key={opportunity.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/opportunities/${opportunity.id}`}
                        className="text-sm font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {opportunity.productName}
                      </Link>
                      <FeasibilityBadge status={opportunity.feasibilityStatus} />
                    </div>
                    <p className="text-xs text-ink-muted">
                      {opportunity.summary.maxUnits > 0
                        ? `${opportunity.summary.maxUnits} unit(s)`
                        : 'No units producible'}{' '}
                      · {opportunity.summary.evidenceQuality} evidence
                      {opportunity.ranking?.score !== null && opportunity.ranking?.score !== undefined
                        ? ` · score ${opportunity.ranking.score}/100`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* honesty panel */}
      <Card>
        <CardHeader
          eyebrow="What this page is"
          title="Counts and sums, not projections"
          description="resaikel reports what it has been given and nothing more."
        />
        <CardBody>
          <SpecList>
            <SpecRow label="Material metrics">
              Counts of records you created, plus a geometric sum of the sheet area on them.
            </SpecRow>
            <SpecRow label="Sustainability figures">
              Deferred. No carbon saving is shown, because there is no documented methodology behind
              one yet.
            </SpecRow>
            <SpecRow label="Market data">
              A curated sample reference set. Nothing is scraped from a marketplace.
            </SpecRow>
            <SpecRow label="Capability profile">
              {capability
                ? `${capability.tools.length} tool(s) and ${capability.processes.length} process step(s) recorded.`
                : 'Not set up, so feasibility stops at geometrically feasible.'}
            </SpecRow>
          </SpecList>

          {!capability ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Wrench className="size-4 text-ink-faint" aria-hidden />
              <p className="text-xs text-ink-muted">
                Add your tools and process steps so the engine can verify tooling instead of stopping
                short.
              </p>
              <Link href="/workspace">
                <Button size="sm" variant="outline">
                  Set up capabilities
                </Button>
              </Link>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </Container>
  );
}
