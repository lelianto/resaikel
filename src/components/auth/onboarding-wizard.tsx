'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { USER_ROLES, USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS } from '@/domain/identity/types';
import type { UserRole } from '@/domain/identity/types';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Onboarding.
 *
 * Three questions, all skippable except at least one role. The roles decide which
 * parts of the product are emphasised, not which application you get: resaikel is
 * one product, and one account may hold several roles.
 */

const CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'EUR', 'GBP', 'AUD', 'INR'] as const;

const COUNTRIES = [
  { code: 'ID', label: 'Indonesia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'AU', label: 'Australia' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'IN', label: 'India' },
] as const;

export function OnboardingWizard({
  defaultName,
  defaultOrgName,
  defaultCurrency,
  defaultCountry,
  defaultLocale,
}: {
  defaultName: string;
  defaultOrgName: string;
  defaultCurrency: string;
  defaultCountry: string;
  defaultLocale: string;
}) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(defaultName);
  const [orgName, setOrgName] = useState(defaultOrgName);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [country, setCountry] = useState(defaultCountry);
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [orgError, setOrgError] = useState<string | null>(null);

  function toggleRole(role: UserRole): void {
    setRoles((current) =>
      current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIssues([]);
    setOrgError(null);

    if (orgName.trim().length < 2) {
      setOrgError('Give your organisation or workshop a name of at least two characters.');
      return;
    }
    if (roles.length === 0) {
      setError('Pick at least one option so we know what to put in front of you first.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/api/onboarding', {
        method: 'POST',
        body: {
          displayName: displayName.trim().length > 0 ? displayName.trim() : null,
          roles,
          orgName: orgName.trim(),
          country,
          city: city.trim().length > 0 ? city.trim() : null,
          currency,
          locale: defaultLocale,
        },
      });
      router.replace('/overview');
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues(caught.issues);
      } else {
        setError('We could not save that. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-8" noValidate>
      {error ? (
        <Alert tone="danger" title="Could not finish setup">
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

      <fieldset className="space-y-3">
        <legend className="micro-label">01 — What describes you?</legend>
        <p className="text-sm leading-relaxed text-ink-muted">
          Select everything that applies. You can change this later.
        </p>
        <div className="space-y-1">
          {USER_ROLES.map((role) => (
            <Checkbox
              key={role}
              checked={roles.includes(role)}
              onChange={() => toggleRole(role)}
              label={USER_ROLE_LABELS[role]}
              description={USER_ROLE_DESCRIPTIONS[role]}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="micro-label">02 — Your organisation</legend>
        <Field
          label="Organisation or workshop name"
          htmlFor="orgName"
          required
          hint="Used on listings and quotations. A personal name is fine if you work alone."
          {...(orgError ? { error: orgError } : {})}
        >
          <Input
            id="orgName"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            placeholder="Pilot Workshop Jakarta"
            invalid={Boolean(orgError)}
          />
        </Field>

        <Field label="Your name" htmlFor="displayName" hint="Shown to people you work with.">
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="country" required>
            <Select
              id="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {COUNTRIES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="City" htmlFor="city" hint="Optional. Used for local buyer matching.">
            <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="micro-label">03 — Money and market</legend>
        <p className="text-sm leading-relaxed text-ink-muted">
          Every price, cost and margin in resaikel is expressed in this currency. Nothing is
          converted between currencies, so choose the one you actually trade in.
        </p>
        <Field label="Currency" htmlFor="currency" required>
          <Select
            id="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Button type="submit" loading={busy} size="lg">
          Enter resaikel
        </Button>
        <p className="text-xs text-ink-faint">Takes one step. Nothing else is required.</p>
      </div>
    </form>
  );
}
