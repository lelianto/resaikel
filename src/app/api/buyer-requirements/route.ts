import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { buyerRequirementSchema } from '@/server/http/schemas';
import {
  createBuyerRequirement,
  listOrgBuyerRequirements,
  listMatchableRequirements,
} from '@/server/repos/evidence';
import { recordAuditEvent } from '@/server/repos/identity';

/**
 * Registered demand.
 *
 * A record only ever counts as matchable when its owner ticked consent. Without
 * consent it is stored as the organisation's own note and is never loaded by the
 * matching query - the platform has no standing to match on it.
 */

export const GET = authedRoute(async ({ auth, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const mine = await listOrgBuyerRequirements(auth.orgId);
  const matchable = await listMatchableRequirements('packaging', 25);

  return jsonOk(
    {
      ownRequirements: mine,
      // Only consented, verified demand is visible as platform demand, and only
      // as an expression of interest rather than a purchase order.
      platformDemandCount: matchable.length,
      notice:
        'Registered requests are expressions of interest. They are not purchase orders and no ' +
        'transaction is guaranteed.',
    },
    requestId,
  );
});

export const POST = authedRoute(async ({ auth, request, requestId }) => {
  await enforceRateLimit(auth, 'api');
  const body = await readJson(request, buyerRequirementSchema);

  const requirement = await createBuyerRequirement({
    orgId: auth.orgId,
    uid: auth.uid,
    buyerKind: body.buyerKind,
    businessName: body.businessName ?? null,
    industry: body.industry ?? null,
    location: body.location ?? null,
    country: body.country ?? null,
    productCategories: body.productCategories,
    materialFamilies: body.materialFamilies,
    minOrderQuantity: body.minOrderQuantity ?? null,
    budgetMinMinor: body.budgetMinMinor ?? null,
    budgetMaxMinor: body.budgetMaxMinor ?? null,
    currency: body.currency,
    capacityNote: body.capacityNote ?? null,
    consentToMatch: body.consentToMatch,
  });

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'buyer_requirement.created',
    entity: 'buyer_requirement',
    entityId: requirement.id,
    meta: { consentToMatch: body.consentToMatch, categories: body.productCategories },
  });

  return jsonOk(
    {
      requirement,
      labelling: body.consentToMatch
        ? 'Verified Platform Request on your own listings: you consented to be matched. Still an ' +
          'expression of interest, not a purchase order.'
        : 'Stored as your own requirement. It will not be shown to suppliers because consent to be ' +
          'matched was not given.',
    },
    requestId,
    201,
  );
});
