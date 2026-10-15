'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/form';
import { CURRENCY_CODES, CONTACTS, LOCALE_CODES } from '@/lib/countries';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Organisation settings.
 *
 * Currency is the single most consequential setting in the product: every cost,
 * price and margin is expressed in it, and resaikel never converts between
 * currencies. Changing it therefore only changes the label on future
 * calculations, not past ones.
 */
export function SettingsForm({
  initial,
  canEdit,
}: {
  initial: {
    name: string;
    country: string;
    city: string;
    currency: string;
    locale: string;
  };
  canEdit: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [country, setCountry] = useState(initial.country);
  const [city, setCity] = useState(initial.city);
  const [currency, setCurrency] = useState(initial.currency);
  const [locale, setLocale] = useState(initial.locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await apiRequest('/api/settings', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          country,
          city: city.trim().length > 0 ? city.trim() : null,
          currency,
          locale,
        },
      });
      setNotice('Saved.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Those settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Organisation"
        title="Settings"
        description="Only owners and administrators can change these."
      />

      <CardBody>
        <form id="settings-form" onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
          {error ? (
            <Alert tone="danger" title="Could not save">
              {error}
            </Alert>
          ) : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          {!canEdit ? (
            <Alert tone="info" title="Read only for your role">
              You are signed in with a role that cannot change organisation settings. Ask an owner or
              administrator.
            </Alert>
          ) : null}

          <Field label="Organisation name" htmlFor="orgName" required>
            <Input
              id="orgName"
              value={name}
              disabled={!canEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country" htmlFor="orgCountry" required>
              <Select
                id="orgCountry"
                value={country}
                disabled={!canEdit}
                onChange={(event) => setCountry(event.target.value)}
              >
                {CONTACTS.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="City" htmlFor="orgCity">
              <Input
                id="orgCity"
                value={city}
                disabled={!canEdit}
                onChange={(event) => setCity(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Currency"
              htmlFor="orgCurrency"
              required
              hint="Every price, cost and margin is expressed in this currency. Amounts are never converted."
            >
              <Select
                id="orgCurrency"
                value={currency}
                disabled={!canEdit}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Number and date format" htmlFor="orgLocale" required>
              <Select
                id="orgLocale"
                value={locale}
                disabled={!canEdit}
                onChange={(event) => setLocale(event.target.value)}
              >
                {LOCALE_CODES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </CardBody>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-sunken px-5 py-3">
        <Button
          type="submit"
          form="settings-form"
          loading={busy}
          disabled={!canEdit}
          iconLeft={<Save className="size-4" aria-hidden />}
        >
          Save settings
        </Button>
      </div>
    </Card>
  );
}
