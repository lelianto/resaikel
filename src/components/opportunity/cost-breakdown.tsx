'use client';

import { Calculator, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import {
  ASSUMPTION_GROUP_LABELS,
  COST_ASSUMPTION_DESCRIPTORS,
  type AssumptionGroup,
  type CostEstimate,
} from '@/domain/cost/types';
import { formatMoney } from '@/domain/money';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Production cost estimate.
 *
 * Every line item shows the arithmetic that produced it, and every input is
 * editable. The numbers are recomputed by the deterministic engine on the server —
 * this component only supplies inputs and renders what comes back.
 */

const GROUPS: readonly AssumptionGroup[] = [
  'material',
  'production',
  'energy',
  'overheads',
  'commercial',
];

function money(amountMinor: number | null, currency: string, locale: string): string {
  if (amountMinor === null) return '—';
  return formatMoney({ amount: amountMinor, currency }, locale);
}

export function CostBreakdown({
  opportunityId,
  initialCost,
  locale,
}: {
  opportunityId: string;
  initialCost: CostEstimate;
  locale: string;
}) {
  const router = useRouter();

  const [cost, setCost] = useState<CostEstimate>(initialCost);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const currency = cost.currency;
  const dirty = Object.keys(edits).length > 0;
  const reference = cost.scenarios.find((scenario) => scenario.id === 'reference') ?? null;

  async function recompute(): Promise<void> {
    setBusy(true);
    setError(null);
    setIssues([]);
    setNotice(null);

    const overrides: Record<string, number> = {};
    for (const [key, raw] of Object.entries(edits)) {
      const value = Number(raw);
      if (Number.isFinite(value)) overrides[key] = value;
    }

    try {
      const result = await apiRequest<{ cost: CostEstimate; issues: string[] }>(
        `/api/opportunities/${opportunityId}/cost-estimate`,
        { method: 'POST', body: { overrides } },
      );
      setCost(result.cost);
      setIssues(result.issues);
      setEdits({});
      setNotice(
        result.issues.length > 0
          ? 'Recomputed. Some values were outside the allowed range and were clamped.'
          : 'Recomputed with your assumptions.',
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'The estimate could not be recomputed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Cost intelligence"
        title="Production cost, line by line"
        description="Every figure below is derived from a named assumption you can change. Nothing here is a made-up total: resaikel computes it with integer arithmetic and shows its working."
        actions={
          <Button
            size="sm"
            loading={busy}
            disabled={!dirty}
            iconLeft={<Calculator className="size-4" aria-hidden />}
            onClick={() => void recompute()}
          >
            Recompute
          </Button>
        }
      />

      <CardBody className="space-y-6">
        {error ? (
          <Alert tone="danger" title="Could not recompute">
            {error}
          </Alert>
        ) : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {issues.length > 0 ? (
          <Alert tone="warning" title="Clamped values">
            <ul className="list-disc space-y-1 pl-4">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {/* ------------------------------------------------------------ summary */}
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
            <dt className="micro-label">Production cost / unit</dt>
            <dd className="tnum mt-1 font-mono text-lg text-ink">
              {money(cost.unitCostMinor, currency, locale)}
            </dd>
            <dd className="mt-1 text-xs text-ink-muted">
              Variable {money(cost.variableCostIncludingAllowanceMinor, currency, locale)} + overhead and
              transport
            </dd>
          </div>
          <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
            <dt className="micro-label">Minimum viable price / unit</dt>
            <dd className="tnum mt-1 font-mono text-lg text-ink">
              {money(cost.minViablePricePerUnitMinor, currency, locale)}
            </dd>
            <dd className="mt-1 text-xs text-ink-muted">
              Covers cost, the {cost.assumptions.platformFeePercent}% platform fee and the{' '}
              {cost.assumptions.targetMarginPercent}% target margin
            </dd>
          </div>
          <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
            <dt className="micro-label">Break-even</dt>
            <dd className="tnum mt-1 font-mono text-lg text-ink">
              {cost.breakEvenUnits === null ? '—' : `${cost.breakEvenUnits} units`}
            </dd>
            <dd className="mt-1 text-xs text-ink-muted">
              Fixed batch costs of {money(cost.fixedBatchCostMinor, currency, locale)} divided by the
              variable contribution at the reference price
            </dd>
          </div>
        </dl>

        {/* -------------------------------------------------------- line items */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="micro-label mb-2 text-left">
              Line items, in {currency}. Fixed batch costs are spread upwards across{' '}
              {cost.assumptions.batchSize} units.
            </caption>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className="micro-label py-2 text-left">
                  Line
                </th>
                <th scope="col" className="micro-label py-2 text-left">
                  How it is calculated
                </th>
                <th scope="col" className="micro-label py-2 text-right">
                  Per unit
                </th>
                <th scope="col" className="micro-label py-2 text-right">
                  Per batch
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cost.lineItems.map((line) => (
                <tr key={line.id} className={line.excludedFromUnitCost ? 'opacity-70' : undefined}>
                  <th scope="row" className="py-2.5 pr-4 text-left align-top font-medium text-ink">
                    {line.label}
                    {line.fixed ? (
                      <span className="ml-1.5 text-[0.6875rem] font-normal text-ink-faint">
                        fixed
                      </span>
                    ) : null}
                  </th>
                  <td className="py-2.5 pr-4 align-top text-xs leading-relaxed text-ink-muted">
                    {line.basis}
                  </td>
                  <td className="tnum py-2.5 text-right align-top font-mono text-[0.8125rem]">
                    {money(line.perUnitMinor, currency, locale)}
                  </td>
                  <td className="tnum py-2.5 text-right align-top font-mono text-[0.8125rem]">
                    {money(line.batchMinor, currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line-strong">
              <tr>
                <th scope="row" colSpan={2} className="py-2.5 pr-4 text-left font-medium text-ink">
                  Production cost per unit
                  <span className="ml-1.5 text-[0.6875rem] font-normal text-ink-faint">
                    excludes the platform fee, which is charged on the sale
                  </span>
                </th>
                <td className="tnum py-2.5 text-right font-mono text-[0.8125rem] font-medium">
                  {money(cost.unitCostMinor, currency, locale)}
                </td>
                <td className="tnum py-2.5 text-right font-mono text-[0.8125rem] font-medium">
                  {money(cost.batchCostMinor, currency, locale)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* --------------------------------------------------------- scenarios */}
        {cost.scenarios.length > 0 ? (
          <div className="space-y-2">
            <h3 className="micro-label">Revenue scenarios from market evidence</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th scope="col" className="micro-label py-2 text-left">
                      Scenario
                    </th>
                    <th scope="col" className="micro-label py-2 text-right">
                      Price / unit
                    </th>
                    <th scope="col" className="micro-label py-2 text-right">
                      Contribution / unit
                    </th>
                    <th scope="col" className="micro-label py-2 text-right">
                      Margin
                    </th>
                    <th scope="col" className="micro-label py-2 text-right">
                      Batch contribution
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cost.scenarios.map((scenario) => (
                    <tr key={scenario.id}>
                      <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink">
                        {scenario.label}
                      </th>
                      <td className="tnum py-2.5 text-right font-mono text-[0.8125rem]">
                        {money(scenario.pricePerUnitMinor, currency, locale)}
                      </td>
                      <td
                        className={[
                          'tnum py-2.5 text-right font-mono text-[0.8125rem]',
                          scenario.contributionPerUnitMinor < 0 ? 'text-danger' : '',
                        ].join(' ')}
                      >
                        {money(scenario.contributionPerUnitMinor, currency, locale)}
                      </td>
                      <td className="tnum py-2.5 text-right font-mono text-[0.8125rem]">
                        {scenario.contributionMarginBps === null
                          ? '—'
                          : `${(scenario.contributionMarginBps / 100).toFixed(1)}%`}
                      </td>
                      <td className="tnum py-2.5 text-right font-mono text-[0.8125rem]">
                        {money(scenario.batchContributionMinor, currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reference ? (
              <p className="text-xs leading-relaxed text-ink-faint">
                Scenario prices come from the curated market reference set, not from observed demand.
                The reference scenario is the median of the observations; low and high are the 25th and
                75th percentiles.
              </p>
            ) : null}
          </div>
        ) : (
          <Alert tone="info" title="No price scenarios">
            There is no usable market evidence for this product category, so no revenue scenario is
            shown. resaikel reports “Insufficient Market Data” rather than inventing a price.
          </Alert>
        )}

        {/* -------------------------------------------------------- assumptions */}
        <div className="space-y-4 border-t border-line pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="micro-label">Assumptions — change any of these</h3>
            {dirty ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
                onClick={() => setEdits({})}
              >
                <RotateCcw className="size-3" aria-hidden />
                Discard {Object.keys(edits).length} change(s)
              </button>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">
            The starting values are illustrative sample figures, not measured costs for any workshop.
            Replace them with your own numbers before quoting a buyer.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            {GROUPS.map((group) => {
              const descriptors = COST_ASSUMPTION_DESCRIPTORS.filter(
                (descriptor) => descriptor.group === group,
              );
              if (descriptors.length === 0) return null;

              return (
                <fieldset key={group} className="space-y-3">
                  <legend className="micro-label">{ASSUMPTION_GROUP_LABELS[group]}</legend>

                  {descriptors.map((descriptor) => {
                    const current = cost.assumptions[descriptor.key];
                    const value = edits[descriptor.key] ?? String(current);
                    const unitLabel =
                      descriptor.unit === 'currency'
                        ? currency
                        : descriptor.unit === 'percent'
                          ? '%'
                          : descriptor.unit === 'minutes'
                            ? 'min'
                            : descriptor.unit === 'kwh'
                              ? 'kWh'
                              : '';

                    return (
                      <div key={descriptor.key} className="space-y-1">
                        <label
                          htmlFor={`assumption-${descriptor.key}`}
                          className="flex items-baseline justify-between gap-3 text-[0.8125rem] text-ink"
                        >
                          <span>{descriptor.label}</span>
                          <span className="micro-label tnum">
                            {descriptor.min}–{descriptor.max}
                          </span>
                        </label>
                        <Input
                          id={`assumption-${descriptor.key}`}
                          type="number"
                          inputMode="decimal"
                          step={descriptor.step}
                          min={descriptor.min}
                          max={descriptor.max}
                          value={value}
                          trailing={unitLabel || undefined}
                          className="tnum text-right"
                          onChange={(event) =>
                            setEdits((currentEdits) => {
                              if (event.target.value === String(current)) {
                                const next = { ...currentEdits };
                                delete next[descriptor.key];
                                return next;
                              }
                              return { ...currentEdits, [descriptor.key]: event.target.value };
                            })
                          }
                        />
                        <p className="text-xs leading-relaxed text-ink-muted">{descriptor.help}</p>
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------- notes */}
        {cost.warnings.length > 0 ? (
          <Alert tone="warning" title="Worth knowing">
            <ul className="list-disc space-y-1 pl-4">
              {cost.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <ul className="space-y-1.5 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
          {cost.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </CardBody>

      <CardFooter>
        <p className="text-xs text-ink-faint">
          Recomputed {new Date(cost.computedAt).toLocaleString(locale)}
        </p>
        <Button size="sm" loading={busy} disabled={!dirty} onClick={() => void recompute()}>
          Recompute with these assumptions
        </Button>
      </CardFooter>
    </Card>
  );
}
