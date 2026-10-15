import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { costEstimateSchema } from '@/server/http/schemas';
import { recomputeCostEstimate } from '@/server/services/opportunities';
import { recordAuditEvent } from '@/server/repos/identity';

/**
 * POST /api/opportunities/:id/cost-estimate
 *
 * Recomputes the estimate with the user's own assumptions. The numbers still come
 * from the deterministic engine; the request only supplies inputs. Cost and
 * ranking are refreshed together, so a fresh price is never shown next to a stale
 * score.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const body = await readJson(request, costEstimateSchema);

  const result = await recomputeCostEstimate({
    auth,
    opportunityId: params.id,
    overrides: body.overrides,
  });

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'cost.recomputed',
    entity: 'opportunity',
    entityId: params.id,
    meta: { assumptionKeys: Object.keys(body.overrides) },
  });

  return jsonOk(
    {
      cost: result.cost,
      opportunity: result.opportunity,
      issues: result.issues,
      notice:
        result.issues.length > 0
          ? 'Some assumptions were outside the allowed range and were clamped. See the issues list.'
          : null,
    },
    requestId,
  );
});
