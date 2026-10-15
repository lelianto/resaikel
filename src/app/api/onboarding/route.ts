import { requireSessionUser } from '@/server/auth/guards';
import { recordAuditEvent, completeOnboarding } from '@/server/repos/identity';
import { jsonOk, publicRoute, readJson } from '@/server/http/response';
import { onboardingSchema } from '@/server/http/schemas';

/**
 * Onboarding.
 *
 * Available to any signed-in user, including one who has no organisation yet,
 * which is exactly why it uses the session guard rather than the organisation
 * guard. It creates the organisation and the owner membership in one batch.
 */
export const POST = publicRoute(async ({ request, requestId }) => {
  const user = await requireSessionUser();
  const body = await readJson(request, onboardingSchema);

  const { organization, member } = await completeOnboarding({
    uid: user.uid,
    displayName: body.displayName ?? user.displayName,
    roles: body.roles,
    orgName: body.orgName,
    country: body.country,
    city: body.city ?? null,
    currency: body.currency,
    locale: body.locale,
  });

  await recordAuditEvent({
    orgId: organization.id,
    actorUid: user.uid,
    action: 'organization.created',
    entity: 'organization',
    entityId: organization.id,
    meta: { roles: body.roles, currency: body.currency, country: body.country },
  });

  return jsonOk(
    {
      organisation: {
        orgId: organization.id,
        name: organization.name,
        currency: organization.currency,
        country: organization.country,
        locale: organization.locale,
      },
      membership: { role: member.role },
      roles: body.roles,
    },
    requestId,
    201,
  );
});
