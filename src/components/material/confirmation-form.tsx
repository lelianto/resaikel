'use client';

import { CheckCircle2, Save, Sparkle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProvenanceBadge } from '@/components/material/provenance-badge';
import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, Input, MeasurementInput, Select, Textarea } from '@/components/ui/form';
import { SegmentedControl } from '@/components/ui/segmented';
import {
  CONDITION_GRADES,
  CONDITION_LABELS,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
} from '@/domain/materials/types';
import type {
  ConditionGrade,
  Material,
  MaterialAttributeKey,
  MaterialCategory,
  QuantityUnit,
} from '@/domain/materials/types';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Material confirmation.
 *
 * The screen that turns a model's description into a set of facts a person has
 * signed off. Every field shows where its current value came from, and confirming
 * is blocked until the critical ones carry a human provenance.
 */

interface ConfirmationState {
  readonly ready: boolean;
  readonly blocking: readonly string[];
  readonly warnings: readonly string[];
}

function listToText(values: readonly string[]): string {
  return values.join(', ');
}

function textToList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
}

export function ConfirmationForm({
  material,
  confirmation,
}: {
  material: Material;
  confirmation: ConfirmationState;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(material.title);
  const [origin, setOrigin] = useState(material.origin ?? '');
  const [notes, setNotes] = useState(material.notes ?? '');
  const [category, setCategory] = useState<MaterialCategory>(material.attributes.category);
  const [subtype, setSubtype] = useState(material.attributes.subtype ?? '');
  const [color, setColor] = useState(material.attributes.color ?? '');
  const [texture, setTexture] = useState(material.attributes.texture ?? '');
  const [shape, setShape] = useState(material.attributes.shape ?? '');
  const [condition, setCondition] = useState<ConditionGrade>(material.attributes.condition);
  const [contamination, setContamination] = useState(listToText(material.attributes.contamination));
  const [defects, setDefects] = useState(listToText(material.attributes.defects));
  const [lengthMm, setLengthMm] = useState(
    material.dimensions.lengthMm === null ? '' : String(material.dimensions.lengthMm),
  );
  const [widthMm, setWidthMm] = useState(
    material.dimensions.widthMm === null ? '' : String(material.dimensions.widthMm),
  );
  const [thicknessMm, setThicknessMm] = useState(
    material.dimensions.thicknessMm === null ? '' : String(material.dimensions.thicknessMm),
  );
  const [quantityValue, setQuantityValue] = useState(String(material.quantity.value));
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(material.quantity.unit);
  const [dimensionSource, setDimensionSource] = useState<'measured' | 'user'>('measured');

  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const verified = material.status === 'verified';

  function buildPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {
      title: title.trim(),
      origin: origin.trim().length > 0 ? origin.trim() : null,
      notes: notes.trim().length > 0 ? notes.trim() : null,
      category,
      subtype: subtype.trim().length > 0 ? subtype.trim() : null,
      color: color.trim().length > 0 ? color.trim() : null,
      texture: texture.trim().length > 0 ? texture.trim() : null,
      shape: shape.trim().length > 0 ? shape.trim() : null,
      condition,
      contamination: textToList(contamination),
      defects: textToList(defects),
      quantityValue: Number(quantityValue),
      quantityUnit,
      dimensionSource,
    };

    if (lengthMm.trim().length > 0) patch.lengthMm = Math.round(Number(lengthMm));
    if (widthMm.trim().length > 0) patch.widthMm = Math.round(Number(widthMm));
    if (thicknessMm.trim().length > 0) patch.thicknessMm = Math.round(Number(thicknessMm));

    return patch;
  }

  async function save(): Promise<void> {
    setBusy('save');
    setError(null);
    setBlocking([]);
    setNotice(null);
    try {
      await apiRequest(`/api/materials/${material.id}`, { method: 'PATCH', body: buildPatch() });
      setNotice('Saved.');
      router.refresh();
    } catch (caught) {
      handle(caught);
    } finally {
      setBusy(null);
    }
  }

  async function confirm(): Promise<void> {
    setBusy('confirm');
    setError(null);
    setBlocking([]);
    setNotice(null);
    try {
      await apiRequest(`/api/materials/${material.id}/confirm`, {
        method: 'POST',
        body: { patch: buildPatch() },
      });
      setNotice('Confirmed. This material can now be turned into product opportunities.');
      router.refresh();
    } catch (caught) {
      handle(caught);
    } finally {
      setBusy(null);
    }
  }

  function handle(caught: unknown): void {
    if (caught instanceof ApiError) {
      setError(caught.message);
      if (caught.blocking.length > 0) setBlocking(caught.blocking);
      else if (caught.issues.length > 0) setBlocking(caught.issues);
    } else {
      setError('That change could not be saved.');
    }
  }

  function provenanceFor(key: MaterialAttributeKey) {
    return material.provenance[key];
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Material verification"
        title="Confirm the physical properties"
        description="Nothing is evaluated until a person has confirmed these. An AI inference is never treated as a measurement, and an unmeasured field stays unknown rather than being assumed."
        actions={
          verified ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Confirmed
            </span>
          ) : null
        }
      />

      <CardBody className="space-y-6">
        {error ? (
          <Alert tone="danger" title="Could not continue">
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

        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {!verified && confirmation.blocking.length > 0 ? (
          <Alert tone="warning" title="Required before evaluation">
            <ul className="list-disc space-y-1 pl-4">
              {confirmation.blocking.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {material.warnings.length > 0 ? (
          <Alert tone="warning" title="Warnings on this material">
            <ul className="list-disc space-y-1 pl-4">
              {material.warnings.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {/* ------------------------------------------------------------ identity */}
        <fieldset className="space-y-4">
          <legend className="micro-label">Identification</legend>

          <Field label="Material name" htmlFor="title" required>
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Category"
              htmlFor="category"
              required
              hint="Feasibility cannot be decided without this."
            >
              <div className="space-y-2">
                <Select
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as MaterialCategory)}
                >
                  {MATERIAL_CATEGORIES.map((entry) => (
                    <option key={entry} value={entry}>
                      {MATERIAL_CATEGORY_LABELS[entry]}
                    </option>
                  ))}
                </Select>
                <ProvenanceBadge provenance={provenanceFor('category')} />
              </div>
            </Field>

            <Field label="Condition" htmlFor="condition" required>
              <div className="space-y-2">
                <Select
                  id="condition"
                  value={condition}
                  onChange={(event) => setCondition(event.target.value as ConditionGrade)}
                >
                  {CONDITION_GRADES.map((entry) => (
                    <option key={entry} value={entry}>
                      {CONDITION_LABELS[entry]}
                    </option>
                  ))}
                </Select>
                <ProvenanceBadge provenance={provenanceFor('condition')} />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subtype" htmlFor="subtype" hint="e.g. “corrugated”, “birch ply”.">
              <div className="space-y-2">
                <Input
                  id="subtype"
                  value={subtype}
                  onChange={(event) => setSubtype(event.target.value)}
                />
                <ProvenanceBadge provenance={provenanceFor('subtype')} />
              </div>
            </Field>

            <Field label="Shape" htmlFor="shape">
              <div className="space-y-2">
                <Input id="shape" value={shape} onChange={(event) => setShape(event.target.value)} />
                <ProvenanceBadge provenance={provenanceFor('shape')} />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Colour" htmlFor="color">
              <div className="space-y-2">
                <Input id="color" value={color} onChange={(event) => setColor(event.target.value)} />
                <ProvenanceBadge provenance={provenanceFor('color')} />
              </div>
            </Field>

            <Field label="Texture" htmlFor="texture">
              <div className="space-y-2">
                <Input
                  id="texture"
                  value={texture}
                  onChange={(event) => setTexture(event.target.value)}
                />
                <ProvenanceBadge provenance={provenanceFor('texture')} />
              </div>
            </Field>
          </div>
        </fieldset>

        {/* --------------------------------------------------------- measurements */}
        <fieldset className="space-y-4 border-t border-line pt-6">
          <legend className="micro-label">Measured dimensions</legend>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              How do you know these numbers? Marking them as estimated keeps them honestly
              distinguishable from a tape measure.
            </p>
            <SegmentedControl
              name="dimensionSource"
              label="How the dimensions were obtained"
              value={dimensionSource}
              onChange={setDimensionSource}
              size="sm"
              options={[
                { value: 'measured', label: 'I measured it' },
                { value: 'user', label: 'Estimated' },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Length" htmlFor="lengthMm" required>
              <div className="space-y-2">
                <MeasurementInput
                  id="lengthMm"
                  value={lengthMm}
                  onChange={(event) => setLengthMm(event.target.value)}
                />
                <ProvenanceBadge provenance={provenanceFor('lengthMm')} />
              </div>
            </Field>

            <Field label="Width" htmlFor="widthMm" required>
              <div className="space-y-2">
                <MeasurementInput
                  id="widthMm"
                  value={widthMm}
                  onChange={(event) => setWidthMm(event.target.value)}
                />
                <ProvenanceBadge provenance={provenanceFor('widthMm')} />
              </div>
            </Field>

            <Field label="Thickness" htmlFor="thicknessMm" hint="Needed for anything structural.">
              <div className="space-y-2">
                <MeasurementInput
                  id="thicknessMm"
                  value={thicknessMm}
                  onChange={(event) => setThicknessMm(event.target.value)}
                />
                <ProvenanceBadge provenance={provenanceFor('thicknessMm')} />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantity available" htmlFor="quantityValue" required>
              <div className="space-y-2">
                <Input
                  id="quantityValue"
                  type="number"
                  min={0}
                  step="any"
                  value={quantityValue}
                  onChange={(event) => setQuantityValue(event.target.value)}
                />
                <ProvenanceBadge provenance={provenanceFor('quantity')} />
              </div>
            </Field>

            <Field label="Counted in" htmlFor="quantityUnit" required>
              <Select
                id="quantityUnit"
                value={quantityUnit}
                onChange={(event) => setQuantityUnit(event.target.value as QuantityUnit)}
              >
                {QUANTITY_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {QUANTITY_UNIT_LABELS[unit]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        {/* ------------------------------------------------------------ condition */}
        <fieldset className="space-y-4 border-t border-line pt-6">
          <legend className="micro-label">Condition and restrictions</legend>

          <Field
            label="Contamination"
            htmlFor="contamination"
            hint="Comma separated. Oil, paint residue, mould and the like will block reuse outright."
          >
            <div className="space-y-2">
              <Input
                id="contamination"
                value={contamination}
                onChange={(event) => setContamination(event.target.value)}
              />
              <ProvenanceBadge provenance={provenanceFor('contamination')} />
            </div>
          </Field>

          <Field label="Defects" htmlFor="defects" hint="Comma separated visible damage.">
            <div className="space-y-2">
              <Input
                id="defects"
                value={defects}
                onChange={(event) => setDefects(event.target.value)}
              />
              <ProvenanceBadge provenance={provenanceFor('defects')} />
            </div>
          </Field>

          <Field label="Origin" htmlFor="origin">
            <Input id="origin" value={origin} onChange={(event) => setOrigin(event.target.value)} />
          </Field>

          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </fieldset>
      </CardBody>

      <CardFooter>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            loading={busy === 'save'}
            disabled={busy !== null}
            iconLeft={<Save className="size-4" aria-hidden />}
            onClick={() => void save()}
          >
            Save changes
          </Button>

          {verified ? (
            <Link href={`/discover?materialId=${material.id}`}>
              <Button
                variant="accent"
                disabled={busy !== null}
                iconLeft={<Sparkle className="size-4" aria-hidden />}
              >
                Find product opportunities
              </Button>
            </Link>
          ) : (
            <Button
              loading={busy === 'confirm'}
              disabled={busy !== null}
              iconLeft={<CheckCircle2 className="size-4" aria-hidden />}
              onClick={() => void confirm()}
            >
              Confirm and verify
            </Button>
          )}
        </div>

        <p className="text-xs text-ink-faint">
          {verified
            ? 'Editing a confirmed material returns it to needs-confirmation.'
            : 'Confirmation unlocks feasibility, costing and buyer matching.'}
        </p>
      </CardFooter>
    </Card>
  );
}
