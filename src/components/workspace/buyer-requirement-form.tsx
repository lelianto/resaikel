'use client';

import { ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from '@/domain/catalog/types';
import type { ProductCategory } from '@/domain/catalog/types';
import { MATERIAL_FAMILIES, MATERIAL_FAMILY_LABELS } from '@/domain/materials/types';
import type { MaterialFamily } from '@/domain/materials/types';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Registered demand.
 *
 * Consent is a required, unchecked-by-default checkbox rather than an implicit
 * consequence of registering: without it the record is stored as the
 * organisation's own note and is never loaded by the matching query.
 */
export function BuyerRequirementForm({
  currencies,
  defaultCurrency,
  defaultCountry,
}: {
  currencies: readonly string[];
  defaultCurrency: string;
  defaultCountry: string;
}) {
  const router = useRouter();

  const [buyerKind, setBuyerKind] = useState<'b2b' | 'b2c'>('b2b');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState(defaultCountry);
  const [categories, setCategories] = useState<ProductCategory[]>(['packaging']);
  const [families, setFamilies] = useState<MaterialFamily[]>(['cardboard']);
  const [minOrderQuantity, setMinOrderQuantity] = useState('500');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [capacityNote, setCapacityNote] = useState('');
  const [consent, setConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  function toggle<T extends string>(
    list: readonly T[],
    value: T,
    set: (next: T[]) => void,
  ): void {
    set(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIssues([]);

    if (categories.length === 0) {
      setError('Choose at least one product category you are buying.');
      return;
    }

    setBusy(true);
    try {
      const result = await apiRequest<{ labelling: string }>('/api/buyer-requirements', {
        method: 'POST',
        body: {
          buyerKind,
          businessName: businessName.trim().length > 0 ? businessName.trim() : null,
          industry: industry.trim().length > 0 ? industry.trim() : null,
          location: location.trim().length > 0 ? location.trim() : null,
          country: country.trim().length === 2 ? country.trim() : null,
          productCategories: categories,
          materialFamilies: families,
          ...(minOrderQuantity.trim().length > 0
            ? { minOrderQuantity: Math.round(Number(minOrderQuantity)) }
            : {}),
          ...(budgetMin.trim().length > 0 ? { budgetMinMinor: Math.round(Number(budgetMin)) } : {}),
          ...(budgetMax.trim().length > 0 ? { budgetMaxMinor: Math.round(Number(budgetMax)) } : {}),
          currency,
          capacityNote: capacityNote.trim().length > 0 ? capacityNote.trim() : null,
          consentToMatch: consent,
        },
      });

      setNotice(result.labelling);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues(caught.issues);
      } else {
        setError('That requirement could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Demand"
        title="Register what you need to buy"
        description="Registered demand is what turns a plausible buyer category into something a supplier can actually respond to. Submitting this is an expression of interest — it is not an order and no transaction is created."
      />

      <CardBody>
        <form id="buyer-requirement-form" onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
          {error ? (
            <Alert tone="danger" title="Could not save">
              {error}
              {issues.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer type" htmlFor="buyerKind" required>
              <Select
                id="buyerKind"
                value={buyerKind}
                onChange={(event) => setBuyerKind(event.target.value as 'b2b' | 'b2c')}
              >
                <option value="b2b">Business</option>
                <option value="b2c">Consumer</option>
              </Select>
            </Field>

            <Field label="Business or brand name" htmlFor="businessName">
              <Input
                id="businessName"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Sample Devices Refurb"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Industry" htmlFor="industry">
              <Input
                id="industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="Electronics refurbishment"
              />
            </Field>
            <Field label="City" htmlFor="location">
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>
            <Field label="Country code" htmlFor="buyerCountry" hint="Two letters, e.g. ID.">
              <Input
                id="buyerCountry"
                value={country}
                maxLength={2}
                onChange={(event) => setCountry(event.target.value.toUpperCase())}
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="micro-label">Product categories you buy</legend>
            <div className="grid gap-0.5 sm:grid-cols-2">
              {PRODUCT_CATEGORIES.map((category) => (
                <Checkbox
                  key={category}
                  checked={categories.includes(category)}
                  onChange={() => toggle(categories, category, setCategories)}
                  label={PRODUCT_CATEGORY_LABELS[category]}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="micro-label">Reclaimed materials you accept</legend>
            <div className="grid gap-0.5 sm:grid-cols-2">
              {MATERIAL_FAMILIES.map((family) => (
                <Checkbox
                  key={family}
                  checked={families.includes(family)}
                  onChange={() => toggle(families, family, setFamilies)}
                  label={MATERIAL_FAMILY_LABELS[family]}
                />
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum order quantity" htmlFor="minOrderQuantity" hint="Units you need.">
              <Input
                id="minOrderQuantity"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={minOrderQuantity}
                onChange={(event) => setMinOrderQuantity(event.target.value)}
                className="tnum text-right"
              />
            </Field>

            <Field label="Currency" htmlFor="buyerCurrency" required>
              <Select
                id="buyerCurrency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Budget minimum per unit"
              htmlFor="budgetMin"
              hint={`In ${currency} ${defaultCurrency === currency ? '(the currency you trade in)' : ''}, minor units.`}
            >
              <Input
                id="budgetMin"
                type="number"
                min={0}
                step={100}
                value={budgetMin}
                onChange={(event) => setBudgetMin(event.target.value)}
                className="tnum text-right"
              />
            </Field>
            <Field label="Budget maximum per unit" htmlFor="budgetMax" hint="Minor units.">
              <Input
                id="budgetMax"
                type="number"
                min={0}
                step={100}
                value={budgetMax}
                onChange={(event) => setBudgetMax(event.target.value)}
                className="tnum text-right"
              />
            </Field>
          </div>

          <Field label="Capacity or delivery notes" htmlFor="capacityNote">
            <Textarea
              id="capacityNote"
              value={capacityNote}
              onChange={(event) => setCapacityNote(event.target.value)}
              placeholder="Needed within six weeks, delivered to a Jakarta warehouse."
            />
          </Field>

          <div className="rounded-md border border-line bg-surface-sunken p-4">
            <Checkbox
              checked={consent}
              onChange={() => setConsent((value) => !value)}
              label="Share this requirement with matched suppliers"
              description="Required for matching. Without it, this is stored as your own note and is never shown to a supplier."
            />
            {!consent ? (
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Without consent this record is labelled as your own requirement rather than a
                verified platform request.
              </p>
            ) : null}
          </div>
        </form>
      </CardBody>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-sunken px-5 py-3">
        <Button
          type="submit"
          form="buyer-requirement-form"
          loading={busy}
          iconLeft={<ClipboardList className="size-4" aria-hidden />}
        >
          Register requirement
        </Button>
        <p className="text-xs text-ink-faint">
          No payment is taken. resaikel does not process transactions.
        </p>
      </div>
    </Card>
  );
}
