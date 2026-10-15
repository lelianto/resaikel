import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { orgSettingsSchema } from '@/server/http/schemas';
import { recordAuditEvent, updateOrganization } from '@/server/repos/identity';

/**
 * PATCH /api/settings
 *
 * Organisation settings. Currency and locale live here rather than in code,
 * because every monetary figure in the product is derived from them and one
 * deployment must serve more than one market.
 */
export const PATCH = authedRoute(
  async ({ auth, request, requestId }) => {
    await enforceRateLimit(auth, 'api');
    const body = await readJson(request, orgSettingsSchema);

    await updateOrganization(auth.orgId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.country !== undefined ? { country: body.country } : {}),
      ...(body.city !== undefined ? { city: body.city } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    });

    await recordAuditEvent({
      orgId: auth.orgId,
      actorUid: auth.uid,
      action: 'organization.updated',
      entity: 'organization',
      entityId: auth.orgId,
      meta: { fields: Object.keys(body) },
    });

    return jsonOk({ updated: true, changed: Object.keys(body) }, requestId);
  },
  { roles: ['owner', 'admin'] },
);
