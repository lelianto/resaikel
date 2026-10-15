import { nowIso } from '@/domain/common';
import type { AuthContext } from '@/domain/identity/types';
import { assessMarket } from '@/domain/market/aggregate';
import type { CostEstimate } from '@/domain/cost/types';
import { applyAssumptionOverrides, computeCost } from '@/domain/cost/engine';
import type { OpportunityDocument } from '@/domain/opportunity/types';
import { getTemplate } from '@/domain/catalog';
import { rankOpportunities, type OpportunitySignals } from '@/domain/ranking/rank';

import { HttpError } from '../http/errors';
import { listMarketEvidence } from '../repos/evidence';
import {
  getCostEstimate,
  getOpportunityDocument,
  listOpportunityDocuments,
  saveCostEstimate,
  updateOpportunityDocument,
} from '../repos/opportunities';

/**
 * Re-derivation of cost and ranking.
 *
 * A user editing an assumption must not leave a stale score next to a fresh price.
 * Both are recomputed together, and the ranking is recalculated across *all* of
 * the material's opportunities because economic value is normalised against the
 * best candidate in the set - re-ranking a single item in isolation would
 * silently score it as the best possible.
 */

export function signalsFromOpportunity(opportunity: OpportunityDocument): OpportunitySignals {
  const template = opportunity.templateId ? getTemplate(opportunity.templateId) : null;

  return {
    id: opportunity.id,
    label: opportunity.productName,
    feasibilityStatus: opportunity.feasibilityStatus,
    contributionPerUnitMinor: opportunity.summary.contributionPerUnitMinor,
    unitCostMinor: opportunity.summary.unitCostMinor,
    referencePriceMinor: opportunity.summary.referencePriceMinor,
    materialUtilisationPercent:
      opportunity.summary.wastePercent === null ? null : 100 - opportunity.summary.wastePercent,
    buyerScore: opportunity.summary.bestBuyerScore,
    evidenceQuality: opportunity.summary.evidenceQuality,
    complexity: template?.complexity ?? null,
    maxUnits: opportunity.summary.maxUnits,
  };
}

export async function rerankMaterialOpportunities(
  orgId: string,
  materialId: string,
): Promise<readonly OpportunityDocument[]> {
  const { items } = await listOpportunityDocuments(orgId, { materialId, limit: 60 });
  if (items.length === 0) return [];

  const ranked = rankOpportunities(items.map(signalsFromOpportunity));
  const rankedById = new Map(ranked.map((entry) => [entry.id, entry]));

  const updated: OpportunityDocument[] = [];

  for (const item of items) {
    const rank = rankedById.get(item.id);
    if (!rank) continue;

    const next = await updateOpportunityDocument(orgId, item.id, {
      ranking: {
        rank: rank.rank,
        score: rank.score,
        gatesPassed: rank.gatesPassed,
        gateReasons: rank.gateReasons,
        unknownDimensions: rank.unknownDimensions,
        dimensions: rank.dimensions.map((dimension) => ({
          id: dimension.id,
          label: dimension.label,
          value: dimension.value,
          weight: dimension.weight,
          explanation: dimension.explanation,
        })),
        summary: rank.summary,
      },
    });

    if (next) updated.push(next);
  }

  return updated;
}

export interface RecomputeCostInput {
  readonly auth: AuthContext;
  readonly opportunityId: string;
  readonly overrides: Readonly<Record<string, number>>;
}

export interface RecomputeCostResult {
  readonly cost: CostEstimate;
  readonly opportunity: OpportunityDocument;
  readonly issues: readonly string[];
}

export async function recomputeCostEstimate(
  input: RecomputeCostInput,
): Promise<RecomputeCostResult> {
  const opportunity = await getOpportunityDocument(input.auth.orgId, input.opportunityId);
  if (!opportunity) {
    throw new HttpError('OPPORTUNITY_NOT_FOUND', 'That opportunity does not exist.');
  }

  const existing = await getCostEstimate(input.auth.orgId, input.opportunityId);
  if (!existing) {
    throw new HttpError(
      'CONFLICT',
      'This opportunity has no cost estimate yet. Run discovery again to create one.',
    );
  }

  const { assumptions, issues } = applyAssumptionOverrides(existing.assumptions, input.overrides);

  // Evidence is re-read rather than trusted from the stored estimate, so a
  // corrected reference set is picked up immediately.
  const rows = await listMarketEvidence(opportunity.category);
  const market = assessMarket(rows, {
    category: opportunity.category,
    currency: input.auth.currency,
    region: input.auth.country,
  });

  const recomputed = computeCost({ assumptions, priceBands: market.bands });
  const referenceScenario =
    recomputed.scenarios.find((scenario) => scenario.id === 'reference') ?? null;

  await saveCostEstimate({
    ...recomputed,
    id: opportunity.id,
    orgId: input.auth.orgId,
    opportunityId: opportunity.id,
    schemaVersion: existing.schemaVersion,
    createdBy: existing.createdBy,
    updatedAt: nowIso(),
  });

  const updated = await updateOpportunityDocument(input.auth.orgId, opportunity.id, {
    summary: {
      ...opportunity.summary,
      unitCostMinor: recomputed.unitCostMinor,
      minViablePriceMinor: recomputed.minViablePricePerUnitMinor,
      referencePriceMinor: market.bands?.referenceMinor ?? null,
      contributionPerUnitMinor: referenceScenario?.contributionPerUnitMinor ?? null,
      contributionMarginBps: referenceScenario?.contributionMarginBps ?? null,
      evidenceQuality: market.quality,
    },
  });

  if (!updated) {
    throw new HttpError('OPPORTUNITY_NOT_FOUND', 'That opportunity does not exist.');
  }

  await rerankMaterialOpportunities(input.auth.orgId, opportunity.materialId);

  const refreshed =
    (await getOpportunityDocument(input.auth.orgId, opportunity.id)) ?? updated;

  return { cost: recomputed, opportunity: refreshed, issues };
}

export async function setOpportunitySaved(
  auth: AuthContext,
  opportunityId: string,
  saved: boolean,
): Promise<OpportunityDocument> {
  const updated = await updateOpportunityDocument(auth.orgId, opportunityId, {
    saved,
    savedAt: saved ? nowIso() : null,
  });

  if (!updated) {
    throw new HttpError('OPPORTUNITY_NOT_FOUND', 'That opportunity does not exist.');
  }
  return updated;
}
