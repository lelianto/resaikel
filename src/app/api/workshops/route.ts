import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { workshopSchema } from '@/server/http/schemas';
import {
  getWorkshopCapability,
  getWorkshopForOrg,
  recordAuditEvent,
  upsertWorkshop,
  upsertWorkshopCapability,
} from '@/server/repos/identity';
import type { ProcessId, ToolId } from '@/domain/catalog/types';
import type { MaterialFamily } from '@/domain/materials/types';

/**
 * Workshop profile and capabilities.
 *
 * Deliberately minimal: this exists so the feasibility engine has something to
 * check tooling against. A full manufacturer marketplace is out of scope for this
 * pass, and is not faked in the UI.
 */

export const GET = authedRoute(async ({ auth, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const workshop = await getWorkshopForOrg(auth.orgId);
  const capability = await getWorkshopCapability(auth.orgId);

  return jsonOk(
    {
      workshop,
      capability,
      note: capability
        ? null
        : 'Without a capability profile, feasibility stops at "geometrically feasible" because ' +
          'tooling and process steps cannot be verified.',
    },
    requestId,
  );
});

export const POST = authedRoute(async ({ auth, request, requestId }) => {
  await enforceRateLimit(auth, 'api');
  const body = await readJson(request, workshopSchema);

  const workshop = await upsertWorkshop({
    orgId: auth.orgId,
    uid: auth.uid,
    name: body.name,
    city: body.city ?? null,
    country: body.country,
    capacityNote: body.capacityNote ?? null,
  });

  const capability = await upsertWorkshopCapability({
    orgId: auth.orgId,
    workshopId: workshop.id,
    // Unknown ids are dropped rather than stored, so a stale client cannot put a
    // tool the catalogue does not know about into the capability profile.
    tools: body.tools.filter(isToolId),
    processes: body.processes.filter(isProcessId),
    supportedFamilies: body.supportedFamilies as readonly MaterialFamily[],
    defaultLabourRatePerHourMinor: body.labourRatePerHourMinor ?? null,
    notes: null,
  });

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'workshop.capability_updated',
    entity: 'workshop',
    entityId: workshop.id,
    meta: {
      tools: capability.tools.length,
      processes: capability.processes.length,
      families: capability.supportedFamilies.length,
    },
  });

  return jsonOk({ workshop, capability }, requestId);
});

const TOOL_ID_SET = new Set<string>([
  'measuring_tape',
  'ruler_square',
  'cutting_mat',
  'utility_knife',
  'scoring_bone',
  'straight_edge',
  'hand_saw',
  'circular_saw',
  'jig_saw',
  'band_saw',
  'hand_drill',
  'drill_press',
  'orbital_sander',
  'clamps',
  'hot_glue_gun',
  'staple_gun',
  'cnc_router',
  'laser_cutter',
  'edge_banding_iron',
  'paint_brush',
]);

const PROCESS_ID_SET = new Set<string>([
  'measure_mark',
  'cut_straight',
  'cut_curve',
  'score',
  'fold',
  'drill',
  'sand',
  'edge_finish',
  'assemble',
  'glue',
  'staple',
  'surface_finish',
  'print',
  'die_cut',
]);

function isToolId(value: string): value is ToolId {
  return TOOL_ID_SET.has(value);
}

function isProcessId(value: string): value is ProcessId {
  return PROCESS_ID_SET.has(value);
}
