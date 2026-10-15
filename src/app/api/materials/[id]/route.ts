import { checkConfirmable, applyMaterialPatch, loadMaterialDocumentOrThrow, loadMaterialWithPhotos } from '@/server/services/materials';
import { HttpError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { materialPatchSchema } from '@/server/http/schemas';
import { deleteMaterialDocument, updateMaterialDocument } from '@/server/repos/materials';
import { recordAuditEvent } from '@/server/repos/identity';
import { deleteObject } from '@/server/firebase/storage';

/** GET /api/materials/:id - the full record, including photograph metadata. */
export const GET = authedRoute<{ id: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const { document, material } = await loadMaterialWithPhotos(auth.orgId, params.id);
  const confirmation = checkConfirmable(material);

  return jsonOk(
    {
      material: {
        ...document,
        photos: material.photos,
      },
      confirmation,
    },
    requestId,
  );
});

/** PATCH /api/materials/:id - edit attributes, dimensions or quantity. */
export const PATCH = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const body = await readJson(request, materialPatchSchema);
  const existing = await loadMaterialDocumentOrThrow(auth.orgId, params.id);
  const { patch, changedFields } = applyMaterialPatch(existing, body);

  const updated = await updateMaterialDocument(auth.orgId, params.id, patch);
  if (!updated) throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');

  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'material.updated',
    entity: 'material',
    entityId: params.id,
    meta: { fields: changedFields },
  });

  return jsonOk({ material: updated, changedFields }, requestId);
});

/** DELETE /api/materials/:id - removes the record and its private photographs. */
export const DELETE = authedRoute<{ id: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const { material } = await loadMaterialWithPhotos(auth.orgId, params.id);

  // Objects are removed before the records, so a failure leaves an orphan record
  // (recoverable) rather than an orphan object (invisible and billed forever).
  for (const photo of material.photos) {
    await deleteObject(photo.storagePath);
  }

  await deleteMaterialDocument(auth.orgId, params.id);
  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'material.deleted',
    entity: 'material',
    entityId: params.id,
    meta: { photos: material.photos.length },
  });

  return jsonOk({ deleted: true }, requestId);
});
