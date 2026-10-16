'use client';

import { Factory } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/form';
import { formatMoney } from '@/domain/money';
import type { ProductionOutcomeDocument } from '@/domain/outcomes/types';
import { ApiError, apiRequest, newIdempotencyKey } from '@/lib/api-client';

const COST_FIELDS = [
  ['additionalMaterialsMinor', 'Additional materials'],
  ['labourMinor', 'Labour'],
  ['overheadMinor', 'Workshop overhead'],
  ['packagingMinor', 'Packaging'],
  ['otherMinor', 'Other actual costs'],
] as const;

function asNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function ProductionOutcomes({
  opportunityId,
  saved,
  outcomes,
  currency,
  locale,
  quantityUnit,
}: {
  opportunityId: string;
  saved: boolean;
  outcomes: readonly ProductionOutcomeDocument[];
  currency: string;
  locale: string;
  quantityUnit: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({
    quantityManufactured: '0',
    quantitySold: '0',
    materialConsumedQuantity: '0',
    remainingMaterialQuantity: '0',
    unusedWasteQuantity: '0',
    actualRevenueMinor: '0',
    additionalMaterialsMinor: '0',
    labourMinor: '0',
    overheadMinor: '0',
    packagingMinor: '0',
    otherMinor: '0',
    occurredOn: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function set(key: string, value: string): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const manufactured = Math.round(asNumber(values['quantityManufactured'] ?? '0'));
    const sold = Math.round(asNumber(values['quantitySold'] ?? '0'));
    if (sold > manufactured) {
      setError('Quantity sold cannot exceed quantity manufactured.');
      return;
    }

    setBusy(true);
    try {
      const result = await apiRequest<{ notice: string }>(
        `/api/opportunities/${opportunityId}/outcomes`,
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
          body: {
            quantityManufactured: manufactured,
            quantitySold: sold,
            materialConsumedQuantity: asNumber(values['materialConsumedQuantity'] ?? '0'),
            remainingMaterialQuantity: asNumber(values['remainingMaterialQuantity'] ?? '0'),
            unusedWasteQuantity: asNumber(values['unusedWasteQuantity'] ?? '0'),
            actualRevenueMinor: Math.round(asNumber(values['actualRevenueMinor'] ?? '0')),
            costLines: Object.fromEntries(
              COST_FIELDS.map(([key]) => [key, Math.round(asNumber(values[key] ?? '0'))]),
            ),
            occurredAt: new Date(`${values['occurredOn']}T12:00:00.000Z`).toISOString(),
            notes: values['notes']?.trim() || null,
          },
        },
      );
      setNotice(result.notice);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The outcome could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Actual outcome"
        title="What happened in production"
        description="Actual quantities, costs and revenue stay separate from the estimate. Recording a loss is valid evidence, not a failed form."
      />
      <CardBody className="space-y-6">
        {error ? <Alert tone="danger" title="Could not record outcome">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {outcomes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="micro-label mb-2 text-left">Recorded actuals</caption>
              <thead className="border-b border-line">
                <tr>
                  <th className="micro-label py-2 text-left" scope="col">Date</th>
                  <th className="micro-label py-2 text-right" scope="col">Made / sold</th>
                  <th className="micro-label py-2 text-right" scope="col">Actual cost</th>
                  <th className="micro-label py-2 text-right" scope="col">Revenue</th>
                  <th className="micro-label py-2 text-right" scope="col">Gross result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {outcomes.map((outcome) => (
                  <tr key={outcome.id}>
                    <td className="py-2.5">{new Date(outcome.occurredAt).toLocaleDateString(locale)}</td>
                    <td className="tnum py-2.5 text-right font-mono text-[0.8125rem]">
                      {outcome.quantityManufactured} / {outcome.quantitySold}
                    </td>
                    <td className="tnum py-2.5 text-right font-mono text-[0.8125rem]">
                      {formatMoney({ amount: outcome.totalActualCostMinor, currency }, locale)}
                    </td>
                    <td className="tnum py-2.5 text-right font-mono text-[0.8125rem]">
                      {formatMoney({ amount: outcome.actualRevenueMinor, currency }, locale)}
                    </td>
                    <td className={`tnum py-2.5 text-right font-mono text-[0.8125rem] ${outcome.actualGrossProfitMinor < 0 ? 'text-danger' : ''}`}>
                      {formatMoney({ amount: outcome.actualGrossProfitMinor, currency }, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert tone="info">No actual production result has been recorded yet.</Alert>
        )}

        {saved ? (
          <form onSubmit={(event) => void submit(event)} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Production date" htmlFor="outcome-date" required>
                <Input id="outcome-date" type="date" value={values['occurredOn']} onChange={(event) => set('occurredOn', event.target.value)} required />
              </Field>
              <Field label="Manufactured" htmlFor="outcome-made" required>
                <Input id="outcome-made" type="number" min={0} step={1} value={values['quantityManufactured']} onChange={(event) => set('quantityManufactured', event.target.value)} className="tnum text-right" />
              </Field>
              <Field label="Sold" htmlFor="outcome-sold" required>
                <Input id="outcome-sold" type="number" min={0} step={1} value={values['quantitySold']} onChange={(event) => set('quantitySold', event.target.value)} className="tnum text-right" />
              </Field>
              <Field label={`Actual revenue (${currency})`} htmlFor="outcome-revenue" required>
                <Input id="outcome-revenue" type="number" min={0} step={1} value={values['actualRevenueMinor']} onChange={(event) => set('actualRevenueMinor', event.target.value)} className="tnum text-right" />
              </Field>
            </div>

            <fieldset>
              <legend className="micro-label mb-3">Material balance ({quantityUnit})</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                {([
                  ['materialConsumedQuantity', 'Consumed'],
                  ['remainingMaterialQuantity', 'Remaining'],
                  ['unusedWasteQuantity', 'Unused or wasted'],
                ] as const).map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`outcome-${key}`}>
                    <Input id={`outcome-${key}`} type="number" min={0} step="any" value={values[key]} onChange={(event) => set(key, event.target.value)} className="tnum text-right" />
                  </Field>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="micro-label mb-3">Actual cost lines ({currency})</legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {COST_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`outcome-${key}`}>
                    <Input id={`outcome-${key}`} type="number" min={0} step={1} value={values[key]} onChange={(event) => set(key, event.target.value)} className="tnum text-right" />
                  </Field>
                ))}
              </div>
            </fieldset>

            <Field label="Notes" htmlFor="outcome-notes" hint="Optional context such as rejects, returns or a changed process.">
              <Textarea id="outcome-notes" value={values['notes']} onChange={(event) => set('notes', event.target.value)} />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={busy} iconLeft={<Factory className="size-4" aria-hidden />}>
                Record actual outcome
              </Button>
              <p className="text-xs text-ink-faint">This does not change the original estimate.</p>
            </div>
          </form>
        ) : (
          <Alert tone="warning" title="Save the opportunity first">
            Saving marks this product as selected work and prevents accidental outcome records on a discarded idea.
          </Alert>
        )}
      </CardBody>
    </Card>
  );
}
