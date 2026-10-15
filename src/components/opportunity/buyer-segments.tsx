import { Store, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { BuyerMatch, MatchFactorStatus } from '@/domain/buyers/matching';
import { DEMAND_KIND_LABELS } from '@/domain/buyers/matching';

/**
 * Buyer intelligence.
 *
 * Two clearly separated kinds of output. A *potential segment* is a hypothesis
 * about a category of buyer and is labelled as such, with the factors that fed the
 * score shown. A *verified platform request* is registered, consented demand — and
 * even that is described as an expression of interest rather than a purchase.
 * No company is ever named unless the buyer registered it themselves.
 */

const STATUS_TONE: Record<MatchFactorStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  match: 'success',
  partial: 'warning',
  mismatch: 'danger',
  unknown: 'neutral',
};

function FactorRow({ match }: { match: BuyerMatch }) {
  return (
    <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
      {match.factors.map((factor) => (
        <div key={factor.id} className="flex flex-wrap items-baseline gap-2">
          <dt className="w-36 shrink-0">
            <Badge tone={STATUS_TONE[factor.status]} technical>
              {factor.label}
            </Badge>
          </dt>
          <dd className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
            {factor.explanation}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MatchCard({ match }: { match: BuyerMatch }) {
  const isVerified = match.kind === 'verified_request';

  return (
    <li className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm bg-surface-subtle text-ink-muted">
            {isVerified ? (
              <Store className="size-3.5" aria-hidden />
            ) : (
              <Users className="size-3.5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{match.label}</p>
            <p className="micro-label mt-0.5">{DEMAND_KIND_LABELS[match.kind]}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="micro-label">Match</p>
          <p className="tnum font-mono text-sm text-ink">
            {match.score === null ? '—' : `${match.score}/100`}
          </p>
        </div>
      </div>

      {match.shortfall ? (
        <p className="mt-3 rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
          Wants {match.shortfall.requested} units; only {match.shortfall.availableCapacity} can be
          produced from this material. Short by {match.shortfall.shortfall} units.
        </p>
      ) : null}

      <FactorRow match={match} />

      {match.unknownFactors.length > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Excluded from the score because nothing is known about them:{' '}
          {match.unknownFactors.join(', ')}. They are reported rather than assumed.
        </p>
      ) : null}

      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
        {match.caveats.map((caveat) => (
          <li key={caveat}>{caveat}</li>
        ))}
      </ul>
    </li>
  );
}

export function BuyerSegments({
  matches,
  note,
}: {
  matches: readonly BuyerMatch[];
  note?: string | null;
}) {
  const verified = matches.filter((match) => match.kind === 'verified_request');
  const potential = matches.filter((match) => match.kind === 'potential_segment');

  return (
    <Card>
      <CardHeader
        eyebrow="Buyer intelligence"
        title="Who might buy this"
        description="Segments are categories of buyer, not companies. resaikel never names a brand as a purchaser, and only shows registered demand that its owner consented to share."
      />

      <CardBody className="space-y-6">
        {note ? <p className="text-sm leading-relaxed text-ink-muted">{note}</p> : null}

        <section className="space-y-3">
          <h3 className="micro-label">{DEMAND_KIND_LABELS.verified_request}</h3>
          {verified.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-muted">
              No registered buyer has opted in to matching for this product category. Nothing is shown
              here rather than inventing an interested brand.
            </p>
          ) : (
            <ul className="space-y-3">
              {verified.map((match) => (
                <MatchCard key={`${match.kind}-${match.requirementId ?? match.label}`} match={match} />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t border-line pt-5">
          <h3 className="micro-label">{DEMAND_KIND_LABELS.potential_segment}</h3>
          {potential.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-muted">
              No segment is plausible for this product as specified.
            </p>
          ) : (
            <ul className="space-y-3">
              {potential.map((match) => (
                <MatchCard key={`${match.kind}-${match.segmentId ?? match.label}`} match={match} />
              ))}
            </ul>
          )}
        </section>
      </CardBody>
    </Card>
  );
}
