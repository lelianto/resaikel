import { Bookmark, ClipboardList, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EvidenceQualityBadge, FeasibilityBadge } from '@/components/material/status-badge';
import { BuyerRequirementForm } from '@/components/workspace/buyer-requirement-form';
import { CapabilityForm } from '@/components/workspace/capability-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import { formatMoney } from '@/domain/money';
import { requireCurrentAuth } from '@/server/auth/current';
import { CONTACTS } from '@/lib/countries';
import { getWorkshopCapability, getWorkshopForOrg } from '@/server/repos/identity';
import { listOrgBuyerRequirements } from '@/server/repos/evidence';
import { listOpportunityDocuments } from '@/server/repos/opportunities';
import { serverConfig } from '@/lib/config';

export const metadata: Metadata = { title: 'Workspace' };

export default async function WorkspacePage() {
  const auth = await requireCurrentAuth();

  const [workshop, capability, saved, requirements] = await Promise.all([
    getWorkshopForOrg(auth.orgId),
    getWorkshopCapability(auth.orgId),
    listOpportunityDocuments(auth.orgId, { savedOnly: true, limit: 12 }),
    listOrgBuyerRequirements(auth.orgId),
  ]);

  return (
    <Container width="wide" className="space-y-8 py-8">
      <PageHeader
        eyebrow="Workspace"
        title="Your capabilities and demand"
        description="What you can make, and what you need made. Both feed the same matching engine, from opposite ends."
        actions={
          <Link
            href="/workspace/settings"
            className="text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
          >
            Organisation settings
          </Link>
        }
      />

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Bookmark className="size-4 text-ink-faint" aria-hidden />
          Saved opportunities
        </h2>

        {saved.items.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="size-5" aria-hidden />}
            title="Nothing saved yet"
            description="Save an opportunity from the comparison screen and it will appear here with its numbers, so you can come back to it after checking a price or a buyer."
            action={
              <Link href="/opportunities">
                <Button variant="outline">Browse opportunities</Button>
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(22rem, 100%), 1fr))' }}>
            {saved.items.map((opportunity) => (
              <li key={opportunity.id} className="panel space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="text-[0.9375rem] font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {opportunity.productName}
                  </Link>
                  <FeasibilityBadge status={opportunity.feasibilityStatus} />
                </div>

                <p className="text-xs text-ink-muted">
                  From {opportunity.materialSnapshot.title}
                </p>

                <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3">
                  <div>
                    <dt className="micro-label">Units</dt>
                    <dd className="tnum font-mono text-[0.8125rem]">
                      {opportunity.summary.maxUnits > 0 ? opportunity.summary.maxUnits : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="micro-label">Unit cost</dt>
                    <dd className="tnum font-mono text-[0.8125rem]">
                      {opportunity.summary.unitCostMinor === null
                        ? '—'
                        : formatMoney(
                            {
                              amount: opportunity.summary.unitCostMinor,
                              currency: opportunity.summary.currency,
                            },
                            auth.locale,
                            { compact: true },
                          )}
                    </dd>
                  </div>
                  <div>
                    <dt className="micro-label">Margin</dt>
                    <dd className="tnum font-mono text-[0.8125rem]">
                      {opportunity.summary.contributionMarginBps === null
                        ? '—'
                        : `${(opportunity.summary.contributionMarginBps / 100).toFixed(1)}%`}
                    </dd>
                  </div>
                </dl>

                <EvidenceQualityBadge quality={opportunity.summary.evidenceQuality} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Wrench className="size-4 text-ink-faint" aria-hidden />
          Production capabilities
        </h2>

        <CapabilityForm
          initial={
            workshop
              ? {
                  name: workshop.name,
                  city: workshop.city,
                  country: workshop.country,
                  capacityNote: workshop.capacityNote,
                  tools: capability?.tools ?? [],
                  processes: capability?.processes ?? [],
                  supportedFamilies: capability?.supportedFamilies ?? [],
                  labourRatePerHourMinor: capability?.defaultLabourRatePerHourMinor ?? null,
                }
              : null
          }
          countries={CONTACTS}
          currency={auth.currency}
        />

        {!capability ? (
          <p className="text-xs leading-relaxed text-ink-muted">
            Until a capability profile exists, feasibility results stop at “geometrically feasible”:
            resaikel knows the panels fit, but not that you have the tools to cut them.
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <ClipboardList className="size-4 text-ink-faint" aria-hidden />
          Your registered requirements
        </h2>

        <BuyerRequirementForm
          currencies={CURRENCIES}
          defaultCurrency={auth.currency || serverConfig.defaults.currency}
          defaultCountry={auth.country}
        />

        {requirements.length > 0 ? (
          <Card>
            <CardHeader
              eyebrow="Recorded"
              title="Requirements you have registered"
              description="Only the ones where you consented to be matched are visible to suppliers."
            />
            <CardBody>
              <ul className="divide-y divide-line">
                {requirements.map((requirement) => (
                  <li key={requirement.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {requirement.businessName ?? 'Unnamed requirement'}
                      </span>
                      <Badge tone={requirement.consentToMatch ? 'success' : 'neutral'} technical>
                        {requirement.consentToMatch ? 'shared for matching' : 'private'}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {requirement.productCategories.join(', ')}
                      {requirement.minOrderQuantity !== null
                        ? ` · minimum ${requirement.minOrderQuantity} units`
                        : ''}
                      {requirement.materialFamilies.length > 0
                        ? ` · ${requirement.materialFamilies.join(', ')}`
                        : ''}
                    </p>
                    <p className="micro-label">
                      Created {new Date(requirement.createdAt).toLocaleDateString(auth.locale)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </section>
    </Container>
  );
}

const CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'EUR', 'GBP', 'AUD', 'INR'] as const;
