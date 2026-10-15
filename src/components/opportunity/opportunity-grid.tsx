'use client';

import { Bookmark, BookmarkCheck, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EvidenceQualityBadge, FeasibilityBadge } from '@/components/material/status-badge';
import { ProductSilhouette } from '@/components/signature/product-silhouette';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { SegmentedControl } from '@/components/ui/segmented';
import type { OpportunityDocument } from '@/domain/opportunity/types';
import {
  SORT_MODES,
  SORT_MODE_DIMENSION,
  SORT_MODE_LABELS,
  type RankingDimensionId,
  type SortMode,
} from '@/domain/ranking/rank';
import { formatMoney } from '@/domain/money';
import { ApiError, apiRequest } from '@/lib/api-client';

/**
 * Opportunity comparison.
 *
 * Sorting is offered along the same dimensions the ranking engine scored, so the
 * order on screen can always be traced back to an explanation. A candidate that
 * failed a hard gate is never ranked above a viable one, whatever the sort.
 */

function dimensionValue(
  opportunity: OpportunityDocument,
  dimensionId: RankingDimensionId,
): number | null {
  return (
    opportunity.ranking?.dimensions.find((dimension) => dimension.id === dimensionId)?.value ?? null
  );
}

function sortItems(items: readonly OpportunityDocument[], mode: SortMode): OpportunityDocument[] {
  if (mode === 'overall') {
    return [...items].sort((a, b) => {
      const gated = (a.ranking?.gatesPassed ?? false) === (b.ranking?.gatesPassed ?? false);
      if (!gated) return a.ranking?.gatesPassed ? -1 : 1;
      return (a.ranking?.rank ?? 999) - (b.ranking?.rank ?? 999);
    });
  }

  const dimensionId = SORT_MODE_DIMENSION[mode];

  return [...items].sort((a, b) => {
    const passedA = a.ranking?.gatesPassed ?? false;
    const passedB = b.ranking?.gatesPassed ?? false;
    if (passedA !== passedB) return passedA ? -1 : 1;

    const valueA = dimensionValue(a, dimensionId);
    const valueB = dimensionValue(b, dimensionId);
    if (valueA === null && valueB === null) return a.productName.localeCompare(b.productName);
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    return valueB - valueA;
  });
}

function Money({ amountMinor, currency }: { amountMinor: number | null; currency: string }) {
  if (amountMinor === null) {
    return <span className="text-ink-faint">—</span>;
  }
  return (
    <span className="tnum font-mono text-[0.8125rem]">
      {formatMoney({ amount: amountMinor, currency })}
    </span>
  );
}

