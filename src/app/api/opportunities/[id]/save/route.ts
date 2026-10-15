import { recordAuditEvent } from '@/server/repos/identity';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { opportunitySaveSchema } from '@/server/http/schemas';
import { setOpportunitySaved } from '@/server/services/opportunities';

/**
 * POST /api/opportunities/:id/save
 *
 * Pins an opportunity to the workspace. Idempotent by construction: setting
 * `saved` to the value it already has is a no-op rather than an error.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const body = await readJson(request, opportunitySaveSchema);
  const opportunity = await setOpportunitySaved(auth, params.id, body.saved);

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: body.saved ? 'opportunity.saved' : 'opportunity.unsaved',
    entity: 'opportunity',
    entityId: params.id,
    meta: { productName: opportunity.productName },
  });

  return jsonOk({ opportunity }, requestId);
});
