import { HttpError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk } from '@/server/http/response';
import {
  getCostEstimate,
  getFeasibilityResult,
  getOpportunityDocument,
} from '@/server/repos/opportunities';
import { assessMarket } from '@/domain/market/aggregate';
import { listMarketEvidence } from '@/server/repos/evidence';

/**
 * GET /api/opportunities/:id
 *
 * The opportunity plus its engine outputs. Market evidence is re-aggregated on
 * read rather than stored with the opportunity, so a corrected reference row is
 * reflected immediately instead of being frozen into an old estimate.
 */
export const GET = authedRoute<{ id: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const opportunity = await getOpportunityDocument(auth.orgId, params.id);
  if (!opportunity) {
    throw new HttpError('OPPORTUNITY_NOT_FOUND', 'That opportunity does not exist.');
  }

  const [feasibility, cost, evidenceRows] = await Promise.all([
    getFeasibilityResult(auth.orgId, params.id),
    getCostEstimate(auth.orgId, params.id),
    listMarketEvidence(opportunity.category),
  ]);

  const market = assessMarket(evidenceRows, {
    category: opportunity.category,
    currency: auth.currency,
    region: auth.country,
  });

  return jsonOk(
    {
      opportunity,
      feasibility,
      cost,
      market,
      marketEvidence: market.evidence,
    },
    requestId,
  );
});
