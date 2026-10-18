import { NextResponse } from 'next/server';

import { HttpError } from '@/server/http/errors';
import { authedRoute, jsonOk } from '@/server/http/response';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { photoUploadSchema } from '@/server/http/schemas';
import {
  extensionForImageType,
  inspectImageBytes,
  saveObject,
  UnsupportedImageError,
} from '@/server/firebase/storage';
import {
  addMaterialPhotoDocument,
  findPhotoByDigest,
  getMaterialDocument,
  listMaterialPhotoDocuments,
  updateMaterialDocument,
} from '@/server/repos/materials';
import { newRequestId } from '@/domain/ids';
import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import type { MaterialPhotoDocument } from '@/server/repos/types';

/**
 * Photo upload.
 *
 * The browser sends the compressed image's bytes here as multipart form data and
 * the server stores them with the Admin SDK. Authorisation is the session cookie -
 * the same source of truth as every other route - so the browser never needs a
 * live Firebase client session to store a photo. Nothing about the bytes is
 * trusted: the size is checked, the type derived from the leading bytes (not from
 * the declared MIME type or file name) and the digest computed server-side, and
 * the storage path is derived from the tenant and material rather than claimed by
 * the client.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, request, requestId }) => {
  await enforceRateLimit(auth, 'upload');

  const material = await getMaterialDocument(auth.orgId, params.id);
  if (!material) throw new HttpError('MATERIAL_NOT_FOUND', 'That material does not exist.');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError('INVALID_INPUT', 'The upload was not valid multipart form data.');
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    throw new HttpError('INVALID_INPUT', 'The upload is missing its image file.');
  }

  const parsed = photoUploadSchema.safeParse({
    fileName: form.get('fileName'),
    width: form.get('width') ?? undefined,
    height: form.get('height') ?? undefined,
    order: form.get('order') ?? undefined,
  });
  if (!parsed.success) {
    throw new HttpError('INVALID_INPUT', 'The upload metadata failed validation.', {
      details: {
        issues: parsed.error.issues.slice(0, 12).map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
  const body = parsed.data;

  const buffer = Buffer.from(await file.arrayBuffer());

  let inspection;
  try {
    inspection = await inspectImageBytes(buffer, file.type || null);
  } catch (error) {
    if (error instanceof UnsupportedImageError) {
      throw new HttpError('UNSUPPORTED_MEDIA_TYPE', error.reason);
    }
    throw error;
  }

  const mimeType = inspection.detectedType ?? 'image/jpeg';

  const duplicate = await findPhotoByDigest(params.id, inspection.sha256);
  if (duplicate) {
    return jsonOk({ photo: duplicate, duplicate: true }, requestId);
  }

  // The path is derived from the authenticated tenant and material, never claimed
  // by the client, and the extension follows the detected type.
  const storagePath =
    `materials/${auth.orgId}/${params.id}/` +
    `photo_${body.order + 1}_${newRequestId().slice(0, 8)}.${extensionForImageType(mimeType)}`;

  try {
    await saveObject(storagePath, buffer, mimeType);
  } catch {
    throw new HttpError('INTERNAL', 'The photograph could not be stored. Please try again.');
  }

  const existing = await listMaterialPhotoDocuments(auth.orgId, params.id);
  const photo: MaterialPhotoDocument = {
    id: newRequestId(),
    orgId: auth.orgId,
    materialId: params.id,
    storagePath,
    fileName: body.fileName,
    mimeType,
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
