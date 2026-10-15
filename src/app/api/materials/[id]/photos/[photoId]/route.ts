import { NextResponse } from 'next/server';

import { nowIso } from '@/domain/common';
import { deleteObject, readObjectBytes } from '@/server/firebase/storage';
import { HttpError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk } from '@/server/http/response';
import {
  deleteMaterialPhotoDocument,
  getMaterialPhotoDocument,
  listMaterialPhotoDocuments,
  updateMaterialDocument,
} from '@/server/repos/materials';

/**
 * Authorised photograph proxy.
 *
 * The stored objects are private: there is no public URL and no signed URL handed
 * to the browser. Every byte is served through this route after the session and
 * organisation have been checked, which means revoking access is immediate.
 */
export const GET = authedRoute<{ id: string; photoId: string }>(
  async ({ auth, params }) => {
    await enforceRateLimit(auth, 'api');

    const photo = await getMaterialPhotoDocument(auth.orgId, params.photoId);
    // A photo id from another material, or another tenant, is indistinguishable
    // from a photo that does not exist.
    if (!photo || photo.materialId !== params.id) {
      throw new HttpError('NOT_FOUND', 'That photograph does not exist.');
    }

    const { bytes, contentType } = await readObjectBytes(photo.storagePath);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-length': String(bytes.byteLength),
        // Private, and short-lived: the browser may cache, an intermediary may not.
        'cache-control': 'private, max-age=300',
        'content-disposition': `inline; filename="${photo.fileName.replace(/"/g, '')}"`,
        'x-content-type-options': 'nosniff',
      },
    });
  },
);

export const DELETE = authedRoute<{ id: string; photoId: string }>(
  async ({ auth, params, requestId }) => {
    await enforceRateLimit(auth, 'api');

    const photo = await getMaterialPhotoDocument(auth.orgId, params.photoId);
    if (!photo || photo.materialId !== params.id) {
      throw new HttpError('NOT_FOUND', 'That photograph does not exist.');
    }

    await deleteObject(photo.storagePath);
    await deleteMaterialPhotoDocument(auth.orgId, params.photoId);

    const remaining = await listMaterialPhotoDocuments(auth.orgId, params.id);
    const nextPrimary =
      remaining.find((entry) => entry.order === Math.min(...remaining.map((r) => r.order)))?.id ??
      null;

    await updateMaterialDocument(auth.orgId, params.id, {
      photoCount: remaining.length,
      primaryPhotoId: nextPrimary,
      updatedAt: nowIso(),
    });

    return jsonOk({ deleted: true, photoCount: remaining.length }, requestId);
  },
);
