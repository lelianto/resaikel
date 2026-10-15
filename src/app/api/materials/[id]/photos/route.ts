import { NextResponse } from 'next/server';

import { HttpError } from '@/server/http/errors';
import { authedRoute, jsonOk, readJson } from '@/server/http/response';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { photoRegisterSchema } from '@/server/http/schemas';
import { inspectImageObject } from '@/server/firebase/storage';
import {
  addMaterialPhotoDocument,
  findPhotoByDigest,
  getMaterialDocument,
  listMaterialPhotoDocuments,
  updateMaterialDocument,
} from '@/server/repos/materials';
import { newRequestId } from '@/domain/ids';
import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import { UnsupportedImageError } from '@/server/firebase/storage';
import type { MaterialPhotoDocument } from '@/server/repos/types';

/**
 * Photo registration.
 *
 * The browser uploads the compressed image directly to Cloud Storage, then tells
 * this endpoint where it went. Nothing about the upload is trusted: the object is
 * downloaded, its size checked, its type derived from its leading bytes (not from
 * its extension or declared MIME type) and its digest computed server-side.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'upload');

  const body = await readJson(request, photoRegisterSchema);

  const material = await getMaterialDocument(auth.orgId, params.id);
  if (!material) throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');

  // The path is a claim by the client; it must match this tenant and material.
  const expectedPrefix = `materials/${auth.orgId}/${params.id}/`;
  if (!body.storagePath.startsWith(expectedPrefix)) {
    throw new HttpError(
      'FORBIDDEN',
      'The uploaded file is not stored under this material’s own path.',
    );
  }

  let inspection;
  try {
    inspection = await inspectImageObject(body.storagePath);
  } catch (error) {
    if (error instanceof UnsupportedImageError) {
      throw new HttpError('UNSUPPORTED_MEDIA_TYPE', error.reason);
    }
    throw new HttpError('NOT_FOUND', 'The uploaded file could not be read from storage.');
  }

  const duplicate = await findPhotoByDigest(params.id, inspection.sha256);
  if (duplicate) {
    return jsonOk({ photo: duplicate, duplicate: true }, requestId);
  }

  const existing = await listMaterialPhotoDocuments(auth.orgId, params.id);
  const photo: MaterialPhotoDocument = {
    id: newRequestId(),
    orgId: auth.orgId,
    materialId: params.id,
    storagePath: body.storagePath,
    fileName: body.fileName,
    mimeType: inspection.detectedType ?? 'image/jpeg',
    sizeBytes: inspection.sizeBytes,
    sha256: inspection.sha256,
    width: body.width ?? null,
    height: body.height ?? null,
    order: body.order,
    createdAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
  };

  await addMaterialPhotoDocument(photo);

  await updateMaterialDocument(auth.orgId, params.id, {
    photoCount: existing.length + 1,
    primaryPhotoId: material.primaryPhotoId ?? photo.id,
    updatedAt: nowIso(),
  });

  return jsonOk(
    {
      photo,
      duplicate: false,
      declaredType: inspection.declaredType,
      detectedType: inspection.detectedType,
    },
    requestId,
    201,
  );
});

/** Lists photograph metadata for a material. */
export const GET = authedRoute<{ id: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const material = await getMaterialDocument(auth.orgId, params.id);
  if (!material) throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');

  const photos = await listMaterialPhotoDocuments(auth.orgId, params.id);
  return jsonOk({ photos, photoCount: photos.length }, requestId);
});

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
