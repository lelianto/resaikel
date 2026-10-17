import { ArrowRight, Factory, Leaf, Recycle, Scissors } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, SpecList, SpecRow } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import { QUANTITY_UNIT_LABELS } from '@/domain/materials/types';
import type { QuantityUnit } from '@/domain/materials/types';
import { formatMoney } from '@/domain/money';
import { aggregateCircularity } from '@/domain/outcomes/circularity';
import { requireCurrentAuth } from '@/server/auth/current';
import { listOrgProductionOutcomes } from '@/server/repos/outcomes';

export const metadata: Metadata = {
  title: 'Impact',
  description: 'Circularity measured from completed production records only.',
};

function formatBps(bps: number | null): string {
  if (bps === null) return '—';
  return `${(bps / 100).toFixed(1)}%`;
}

function unitLabel(unit: string): string {
  return QUANTITY_UNIT_LABELS[unit as QuantityUnit] ?? unit;
}

function formatQuantity(value: number, unit: string): string {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${rounded} ${unitLabel(unit)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Impact / circularity report.
 *
 * Every figure here is aggregated from `production_outcomes` — records a person
 * entered after real work was done. There are no projected savings, no carbon
 * estimates and no landfill claims: only material that was actually reused,
 * products that were actually made and sold, and waste that was actually
 * recorded. When nothing has been produced yet, the page says so plainly.
 */
export default async function CircularityPage() {
  const auth = await requireCurrentAuth();
  const outcomes = await listOrgProductionOutcomes(auth.orgId);
  const summary = aggregateCircularity(outcomes);

  const recent = [...outcomes]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0))
    .slice(0, 6);

  const hasData = summary.recordedRuns > 0;

  const headline = [
    {
      label: 'Material reused',
      value:
        summary.materialFlow.length === 0
          ? '0'
          : summary.materialFlow
              .map((flow) => formatQuantity(flow.reusedQuantity, flow.unit))
              .join(' · '),
      note: 'Turned into product, by unit',
      icon: Recycle,
    },
    {
      label: 'Waste recorded',
      value:
        summary.materialFlow.length === 0
          ? '0'
          : summary.materialFlow
              .map((flow) => formatQuantity(flow.wasteQuantity, flow.unit))
              .join(' · '),
      note: 'Offcuts recorded as unusable',
      icon: Scissors,
    },
    {
      label: 'Products sold / made',
      value: `${summary.productsSold} / ${summary.productsManufactured}`,
      note: `${formatBps(summary.sellThroughBps)} sell-through`,
      icon: Factory,
    },
    {
      label: 'Completed runs',
      value: String(summary.recordedRuns),
      note: `${summary.materialsReused} material(s), ${summary.opportunitiesRealised} product(s)`,
      icon: Leaf,
    },
  ];

  return (
    <Container width="wide" className="space-y-6 py-8">
      <PageHeader
        eyebrow={`${auth.orgName} · circularity`}
        title="Impact, from completed work only"
        description="Counts and sums of real production records. No projected savings, no carbon estimates, no landfill claims — only material that was actually reused and sold."
        actions={
          <Link href="/opportunities">
            <Button size="sm" variant="outline" iconRight={<ArrowRight className="size-4" aria-hidden />}>
              Opportunities
            </Button>
          </Link>
        }
      />

      {!hasData ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Leaf className="size-5" aria-hidden />}
              title="No production recorded yet"
              description="Save an opportunity, make the product, then record the actual outcome. Every number on this page is backed by a completed production record — so it stays empty until one exists."
              action={
                <Link href="/opportunities">
                  <Button>Go to opportunities</Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {headline.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="panel px-5 py-4">
                  <dt className="micro-label flex items-center gap-2">
                    <Icon className="size-4 text-primary" aria-hidden />
                    {stat.label}
                  </dt>
                  <dd className="tnum mt-2 font-mono text-xl text-ink">{stat.value}</dd>
                  <dd className="mt-1 text-xs text-ink-muted">{stat.note}</dd>
                </div>
              );
            })}
          </dl>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* material flow */}
            <Card>
              <CardHeader
                eyebrow="Material"
                title="Where the material went"
                description="Grouped by unit, because sheets and kilograms cannot be added together."
              />
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left micro-label">
                        <th className="pb-2 font-normal">Unit</th>
                        <th className="pb-2 text-right font-normal">Reused</th>
                        <th className="pb-2 text-right font-normal">Waste</th>
                        <th className="pb-2 text-right font-normal">Waste %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {summary.materialFlow.map((flow) => (
                        <tr key={flow.unit}>
                          <td className="py-2 text-ink">{unitLabel(flow.unit)}</td>
                          <td className="tnum py-2 text-right font-mono text-ink">
                            {flow.reusedQuantity}
                          </td>
                          <td className="tnum py-2 text-right font-mono text-ink-muted">
                            {flow.wasteQuantity}
                          </td>
                          <td className="tnum py-2 text-right font-mono text-ink-muted">
                            {formatBps(flow.wasteRatioBps)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            {/* economic results */}
            <Card>
              <CardHeader
                eyebrow="Commercial"
                title="Economic result"
                description="Actual revenue and cost recorded against completed runs, grouped by currency."
              />
              <CardBody>
                <div className="space-y-4">
                  {summary.economicResults.map((result) => (
                    <div key={result.currency} className="border-b border-line pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="micro-label">{result.currency}</span>
                        <span className="text-xs text-ink-muted">
                          {formatBps(result.grossMarginBps)} gross margin
                        </span>
                      </div>
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-ink-faint">Revenue</dt>
                          <dd className="tnum font-mono text-ink">
                            {formatMoney({ amount: result.revenueMinor, currency: result.currency }, auth.locale, { compact: true })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-ink-faint">Cost</dt>
                          <dd className="tnum font-mono text-ink">
                            {formatMoney({ amount: result.costMinor, currency: result.currency }, auth.locale, { compact: true })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-ink-faint">Gross</dt>
                          <dd className="tnum font-mono text-ink">
                            {formatMoney({ amount: result.grossProfitMinor, currency: result.currency }, auth.locale, { compact: true })}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* recent outcomes */}
          <Card>
            <CardHeader
              eyebrow="Ledger"
              title="Recent completed production"
              actions={
                <span className="text-xs text-ink-muted">
                  {formatDate(summary.firstRecordedAt)} – {formatDate(summary.lastRecordedAt)}
                </span>
              }
            />
            <CardBody>
              <ul className="divide-y divide-line">
                {recent.map((outcome) => (
                  <li key={outcome.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        href={`/opportunities/${outcome.opportunityId}`}
                        className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {outcome.productName}
                      </Link>
                      <p className="micro-label mt-0.5">
                        {formatDate(outcome.occurredAt)} · {outcome.quantitySold}/{outcome.quantityManufactured} sold ·{' '}
                        {formatQuantity(outcome.materialConsumedQuantity, outcome.materialQuantityUnit)} reused
                      </p>
                    </div>
                    <span className="tnum shrink-0 font-mono text-sm text-ink">
                      {formatMoney({ amount: outcome.actualGrossProfitMinor, currency: outcome.currency }, auth.locale, { compact: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}

      {/* honesty panel */}
      <Card>
        <CardHeader
          eyebrow="What this page is"
          title="Measured, never guessed"
          description="The impact story resaikel is willing to stand behind."
        />
        <CardBody>
          <SpecList>
            <SpecRow label="Material reused">
              The quantity consumed by completed production, grouped by unit. A real reuse event,
              not a projection.
            </SpecRow>
            <SpecRow label="Waste">
              Only offcuts a person recorded as unusable. Cutting estimates from the nesting engine
              are not counted here as realised waste.
            </SpecRow>
            <SpecRow label="Carbon and landfill">
              Not shown. There is no validated methodology behind an emissions or diversion figure
              for these materials yet, so none is invented.
            </SpecRow>
            <SpecRow label="Money">
              Grouped by currency and never converted at an assumed rate.
            </SpecRow>
          </SpecList>
        </CardBody>
      </Card>
    </Container>
  );
}
