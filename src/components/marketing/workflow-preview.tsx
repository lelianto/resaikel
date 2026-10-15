'use client';

import { ArrowRight, Check, X } from 'lucide-react';
import { useState } from 'react';

import { GridBackdrop } from '@/components/signature/annotations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented';
import { CuttingDiagram } from '@/components/opportunity/cutting-diagram';
import { DEMAND_KIND_LABELS } from '@/domain/buyers/matching';
import { FEASIBILITY_LABELS } from '@/domain/feasibility/types';
import type { SampleScenario } from '@/domain/demo/sample-scenarios';
import { scenarioMaterialSummary } from '@/domain/demo/sample-scenarios';
import { EVIDENCE_QUALITY_LABELS, EVIDENCE_SOURCE_LABELS } from '@/domain/market/types';
import { formatMoney } from '@/domain/money';

/**
 * Interactive workflow preview.
 *
 * The numbers here are produced by the same engines the application runs — this is
 * a real evaluation of a fixed input, not a mocked-up screenshot. The label says so,
 * because a product whose claim is "we do not invent numbers" cannot afford a
 * landing page that does.
 */

type Step = 'material' | 'feasibility' | 'economics' | 'buyers';

const STEPS: readonly { id: Step; index: string; label: string }[] = [
  { id: 'material', index: '01', label: 'Material' },
  { id: 'feasibility', index: '02', label: 'Feasibility' },
  { id: 'economics', index: '03', label: 'Economics' },
  { id: 'buyers', index: '04', label: 'Buyers' },
];

function money(amountMinor: number | null, currency: string, locale = 'id-ID', compact = true): string {
  if (amountMinor === null) return '—';
  return formatMoney({ amount: amountMinor, currency }, locale, { compact });
}

