import { serverConfig } from '@/lib/config';

import { adminBucket } from './admin';

/**
 * Private object storage.
 *
 * Material photography never has a public URL. Objects are validated by reading
 * their actual bytes - a declared content type in an upload is a claim, not a
 * fact - and are streamed to the browser only through an authorised route.
 */

export type ImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export interface StoredObject {
  readonly storagePath: string;
  readonly sizeBytes: number;
  readonly contentType: string | null;
  readonly updatedAt: string | null;
}

export interface ImageInspection {
  readonly detectedType: ImageMimeType | null;
  readonly declaredType: string | null;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly bytes: Buffer;
}

export class UnsupportedImageError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnsupportedImageError';
    this.reason = reason;
  }
}

/**
 * Identifies an image from its leading bytes.
 *
 * A file-signature check is the only reliable way to reject a renamed or
 * mislabelled upload; the browser-supplied MIME type is never trusted.
 */
export function detectImageType(bytes: Buffer): ImageMimeType | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // ISO base media file format: the brand at offset 8 tells HEIC from HEIF.
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brand = bytes.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return brand.startsWith('hei') ? 'image/heic' : 'image/heif';
    }
  }

  return null;
}

/** File extension (no dot) for a detected image type. */
export function extensionForImageType(type: ImageMimeType): string {
  switch (type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

/**
 * Validates a buffer as an image and derives its true type, size and digest.
 *
 * This is the single place where "is this actually an image we accept?" is
 * decided, from the bytes alone - the declared content type is never trusted.
 */
export async function inspectImageBytes(
  buffer: Buffer,
  declaredType: string | null = null,
): Promise<ImageInspection> {
  const sizeBytes = buffer.byteLength;
  if (sizeBytes === 0) throw new UnsupportedImageError('The uploaded file is empty.');
  if (sizeBytes > serverConfig.upload.maxBytes) {
    throw new UnsupportedImageError(
      `The image is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB, above the ` +
        `${(serverConfig.upload.maxBytes / 1024 / 1024).toFixed(0)} MB limit.`,
    );
  }

  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    throw new UnsupportedImageError(
      'The file is not a recognised JPEG, PNG, WebP or HEIC image. Its contents do not match its ' +
        'extension.',
    );
  }

  const { createHash } = await import('node:crypto');

  return {
    detectedType,
    declaredType,
    sizeBytes,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer,
  };
}

export async function inspectImageObject(storagePath: string): Promise<ImageInspection> {
  const [buffer] = await adminBucket().file(storagePath).download();
  const [metadata] = await adminBucket().file(storagePath).getMetadata();

  return inspectImageBytes(
    buffer,
    typeof metadata.contentType === 'string' ? metadata.contentType : null,
  );
}

/**
 * Writes an object to the private bucket with the Admin SDK.
 *
 * The upload is authorised by the server session (the single source of truth for
 * who may act), so the browser never needs a live Firebase client session to
 * store a photo. `resumable: false` keeps a small, already-compressed image a
 * single request.
 */
export async function saveObject(
  storagePath: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  await adminBucket()
    .file(storagePath)
    .save(bytes, { contentType, resumable: false, metadata: { contentType } });
}

export async function getObjectMetadata(storagePath: string): Promise<StoredObject | null> {
  try {
    const [metadata] = await adminBucket().file(storagePath).getMetadata();
    return {
      storagePath,
      sizeBytes: Number(metadata.size ?? 0),
      contentType: typeof metadata.contentType === 'string' ? metadata.contentType : null,
      updatedAt: typeof metadata.updated === 'string' ? metadata.updated : null,
    };
  } catch {
    return null;
  }
}

export async function objectExists(storagePath: string): Promise<boolean> {
  const [exists] = await adminBucket().file(storagePath).exists();
  return exists;
}

export async function deleteObject(storagePath: string): Promise<void> {
  try {
    await adminBucket().file(storagePath).delete();
  } catch {
    // Deleting an object that is already gone is not an error worth surfacing.
  }
}

/** Reads an object as base64 for a multimodal model call. */
export async function readObjectAsBase64(
  storagePath: string,
): Promise<{ dataBase64: string; mimeType: ImageMimeType }> {
  const [buffer] = await adminBucket().file(storagePath).download();
  if (buffer.byteLength > serverConfig.upload.maxBytes) {
    throw new UnsupportedImageError('The stored image exceeds the size limit for analysis.');
  }

  const detected = detectImageType(buffer);
  if (!detected) throw new UnsupportedImageError('The stored object is not a supported image.');

  return { dataBase64: buffer.toString('base64'), mimeType: detected };
}

/**
 * Reads an object's bytes for the authorised streaming route.
 *
 * The declared content type is ignored and the type is re-derived from the bytes,
 * so a stored object can never be served with a misleading content type.
 */
export async function readObjectBytes(
  storagePath: string,
): Promise<{ bytes: Buffer; contentType: ImageMimeType }> {
  const [buffer] = await adminBucket().file(storagePath).download();
  const detected = detectImageType(buffer);
  if (!detected) throw new UnsupportedImageError('The stored object is not a supported image.');
  return { bytes: buffer, contentType: detected };
}
