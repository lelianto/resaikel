import { recordAuditEvent } from '@/server/repos/identity';
import { listProductionOutcomes } from '@/server/repos/outcomes';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  idempotencyKeyFrom,
} from '@/server/http/idempotency';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { productionOutcomeSchema } from '@/server/http/schemas';
import { recordProductionOutcome } from '@/server/services/outcomes';

export const GET = authedRoute<{ id: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'api');
  return jsonOk({ outcomes: await listProductionOutcomes(auth.orgId, params.id) }, requestId);
});

export const POST = authedRoute<{ id: string }>(
  async ({ auth, params, request, requestId }) => {
    await enforceRateLimit(auth, 'api');
    const body = await readJson(request, productionOutcomeSchema);
    const key = idempotencyKeyFrom(request);

    if (key) {
      const claim = await claimIdempotencyKey(auth, key, body);
      if (!claim.fresh && claim.replayedResponse) {
        return jsonOk(claim.replayedResponse, requestId, 201);
      }
    }

    const outcome = await recordProductionOutcome({
      auth,
      opportunityId: params.id,
      quantityManufactured: body.quantityManufactured,
      quantitySold: body.quantitySold,
      materialConsumedQuantity: body.materialConsumedQuantity,
      remainingMaterialQuantity: body.remainingMaterialQuantity,
      unusedWasteQuantity: body.unusedWasteQuantity,
      actualRevenueMinor: body.actualRevenueMinor,
      costLines: body.costLines,
      occurredAt: body.occurredAt,
      notes: body.notes ?? null,
    });

    const response = {
      outcome,
      notice: 'Recorded as an actual result. It is kept separate from every estimate.',
    };
    if (key) await completeIdempotencyKey(auth, key, response);

    await recordAuditEvent({
      orgId: auth.orgId,
      actorUid: auth.uid,
      action: 'production_outcome.created',
      entity: 'production_outcome',
      entityId: outcome.id,
      meta: { opportunityId: params.id, quantityManufactured: body.quantityManufactured },
    });

    return jsonOk(response, requestId, 201);
  },
);
