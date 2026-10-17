import { enforceRateLimit } from '@/server/http/ratelimit';
import { HttpError } from '@/server/http/errors';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { discoverSchema } from '@/server/http/schemas';
import { recordAuditEvent, getWorkshopCapability, getWorkshopForOrg } from '@/server/repos/identity';
import {
  deleteOpportunitiesForMaterial,
  saveCostEstimate,
  saveFeasibilityResult,
  saveOpportunityDocuments,
} from '@/server/repos/opportunities';
import {
  attachExplanation,
  evaluateMaterial,
  type CapabilitySummary,
} from '@/server/services/discovery';
import { checkConfirmable, loadMaterialWithPhotos } from '@/server/services/materials';
import { isSupportedFamily, SUPPORTED_FAMILIES } from '@/domain/catalog';
import { familyOf, MATERIAL_FAMILY_LABELS } from '@/domain/materials/types';

/**
 * POST /api/materials/:id/discover
 *
 * Runs the whole pipeline for one confirmed material and returns the ranked
 * opportunities. Explanations are attached for the top three candidates only, so
 * a five-candidate run makes at most three prose calls rather than five.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'ai');

  const body = await readJson(request, discoverSchema);
  const { material } = await loadMaterialWithPhotos(auth.orgId, params.id);

  // Everything downstream depends on confirmed physical properties.
  if (material.status !== 'verified') {
    const confirmation = checkConfirmable(material);
    throw new HttpError(
      'MATERIAL_NOT_VERIFIED',
      'Confirm the material’s properties before discovering products. A photograph cannot establish ' +
        'dimensions, and an unconfirmed value blocks evaluation.',
      { details: { blocking: confirmation.blocking } },
    );
  }

  // The catalogue only has templates for some material families. Fail loudly here
  // rather than running the whole pipeline to return nothing buildable.
  const family = familyOf(material.attributes.category);
  if (!isSupportedFamily(family)) {
    throw new HttpError(
      'MATERIAL_FAMILY_UNSUPPORTED',
      `The platform cannot yet turn ${MATERIAL_FAMILY_LABELS[family].toLowerCase()} into products. ` +
        `Supported materials: ${SUPPORTED_FAMILIES.map((entry) => MATERIAL_FAMILY_LABELS[entry]).join(', ')}.`,
      { details: { family, supportedFamilies: SUPPORTED_FAMILIES } },
    );
  }

  const workshop = await getWorkshopForOrg(auth.orgId);
  const capabilityRow = workshop ? await getWorkshopCapability(auth.orgId) : null;

  const capability: CapabilitySummary | null =
    workshop && capabilityRow
      ? {
          name: workshop.name,
          tools: capabilityRow.tools,
          processes: capabilityRow.processes,
          supportedFamilies: capabilityRow.supportedFamilies,
        }
      : null;

  if (!capability) {
    // Not a failure: the geometry can still be established. It means the process
    // cannot be verified, so results cap out at "geometrically feasible".
    await recordAuditEvent({
      orgId: auth.orgId,
      actorUid: auth.uid,
      action: 'discovery.no_capability_profile',
      entity: 'material',
      entityId: params.id,
      meta: {},
    });
  }

  if (body.replace) {
    await deleteOpportunitiesForMaterial(auth.orgId, params.id);
  }

  const result = await evaluateMaterial({
    auth,
    material,
    capability,
    ...(body.overrides ? { overrides: body.overrides } : {}),
    targetMarket: body.targetMarket ?? null,
    isSampleData: material.isSampleData,
  });

  const topRanked = result.opportunities
    .filter((opportunity) => opportunity.ranking?.gatesPassed === true)
    .sort((a, b) => (a.ranking?.rank ?? 99) - (b.ranking?.rank ?? 99))
    .slice(0, 3);

  const explanations = new Map<
    string,
    NonNullable<(typeof result.opportunities)[number]['explanation']>
  >();

  for (const opportunity of topRanked) {
    const feasibility =
      result.feasibility.find((row) => row.opportunityId === opportunity.id) ?? null;
    const explanation = await attachExplanation(opportunity, feasibility);
    if (explanation) explanations.set(opportunity.id, explanation);
  }

  const opportunities = result.opportunities.map((opportunity) => ({
    ...opportunity,
    explanation: explanations.get(opportunity.id) ?? null,
  }));

  for (const feasibility of result.feasibility) await saveFeasibilityResult(feasibility);
  for (const cost of result.cost) await saveCostEstimate(cost);
  await saveOpportunityDocuments(opportunities);

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'discovery.completed',
    entity: 'material',
    entityId: params.id,
    meta: {
      opportunities: opportunities.length,
      feasible: opportunities.filter((row) => row.ranking?.gatesPassed === true).length,
      capabilityProvided: capability !== null,
    },
  });

  return jsonOk(
    {
      opportunities,
      notes: result.notes,
      rejectedCandidates: result.dropped,
      capabilityProvided: capability !== null,
      capabilityNotice: capability
        ? null
        : 'No workshop capability profile is set up, so tooling and process steps could not be ' +
          'verified. Results therefore stop at "geometrically feasible". Add your tools in ' +
          'Workspace settings to get a full process verdict.',
    },
    requestId,
  );
});
