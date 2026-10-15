'use client';

import { Save, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/form';
import { PROCESS_IDS, PROCESS_LABELS, TOOL_IDS, TOOL_LABELS } from '@/domain/catalog/types';
import { MATERIAL_FAMILIES, MATERIAL_FAMILY_LABELS } from '@/domain/materials/types';
import type { MaterialFamily } from '@/domain/materials/types';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Workshop capability profile.
 *
 * This is what the feasibility engine's tooling gate reads. Without it, a result
 * can only ever reach "geometrically feasible" — the geometry is known but the
 * process is not — and the UI says exactly that rather than implying a full
 * verdict.
 */

export interface CapabilityFormValues {
  readonly name: string;
  readonly city: string | null;
  readonly country: string;
  readonly capacityNote: string | null;
  readonly tools: readonly string[];
  readonly processes: readonly string[];
  readonly supportedFamilies: readonly MaterialFamily[];
  readonly labourRatePerHourMinor: number | null;
}

export function CapabilityForm({
  initial,
  countries,
  currency,
}: {
  initial: CapabilityFormValues | null;
  countries: readonly { code: string; label: string }[];
  currency: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [country, setCountry] = useState(initial?.country ?? countries[0]?.code ?? 'ID');
  const [capacityNote, setCapacityNote] = useState(initial?.capacityNote ?? '');
  const [labourRate, setLabourRate] = useState(
    initial?.labourRatePerHourMinor === null || initial?.labourRatePerHourMinor === undefined
      ? ''
      : String(initial.labourRatePerHourMinor),
  );
  const [tools, setTools] = useState<string[]>([...(initial?.tools ?? [])]);
  const [processes, setProcesses] = useState<string[]>([...(initial?.processes ?? [])]);
  const [families, setFamilies] = useState<MaterialFamily[]>([
    ...(initial?.supportedFamilies ?? []),
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggle(list: string[], value: string, set: (next: string[]) => void): void {
    set(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await apiRequest('/api/workshops', {
        method: 'POST',
        body: {
          name: name.trim(),
          city: city.trim().length > 0 ? city.trim() : null,
          country,
          capacityNote: capacityNote.trim().length > 0 ? capacityNote.trim() : null,
          tools,
          processes,
          supportedFamilies: families,
          ...(labourRate.trim().length > 0
            ? { labourRatePerHourMinor: Math.round(Number(labourRate)) }
            : {}),
        },
      });

      setNotice('Saved. Discovery will now check tooling against this profile.');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Those capabilities could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Workshop"
        title="What you can actually make"
        description="Feasibility checks every required tool against this list. Leaving something off is safer than adding it: a missing tool produces “conditionally feasible” with the gap named, rather than a false green light."
        actions={
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Wrench className="size-3.5" aria-hidden />
            {tools.length} tool(s) · {processes.length} process(es)
          </span>
        }
      />

      <CardBody>
        <form
          id="capability-form"
          onSubmit={(event) => void submit(event)}
          noValidate
          className="space-y-6"
        >
        {error ? (
          <Alert tone="danger" title="Could not save">
            {error}
          </Alert>
        ) : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Workshop name" htmlFor="workshopName" required>
            <Input
              id="workshopName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pilot Workshop Jakarta"
            />
          </Field>

          <Field label="Country" htmlFor="workshopCountry" required>
            <Select
              id="workshopCountry"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {countries.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="workshopCity">
            <Input id="workshopCity" value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>

          <Field
            label="Labour rate per hour"
            htmlFor="labourRate"
            hint={`Optional, in ${currency}. Used as the default for cost estimates.`}
          >
            <Input
              id="labourRate"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={labourRate}
              onChange={(event) => setLabourRate(event.target.value)}
              trailing={currency}
              className="tnum text-right"
            />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="micro-label">Tools available</legend>
          <div className="grid gap-0.5 sm:grid-cols-2">
            {TOOL_IDS.map((tool) => (
              <Checkbox
                key={tool}
                checked={tools.includes(tool)}
                onChange={() => toggle(tools, tool, setTools)}
                label={TOOL_LABELS[tool]}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="micro-label">Process steps you can perform</legend>
          <div className="grid gap-0.5 sm:grid-cols-2">
            {PROCESS_IDS.map((process) => (
              <Checkbox
                key={process}
                checked={processes.includes(process)}
                onChange={() => toggle(processes, process, setProcesses)}
                label={PROCESS_LABELS[process]}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="micro-label">Material families you accept</legend>
          <div className="grid gap-0.5 sm:grid-cols-2">
            {MATERIAL_FAMILIES.map((family) => (
              <Checkbox
                key={family}
                checked={families.includes(family)}
                onChange={() =>
                  setFamilies(
                    families.includes(family)
                      ? families.filter((entry) => entry !== family)
                      : [...families, family],
                  )
                }
                label={MATERIAL_FAMILY_LABELS[family]}
              />
            ))}
          </div>
        </fieldset>

        <Field
          label="Capacity note"
          htmlFor="capacityNote"
          hint="Free text about throughput, lead time or constraints. Not used in calculations."
        >
          <Textarea
            id="capacityNote"
            value={capacityNote}
            onChange={(event) => setCapacityNote(event.target.value)}
            placeholder="Two people, roughly 40 units a week alongside other work."
          />
        </Field>
        </form>
      </CardBody>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-sunken px-5 py-3">
        <Button
          type="submit"
          form="capability-form"
          loading={busy}
          iconLeft={<Save className="size-4" aria-hidden />}
        >
          Save capabilities
        </Button>
        <p className="text-xs text-ink-faint">
          Used by the tooling gate and as the default labour rate for costing.
        </p>
      </div>
    </Card>
  );
}
