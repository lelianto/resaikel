import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BuyerSegments } from '@/components/opportunity/buyer-segments';
import { CostBreakdown } from '@/components/opportunity/cost-breakdown';
import { CuttingDiagram } from '@/components/opportunity/cutting-diagram';
import { EvidenceQualityBadge, FeasibilityBadge } from '@/components/material/status-badge';
import { ProductSilhouette } from '@/components/signature/product-silhouette';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Card, CardBody, CardHeader, SpecList, SpecRow } from '@/components/ui/card';
import { Container, PageHeader } from '@/components/ui/layout';
import { PRODUCT_CATEGORY_LABELS } from '@/domain/catalog/types';
import { assessMarket } from '@/domain/market/aggregate';
import { EVIDENCE_SOURCE_LABELS } from '@/domain/market/types';
import { formatMm } from '@/domain/units';
import { requireCurrentAuth } from '@/server/auth/current';
import { listMarketEvidence } from '@/server/repos/evidence';
import {
  getCostEstimate,
  getFeasibilityResult,
  getOpportunityDocument,
} from '@/server/repos/opportunities';
import { SaveOpportunityButton } from '@/components/opportunity/save-opportunity-button';

export const metadata: Metadata = { title: 'Opportunity' };

const CHECK_TONE = {
  pass: 'success',
  warn: 'warning',
  fail: 'danger',
  skipped: 'neutral',
} as const;

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireCurrentAuth();

  const opportunity = await getOpportunityDocument(auth.orgId, id);
  if (!opportunity) notFound();

  const [feasibility, cost, evidenceRows] = await Promise.all([
    getFeasibilityResult(auth.orgId, id),
    getCostEstimate(auth.orgId, id),
    listMarketEvidence(opportunity.category),
  ]);

  const market = assessMarket(evidenceRows, {
    category: opportunity.category,
    currency: auth.currency,
    region: auth.country,
  });

  const unitSheet = feasibility?.unitLayout[0] ?? null;
  const concept = opportunity.concept;

  return (
    <Container width="wide" className="space-y-6 py-8">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All opportunities
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PageHeader
          eyebrow={PRODUCT_CATEGORY_LABELS[opportunity.category]}
          title={opportunity.productName}
          description={
            concept
              ? concept.description
              : `Cut from ${opportunity.materialSnapshot.title} — ${opportunity.materialSnapshot.lengthMm} × ${opportunity.materialSnapshot.widthMm} mm, ${opportunity.materialSnapshot.sheetCount} sheet(s).`
          }
          actions={
            <>
              <FeasibilityBadge status={opportunity.feasibilityStatus} />
              <EvidenceQualityBadge quality={opportunity.summary.evidenceQuality} />
            </>
          }
        />

        <div className="panel flex flex-col gap-3 p-4">
          <ProductSilhouette
            category={opportunity.category}
            compact
            className="rounded-md border border-line"
          />
          <SaveOpportunityButton
            opportunityId={opportunity.id}
            initialSaved={opportunity.saved}
          />
          <p className="text-xs leading-relaxed text-ink-faint">
            {opportunity.ranking?.gatesPassed
              ? 'Passed every hard feasibility gate.'
              : 'Did not pass a hard gate, so it is not scored against viable products.'}
          </p>
        </div>
      </div>

      {!opportunity.ranking?.gatesPassed && opportunity.ranking?.gateReasons.length ? (
        <Alert tone="danger" title="Why this is not viable as specified">
          <ul className="list-disc space-y-1 pl-4">
            {opportunity.ranking.gateReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {opportunity.validationLevel === 'concept' ? (
        <Alert tone="warning" title="Concept Only — Manufacturing Validation Required">
          No validated manufacturing specification exists for this idea in the catalogue. It has not
          been nested, costed or checked against real tooling. Treat it as a prompt for a
          conversation with a maker, not as a production plan.
        </Alert>
      ) : null}

      {/* ------------------------------------------------------------ overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="At a glance"
            title="Numbers you can act on"
            description="A dash means the value is genuinely unknown. resaikel does not substitute an estimate for a fact it does not have."
          />
          <CardBody>
            <SpecList>
              <SpecRow label="Producible" mono>
                {opportunity.summary.maxUnits > 0 ? `${opportunity.summary.maxUnits} units` : 'None'}
              </SpecRow>
              <SpecRow label="Production cost / unit" mono>
                {opportunity.summary.unitCostMinor === null
                  ? 'Not calculated'
                  : `${opportunity.summary.unitCostMinor} ${opportunity.summary.currency}`}
              </SpecRow>
              <SpecRow label="Minimum viable price" mono>
                {opportunity.summary.minViablePriceMinor === null
                  ? 'Not calculable'
                  : `${opportunity.summary.minViablePriceMinor} ${opportunity.summary.currency}`}
              </SpecRow>
              <SpecRow label="Reference price" mono>
                {opportunity.summary.referencePriceMinor === null
                  ? 'Insufficient Market Data'
                  : `${opportunity.summary.referencePriceMinor} ${opportunity.summary.currency}`}
              </SpecRow>
              <SpecRow label="Contribution / unit" mono>
                {opportunity.summary.contributionPerUnitMinor === null
                  ? '—'
                  : `${opportunity.summary.contributionPerUnitMinor} ${opportunity.summary.currency}`}
              </SpecRow>
              <SpecRow label="Contribution margin">
                {opportunity.summary.contributionMarginBps === null
                  ? '—'
                  : `${(opportunity.summary.contributionMarginBps / 100).toFixed(1)}%`}
              </SpecRow>
              <SpecRow label="Cutting waste" mono>
                {opportunity.summary.wastePercent === null
                  ? '—'
                  : `${opportunity.summary.wastePercent}%`}
              </SpecRow>
              <SpecRow label="Best buyer match">
                {opportunity.summary.bestBuyerScore === null
                  ? 'Not scored'
                  : `${opportunity.summary.bestBuyerScore}/100`}
              </SpecRow>
            </SpecList>

            {opportunity.summary.shortfallDetected ? (
              <p className="mt-4 rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
                A registered buyer wants more units than this material can produce. The order cannot
                be met from this material alone.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Why this was suggested"
            title="Reasons and evidence"
            description="Every reason below is traceable to an engine result or a labelled piece of evidence."
          />
          <CardBody>
            <ul className="space-y-2 text-sm leading-relaxed text-ink-muted">
              {opportunity.reasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-line-strong" />
                  {reason}
                </li>
              ))}
            </ul>

            {opportunity.explanation ? (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <p className="text-sm text-ink">{opportunity.explanation.summary}</p>
                {opportunity.explanation.nextActions.length > 0 ? (
                  <div>
                    <h3 className="micro-label">Suggested next actions</h3>
                    <ul className="mt-1.5 space-y-1 text-sm text-ink-muted">
                      {opportunity.explanation.nextActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* --------------------------------------------------------- feasibility */}
      {feasibility ? (
        <Card>
          <CardHeader
            eyebrow="Manufacturing feasibility"
            title="Every check, and what came of it"
            description={feasibility.disclaimer}
            actions={<Badge tone="neutral" technical>kerf {formatMm(feasibility.kerfMm)}</Badge>}
          />

          <CardBody className="space-y-6">
            <ul className="space-y-2">
              {feasibility.checks.map((check) => (
                <li
                  key={check.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2.5 last:border-0"
                >
                  <Badge tone={CHECK_TONE[check.outcome]} technical>
                    {check.outcome}
                  </Badge>
                  <span className="text-sm font-medium text-ink">{check.label}</span>
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
                    {check.detail}
                  </span>
                </li>
              ))}
            </ul>

            {feasibility.rejectReasons.length > 0 ? (
              <Alert tone="danger" title="Blocking reasons">
                <ul className="list-disc space-y-1 pl-4">
                  {feasibility.rejectReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <CuttingDiagram sheet={unitSheet} kerfMm={feasibility.kerfMm} />

              <div className="space-y-4">
                <div>
                  <h3 className="micro-label">Parts for one unit</h3>
                  <table className="mt-2 w-full border-collapse text-sm">
                    <thead className="border-b border-line">
                      <tr>
                        <th scope="col" className="micro-label py-2 text-left">
                          Part
                        </th>
                        <th scope="col" className="micro-label py-2 text-right">
                          Size
                        </th>
                        <th scope="col" className="micro-label py-2 text-right">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {feasibility.resolvedParts.map((part) => (
                        <tr key={part.partId}>
                          <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                            {part.name}
                          </th>
                          <td className="tnum py-2 text-right font-mono text-[0.8125rem]">
                            {part.lengthMm} × {part.widthMm} mm
                          </td>
                          <td className="tnum py-2 text-right font-mono text-[0.8125rem]">
                            {part.quantityPerUnit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {feasibility.additionalMaterials.length > 0 ? (
                  <div>
                    <h3 className="micro-label">Additional materials for the batch</h3>
                    <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                      {feasibility.additionalMaterials.map((item) => (
                        <li key={item.name} className="flex justify-between gap-3">
                          <span>{item.name}</span>
                          <span className="tnum font-mono text-[0.8125rem]">
                            {item.totalQuantity} {item.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {feasibility.packagingChecklist.length > 0 ? (
                  <div>
                    <h3 className="micro-label">Packaging suitability checklist</h3>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-muted">
                      {feasibility.packagingChecklist.map((item) => (
                        <li key={item.id} className="flex gap-2">
                          <Badge tone="neutral" technical>
                            {item.satisfied === null ? 'unverified' : item.satisfied ? 'met' : 'not met'}
                          </Badge>
                          <span>
                            {item.label}
                            {item.required ? '' : ' (optional)'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-ink-faint">
                      resaikel does not certify packaging compliance. Every item stays unverified until
                      a person signs it off.
                    </p>
                  </div>
                ) : null}

                {feasibility.assumptions.length > 0 ? (
                  <div>
                    <h3 className="micro-label">Assumptions behind this layout</h3>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-muted">
                      {feasibility.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Alert tone="info" title="Not evaluated">
          This candidate has no validated manufacturing specification, so no feasibility check applies.
        </Alert>
      )}

      {/* ---------------------------------------------------------------- cost */}
      {cost ? (
        <CostBreakdown
          opportunityId={opportunity.id}
          initialCost={cost}
          locale={auth.locale}
        />
      ) : (
        <Alert tone="info" title="No cost estimate">
          A cost estimate is only produced for candidates that can actually be built from the
          available material.
        </Alert>
      )}

      {/* -------------------------------------------------------------- market */}
      <Card>
        <CardHeader
          eyebrow="Market intelligence"
          title="Observed prices, and how good they are"
          description={market.basis}
          actions={<EvidenceQualityBadge quality={market.quality} />}
        />
        <CardBody className="space-y-4">
          {market.bands === null ? (
            <>
              <p className="text-sm text-ink">
                No price is estimated for this product category.
              </p>
              {market.caveats.map((caveat) => (
                <p key={caveat} className="text-xs leading-relaxed text-ink-muted">
                  {caveat}
                </p>
              ))}
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Low (25th percentile)', value: market.bands.lowMinor },
                  { label: 'Reference (median)', value: market.bands.referenceMinor },
                  { label: 'High (75th percentile)', value: market.bands.highMinor },
                ].map((entry) => (
                  <div
                    key={entry.label}
                    className="rounded-md border border-line bg-surface-sunken px-4 py-3"
                  >
                    <p className="micro-label">{entry.label}</p>
                    <p className="tnum mt-1 font-mono text-lg text-ink">
                      {entry.value.toLocaleString(auth.locale)}
                    </p>
                    <p className="micro-label mt-0.5">{market.currency}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="micro-label mb-2 text-left">
                    {market.bands.sampleSize} observation(s). Every price is labelled with the kind of
                    evidence it is.
                  </caption>
                  <thead className="border-b border-line">
                    <tr>
                      <th scope="col" className="micro-label py-2 text-left">
                        Evidence type
                      </th>
                      <th scope="col" className="micro-label py-2 text-left">
                        Description
                      </th>
                      <th scope="col" className="micro-label py-2 text-left">
                        Market
                      </th>
                      <th scope="col" className="micro-label py-2 text-right">
                        Price
                      </th>
                      <th scope="col" className="micro-label py-2 text-right">
                        Observed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {market.evidence.map((row) => (
                      <tr key={row.id}>
                        <th scope="row" className="py-2.5 pr-3 text-left align-top font-normal">
                          <Badge tone="neutral" technical>
                            {EVIDENCE_SOURCE_LABELS[row.sourceType]}
                          </Badge>
                        </th>
                        <td className="py-2.5 pr-3 align-top text-xs text-ink-muted">
                          {row.description}
                          {row.note ? <span className="block">{row.note}</span> : null}
                        </td>
                        <td className="py-2.5 pr-3 align-top text-xs text-ink-muted">
                          {row.market}
                        </td>
                        <td className="tnum py-2.5 text-right align-top font-mono text-[0.8125rem]">
                          {row.priceMinor.toLocaleString(auth.locale)}
                        </td>
                        <td className="tnum py-2.5 text-right align-top font-mono text-[0.6875rem] text-ink-muted">
                          {row.observedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {market.freshnessDays !== null ? (
                <p className="text-xs text-ink-muted">
                  Freshest observation is {market.freshnessDays} day(s) old.
                </p>
              ) : null}

              <ul className="space-y-1.5 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
                {market.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      {/* -------------------------------------------------------------- buyers */}
      <BuyerSegments
        matches={opportunity.buyerMatches}
        note={
          market.bands === null
            ? 'No market evidence exists for this category, so buyer segments were assessed on product and material fit only — price was deliberately not considered.'
            : null
        }
      />

      {/* --------------------------------------------------------------- risks */}
      <Card>
        <CardHeader
          eyebrow="Risks and limitations"
          title="What could go wrong"
          description="Listed because a plan without its risks is not a plan."
        />
        <CardBody>
          <ul className="space-y-2 text-sm leading-relaxed text-ink-muted">
            {opportunity.risks.map((risk) => (
              <li key={risk} className="flex gap-2">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" />
                {risk}
              </li>
            ))}
          </ul>

          <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
            {opportunity.nextActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SaveOpportunityButton opportunityId={opportunity.id} initialSaved={opportunity.saved} />
        <Link href="/discover">
          <Button variant="ghost" size="sm">
            Run discovery again
          </Button>
        </Link>
      </div>
    </Container>
  );
}