export function WorkflowPreview({
  scenarios,
  locale,
}: {
  scenarios: readonly SampleScenario[];
  locale: string;
}) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [step, setStep] = useState<Step>('material');
  const [templateId, setTemplateId] = useState<string | null>(null);

  const scenario = scenarios.find((entry) => entry.id === scenarioId) ?? scenarios[0] ?? null;
  if (!scenario) return null;

  const selected =
    scenario.opportunities.find((entry) => entry.templateId === templateId) ??
    scenario.opportunities[0] ??
    null;

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <div className="panel overflow-hidden">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-3">
        <SegmentedControl
          name="scenario"
          label="Sample scenario"
          value={scenario.id}
          onChange={(value) => {
            setScenarioId(value);
            setTemplateId(null);
          }}
          size="sm"
          options={scenarios.map((entry) => ({
            value: entry.id,
            label: entry.label.replace(/^Scenario \w+ — /, ''),
          }))}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent" technical>
            Live engine output · sample input
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* step rail */}
        <ol className="flex gap-2 overflow-x-auto border-b border-line p-4 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r">
          {STEPS.map((entry, index) => {
            const active = entry.id === step;
            const done = index < stepIndex;
            return (
              <li key={entry.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(entry.id)}
                  aria-current={active ? 'step' : undefined}
                  className={[
                    'flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors',
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-ink-muted hover:bg-surface-subtle hover:text-ink',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid size-5 shrink-0 place-items-center rounded-xs font-mono text-[0.625rem]',
                      active
                        ? 'bg-primary text-ink-inverse'
                        : done
                          ? 'bg-success-soft text-success'
                          : 'bg-surface-subtle text-ink-faint',
                    ].join(' ')}
                  >
                    {done ? <Check className="size-3" aria-hidden /> : entry.index}
                  </span>
                  <span className="text-[0.8125rem] font-medium">{entry.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* panel */}
        <div className="min-w-0 p-5">
          {step === 'material' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-ink">{scenario.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{scenario.blurb}</p>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
                  <dt className="micro-label">Registered material</dt>
                  <dd className="mt-1 text-sm text-ink">
                    {scenarioMaterialSummary(scenario.material)}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
                  <dt className="micro-label">Workshop profile</dt>
                  <dd className="mt-1 text-sm text-ink">{scenario.capability.name}</dd>
                  <dd className="micro-label mt-1">
                    {scenario.capability.tools.length} tools ·{' '}
                    {scenario.capability.processes.length} process steps
                  </dd>
                </div>
              </dl>

              <div>
                <h4 className="micro-label">Candidates proposed from the catalogue</h4>
                <ul className="mt-2 space-y-1.5">
                  {scenario.opportunities.map((opportunity) => {
                    const active = opportunity.templateId === selected?.templateId;
                    return (
                      <li key={opportunity.templateId}>
                        <button
                          type="button"
                          onClick={() => setTemplateId(opportunity.templateId)}
                          aria-pressed={active}
                          className={[
                            'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                            active
                              ? 'border-primary bg-primary-soft'
                              : 'border-line hover:border-line-strong',
                          ].join(' ')}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">
                              {opportunity.productName}
                            </span>
                            <span className="micro-label">
                              {opportunity.complexity} complexity ·{' '}
                              {opportunity.labourMinutesPerUnit} min/unit
                            </span>
                          </span>
                          <span
                            className={[
                              'grid size-6 shrink-0 place-items-center rounded-full',
                              opportunity.gatesPassed
                                ? 'bg-success-soft text-success'
                                : 'bg-danger-soft text-danger',
                            ].join(' ')}
                          >
                            {opportunity.gatesPassed ? (
                              <Check className="size-3.5" aria-hidden />
                            ) : (
                              <X className="size-3.5" aria-hidden />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                  The model may only pick from this catalogue and set parameters inside declared
                  bounds. It cannot invent geometry, tooling, labour times or consumables.
                </p>
              </div>
            </div>
          ) : null}

          {step === 'feasibility' && selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={selected.gatesPassed ? 'success' : 'danger'}
                  className="text-xs font-medium"
                >
                  {FEASIBILITY_LABELS[selected.status]}
                </Badge>
                {selected.maxUnits > 0 ? (
                  <Badge tone="neutral" technical>
                    {selected.maxUnits} units · {selected.wastePercent}% waste
                  </Badge>
                ) : null}
              </div>

              {selected.feasibility ? (
                <>
                  <ul className="space-y-2">
                    {selected.feasibility.checks
                      .filter((check) => check.outcome !== 'skipped')
                      .map((check) => (
                        <li key={check.id} className="flex flex-wrap items-baseline gap-2">
                          <span
                            className={[
                              'grid size-4 shrink-0 place-items-center rounded-full',
                              check.outcome === 'pass'
                                ? 'bg-success-soft text-success'
                                : check.outcome === 'fail'
                                  ? 'bg-danger-soft text-danger'
                                  : 'bg-warning-soft text-warning',
                            ].join(' ')}
                          >
                            {check.outcome === 'pass' ? (
                              <Check className="size-2.5" aria-hidden />
                            ) : (
                              <X className="size-2.5" aria-hidden />
                            )}
                          </span>
                          <span className="text-sm text-ink">{check.label}</span>
                          <span className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
                            {check.detail}
                          </span>
                        </li>
                      ))}
                  </ul>

                  {selected.rejectReasons.length > 0 ? (
                    <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3">
                      <p className="text-xs font-medium text-danger">Why this was rejected</p>
                      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-danger">
                        {selected.rejectReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <CuttingDiagram
                      sheet={selected.unitLayout[0] ?? null}
                      kerfMm={selected.kerfMm}
                    />
                  )}

                  <ul className="space-y-1 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
                    {selected.feasibility.assumptions.slice(0, 3).map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          {step === 'economics' && selected ? (
            <div className="space-y-4">
              {selected.cost ? (
                <>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
                      <dt className="micro-label">Production cost / unit</dt>
                      <dd className="tnum mt-1 font-mono text-lg text-ink">
                        {money(selected.unitCostMinor, scenario.currency, locale)}
                      </dd>
                    </div>
                    <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
                      <dt className="micro-label">Minimum viable price</dt>
                      <dd className="tnum mt-1 font-mono text-lg text-ink">
                        {money(selected.minViablePriceMinor, scenario.currency, locale)}
                      </dd>
                    </div>
                    <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
                      <dt className="micro-label">Reference price</dt>
                      <dd className="tnum mt-1 font-mono text-lg text-ink">
                        {money(selected.referencePriceMinor, scenario.currency, locale)}
                      </dd>
                      <dd className="micro-label mt-0.5">
                        {EVIDENCE_QUALITY_LABELS[selected.evidenceQuality]}
                      </dd>
                    </div>
                  </dl>

                  <table className="w-full border-collapse text-sm">
                    <caption className="micro-label mb-2 text-left">
                      Cost lines carry their own assumption. Nothing is a lumped total.
                    </caption>
                    <tbody className="divide-y divide-line">
                      {selected.cost.lineItems.slice(0, 5).map((line) => (
                        <tr key={line.id}>
                          <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">
                            {line.label}
                          </th>
                          <td className="py-2 pr-4 text-xs text-ink-muted">{line.basis}</td>
                          <td className="tnum py-2 text-right font-mono text-[0.8125rem]">
                            {money(line.perUnitMinor, scenario.currency, locale, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Badge tone="neutral">
                      Contribution {money(selected.contributionPerUnitMinor, scenario.currency, locale)}
                    </Badge>
                    <Badge tone="neutral">
                      Margin{' '}
                      {selected.contributionMarginBps === null
                        ? '—'
                        : `${(selected.contributionMarginBps / 100).toFixed(1)}%`}
                    </Badge>
                    <Badge tone="neutral" technical>
                      Batch of {selected.cost.assumptions.batchSize}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  No cost is calculated, because this candidate cannot be produced from the material
                  as specified.
                </p>
              )}
            </div>
          ) : null}

          {step === 'buyers' && selected ? (
            <div className="space-y-4">
              {selected.buyerMatchSet.verifiedRequests.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="micro-label">
                    {DEMAND_KIND_LABELS.verified_request}
                  </h4>
                  {selected.buyerMatchSet.verifiedRequests.map((match) => (
                    <div
                      key={match.requirementId ?? match.label}
                      className="rounded-md border border-line bg-surface px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{match.label}</span>
                        <Badge tone="neutral" technical>
                          match {match.score ?? '—'}/100
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {match.caveats[0]}
                      </p>
                      {match.shortfall ? (
                        <p className="mt-2 rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
                          Wants {match.shortfall.requested} units; this material yields{' '}
                          {match.shortfall.availableCapacity}. Short by{' '}
                          {match.shortfall.shortfall}.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2">
                <h4 className="micro-label">{DEMAND_KIND_LABELS.potential_segment}</h4>
                <ul className="flex flex-wrap gap-1.5">
                  {selected.segments.map((segment) => (
                    <li key={segment.label}>
                      <Badge tone="neutral" className="capitalize">
                        {segment.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-ink-muted">
                  These are categories of buyer, not companies. resaikel never names a brand as a
                  purchaser, and only surfaces registered demand that its owner consented to share.
                </p>
              </div>

              {selected.market.evidence.length > 0 ? (
                <div className="border-t border-line pt-3">
                  <h4 className="micro-label">Evidence behind the price</h4>
                  <ul className="mt-2 space-y-1">
                    {selected.market.evidence.slice(0, 3).map((row) => (
                      <li key={row.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                        <Badge tone="neutral" technical>
                          {EVIDENCE_SOURCE_LABELS[row.sourceType]}
                        </Badge>
                        <span className="min-w-0 flex-1 text-ink-muted">{row.description}</span>
                        <span className="tnum font-mono text-ink-muted">
                          {row.priceMinor.toLocaleString(locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {selected.market.caveats.length > 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                      {selected.market.caveats[0]}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-ink-muted">
                  Insufficient Market Data for this category, so no price is shown at all.
                </p>
              )}
            </div>
          ) : null}

          {/* navigation */}
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-8"
              disabled={stepIndex === 0}
              onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)]?.id ?? 'material')}
            >
              Previous
            </Button>
            <div className="relative flex items-center gap-2">
              <GridBackdrop className="opacity-0" />
              <span className="micro-label">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
              {stepIndex < STEPS.length - 1 ? (
                <Button
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  iconRight={<ArrowRight className="size-4" aria-hidden />}
                  onClick={() =>
                    setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]?.id ?? 'buyers')
                  }
                >
                  Next
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="accent"
                  className="min-h-11 sm:min-h-8"
                  onClick={() => setStep('material')}
                >
                  Start again
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