export function OpportunityGrid({
  items,
  locale,
}: {
  items: readonly OpportunityDocument[];
  locale: string;
}) {
  const [mode, setMode] = useState<SortMode>('overall');
  const [saved, setSaved] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.saved])),
  );
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => sortItems(items, mode), [items, mode]);

  async function toggleSaved(id: string): Promise<void> {
    const next = !saved[id];
    setSaved((current) => ({ ...current, [id]: next }));
    setError(null);
    try {
      await apiRequest(`/api/opportunities/${id}/save`, {
        method: 'POST',
        body: { saved: next },
      });
    } catch (caught) {
      setSaved((current) => ({ ...current, [id]: !next }));
      setError(
        caught instanceof ApiError ? caught.message : 'That save could not be recorded.',
      );
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No opportunities yet"
        description="Run discovery on a confirmed material and the evaluated candidates will appear here, ranked, with the rejected ones listed after them and the reason they failed."
        action={
          <Link
            href="/discover"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-ink-inverse transition-colors hover:bg-primary-hover"
          >
            Run discovery
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-ink-faint" aria-hidden />
          <SegmentedControl
            name="sort"
            label="Sort opportunities"
            value={mode}
            onChange={setMode}
            size="sm"
            options={SORT_MODES.map((entry) => ({
              value: entry,
              label: SORT_MODE_LABELS[entry],
            }))}
          />
        </div>
        <p className="text-xs text-ink-muted">
          {ordered.filter((item) => item.ranking?.gatesPassed).length} viable ·{' '}
          {ordered.filter((item) => !item.ranking?.gatesPassed).length} not viable
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(30rem, 100%), 1fr))' }}>
        {ordered.map((opportunity) => {
          const gatesPassed = opportunity.ranking?.gatesPassed ?? false;
          const marginBps = opportunity.summary.contributionMarginBps;
          const isSaved = saved[opportunity.id] ?? false;

          return (
            <li key={opportunity.id} className="panel flex flex-col">
              <div className="flex gap-4 border-b border-line p-4">
                <div className="w-28 shrink-0 overflow-hidden rounded-md border border-line">
                  <ProductSilhouette category={opportunity.category} />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FeasibilityBadge status={opportunity.feasibilityStatus} />
                    {opportunity.validationLevel === 'concept' ? (
                      <Badge tone="warning">Concept only</Badge>
                    ) : null}
                    {opportunity.isSampleData ? (
                      <Badge tone="accent" technical>
                        Sample
                      </Badge>
                    ) : null}
                  </div>

                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="block text-[0.9375rem] font-medium leading-snug text-ink underline-offset-2 hover:underline"
                  >
                    {opportunity.productName}
                  </Link>

                  {opportunity.ranking ? (
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {opportunity.ranking.summary}
                    </p>
                  ) : null}
                </div>

                <IconButton
                  label={isSaved ? 'Remove from workspace' : 'Save to workspace'}
                  size="sm"
                  onClick={() => void toggleSaved(opportunity.id)}
                >
                  {isSaved ? (
                    <BookmarkCheck className="size-4 text-primary" aria-hidden />
                  ) : (
                    <Bookmark className="size-4" aria-hidden />
                  )}
                </IconButton>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-4">
                <div>
                  <dt className="micro-label">Producible</dt>
                  <dd className="tnum font-mono text-[0.8125rem] text-ink">
                    {opportunity.summary.maxUnits > 0
                      ? `${opportunity.summary.maxUnits} units`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="micro-label">Unit cost</dt>
                  <dd>
                    <Money
                      amountMinor={opportunity.summary.unitCostMinor}
                      currency={opportunity.summary.currency}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="micro-label">Price range</dt>
                  <dd>
                    <Money
                      amountMinor={opportunity.summary.referencePriceMinor}
                      currency={opportunity.summary.currency}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="micro-label">Margin</dt>
                  <dd className="tnum font-mono text-[0.8125rem] text-ink">
                    {marginBps === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      `${(marginBps / 100).toFixed(1)}%`
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3">
                <EvidenceQualityBadge quality={opportunity.summary.evidenceQuality} />
                {opportunity.summary.bestBuyerScore !== null ? (
                  <Badge tone="neutral">
                    Buyer match {opportunity.summary.bestBuyerScore}/100
                  </Badge>
                ) : (
                  <Badge tone="neutral">Buyer match not scored</Badge>
                )}
                {opportunity.summary.shortfallDetected ? (
                  <Badge tone="danger">Quantity shortfall</Badge>
                ) : null}
                {opportunity.summary.wastePercent !== null ? (
                  <Badge tone="neutral" technical>
                    {opportunity.summary.wastePercent}% waste
                  </Badge>
                ) : null}
              </div>

              {!gatesPassed && opportunity.ranking?.gateReasons.length ? (
                <p className="border-t border-line bg-danger-soft px-4 py-2.5 text-xs leading-relaxed text-danger">
                  {opportunity.ranking.gateReasons.join(' ')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-ink-faint">
        Prices come from a curated sample reference set unless a verified transaction is recorded.
        Listing prices are asking prices, not evidence of demand, and a “—” means the value is
        genuinely unknown rather than zero. All monetary figures are shown in {locale}.
      </p>
    </div>
  );
}
