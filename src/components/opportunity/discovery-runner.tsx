'use client';

import { Compass, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, IndeterminateBar } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/form';
import { ApiError, apiRequest, newIdempotencyKey } from '@/lib/api-client';

export interface DiscoverableMaterial {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly dimensions: { lengthMm: number | null; widthMm: number | null; thicknessMm: number | null };
  readonly quantity: { value: number; unit: string };
}

const STAGES = [
  'Selecting candidate products from the catalogue',
  'Validating each candidate against the 2D cutting layout',
  'Calculating production cost line by line',
  'Checking market evidence for each product category',
  'Matching buyer segments and registered demand',
  'Ranking the surviving candidates',
];

/**
 * Discovery runner.
 *
 * Runs the whole pipeline for one confirmed material. The stage list is shown
 * rather than a spinner, because the pipeline genuinely consists of these steps
 * in this order and the wait is where the product's reasoning happens.
 */
export function DiscoveryRunner({
  materials,
  initialMaterialId,
  hasCapability,
}: {
  materials: readonly DiscoverableMaterial[];
  initialMaterialId: string | null;
  hasCapability: boolean;
}) {
  const router = useRouter();

  const [materialId, setMaterialId] = useState(
    initialMaterialId ?? materials[0]?.id ?? '',
  );
  const [assumptions, setAssumptions] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string[]>([]);

  const selected = materials.find((material) => material.id === materialId) ?? null;

  function parseOverrides(): Record<string, number> | undefined {
    const entries = assumptions
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (entries.length === 0) return undefined;

    const overrides: Record<string, number> = {};
    for (const entry of entries) {
      const [key, rawValue] = entry.split('=').map((part) => part.trim());
      const value = Number(rawValue);
      if (!key || !Number.isFinite(value)) continue;
      overrides[key] = value;
    }

    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }

  async function run(): Promise<void> {
    if (!materialId) {
      setError('Choose a confirmed material first.');
      return;
    }

    setBusy(true);
    setError(null);
    setBlocking([]);
    setStage(0);

    const overrides = parseOverrides();

    // Advance the visible stage while the single request is in flight.
    const timer = setInterval(() => {
      setStage((current) => (current < STAGES.length - 1 ? current + 1 : current));
    }, 900);

    try {
      await apiRequest(`/api/materials/${materialId}/discover`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { replace: true, ...(overrides ? { overrides } : {}) },
      });

      setStage(STAGES.length - 1);
      router.push(`/opportunities?materialId=${materialId}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setBlocking(caught.blocking.length > 0 ? caught.blocking : caught.issues);
      } else {
        setError('Discovery could not be completed.');
      }
      setStage(-1);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  if (materials.length === 0) {
    return (
      <Alert tone="warning" title="No confirmed materials yet">
        Discovery needs a confirmed material, because every gate depends on measured dimensions. Scan
        a material and confirm its properties first.
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Product opportunity discovery"
        title="Turn this material into candidate products"
        description="The model may only choose from a curated catalogue of validated specifications and propose parameter values inside declared bounds. It cannot invent geometry, tooling or labour times."
      />

      <CardBody className="space-y-5">
        {error ? (
          <Alert tone="danger" title="Discovery could not run">
            {error}
            {blocking.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {blocking.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        <Field label="Confirmed material" htmlFor="materialId" required>
          <Select
            id="materialId"
            value={materialId}
            onChange={(event) => setMaterialId(event.target.value)}
            disabled={busy}
          >
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.title}
                {material.dimensions.lengthMm !== null && material.dimensions.widthMm !== null
                  ? ` — ${material.dimensions.lengthMm}×${material.dimensions.widthMm} mm`
                  : ''}
              </option>
            ))}
          </Select>
        </Field>

        {selected ? (
          <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
            <p className="micro-label">Will be evaluated against</p>
            <p className="mt-1 text-sm text-ink">
              {selected.quantity.value} {selected.quantity.unit} of {selected.category} at{' '}
              {selected.dimensions.lengthMm ?? '?'} × {selected.dimensions.widthMm ?? '?'} mm
              {selected.dimensions.thicknessMm !== null
                ? ` × ${selected.dimensions.thicknessMm} mm`
                : ' (thickness not measured)'}
            </p>
          </div>
        ) : null}

        <Field
          label="Cost assumption overrides"
          htmlFor="assumptions"
          hint="Optional. One per line as key = value, e.g. labourRatePerHourMinor = 45000. Anything you leave out keeps its default."
        >
          <Textarea
            id="assumptions"
            value={assumptions}
            onChange={(event) => setAssumptions(event.target.value)}
            placeholder={'labourRatePerHourMinor = 45000\nplatformFeePercent = 10\ntargetMarginPercent = 40'}
            disabled={busy}
          />
        </Field>

        {!hasCapability ? (
          <Alert tone="info">
            <span className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                No workshop capability profile is set up, so tooling cannot be verified. Results will
                stop at “geometrically feasible” rather than claiming a full process verdict.
              </span>
            </span>
          </Alert>
        ) : null}

        {busy ? (
          <div className="space-y-3">
            <ol className="space-y-1.5">
              {STAGES.map((entry, index) => (
                <li
                  key={entry}
                  className={[
                    'flex items-center gap-2 text-sm transition-colors',
                    index < stage ? 'text-ink-muted' : index === stage ? 'text-ink' : 'text-ink-faint',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className={[
                      'size-1.5 shrink-0 rounded-full',
                      index <= stage ? 'bg-primary' : 'bg-line-strong',
                    ].join(' ')}
                  />
                  {entry}
                </li>
              ))}
            </ol>
            <IndeterminateBar />
          </div>
        ) : null}
      </CardBody>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-sunken px-5 py-3">
        <Button
          loading={busy}
          iconLeft={<Compass className="size-4" aria-hidden />}
          onClick={() => void run()}
        >
          Run discovery
        </Button>
        <p className="text-xs text-ink-faint">
          Feasibility is a conservative 2D estimate. It is not a production drawing.
        </p>
      </div>
    </Card>
  );
}
