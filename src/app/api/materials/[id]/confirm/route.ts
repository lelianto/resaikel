import { nowIso } from '@/domain/common';
import { recordAuditEvent } from '@/server/repos/identity';
import { HttpError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { materialConfirmSchema } from '@/server/http/schemas';
import {
  applyMaterialPatch,
  checkConfirmable,
  loadMaterialWithPhotos,
} from '@/server/services/materials';
import { updateMaterialDocument } from '@/server/repos/materials';

/**
 * POST /api/materials/:id/confirm
 *
 * The gate between "an AI looked at a photo" and "a person has confirmed the
 * physical properties". Discovery refuses to run for anything unconfirmed, and
 * the feasibility engine returns `not_evaluated` for it, so this endpoint is the
 * single point where a material becomes eligible for evaluation.
 *
 * An optional patch is applied first so the confirmation form can save and
 * confirm in one round trip.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const body = await readJson(request, materialConfirmSchema);

  const { document } = await loadMaterialWithPhotos(auth.orgId, params.id);

  if (body.patch && Object.keys(body.patch).length > 0) {
    const { patch } = applyMaterialPatch(document, body.patch);
    const updated = await updateMaterialDocument(auth.orgId, params.id, patch);
    if (!updated) throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');
  }

  const { document: fresh, material } = await loadMaterialWithPhotos(auth.orgId, params.id);
  const confirmation = checkConfirmable(material);

  if (!confirmation.ready) {
    throw new HttpError(
      'MATERIAL_NOT_VERIFIED',
      'Confirm the required properties before this material can be evaluated.',
      { details: { blocking: confirmation.blocking } },
    );
  }

  const timestamp = nowIso();
  const updated = await updateMaterialDocument(auth.orgId, params.id, {
    status: 'verified',
    verifiedAt: timestamp,
    updatedAt: timestamp,
    warnings: confirmation.warnings,
    missingInformation: fresh.missingInformation,
  });

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'material.verified',
    entity: 'material',
    entityId: params.id,
    meta: {
      category: material.attributes.category,
      lengthMm: material.dimensions.lengthMm,
      widthMm: material.dimensions.widthMm,
    },
  });

  return jsonOk(
    {
      material: updated,
      confirmation,
      notice:
        'Confirmed. Feasibility results are conservative estimates under your stated assumptions and ' +
        'are not production drawings or safety certifications.',
    },
    requestId,
  );
});
