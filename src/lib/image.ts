'use client';

/**
 * Client-side image preparation.
 *
 * Photographs are compressed before they leave the browser: a phone photo can be
 * 8 MB, and both the upload and the model call are billed on bytes. The default
 * ceiling of 1600 px on the long edge keeps enough detail to judge surface,
 * texture and defects while cutting typical uploads by an order of magnitude.
 *
 * The re-encode targets WebP, which is meaningfully smaller than JPEG at the same
 * visual quality. Browsers that cannot encode WebP from a canvas silently fall
 * back to PNG; that is detected and JPEG is used instead, so the upload is always
 * a compressed lossy format.
 *
 * Compression never *increases* the file size: if the re-encode would be larger
 * than the original, the original is uploaded instead.
 */

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** The content types the storage rules and server validation accept. */
export type UploadMimeType =
  | 'image/webp'
  | 'image/jpeg'
  | 'image/png'
  | 'image/heic'
  | 'image/heif';

const DECLARABLE_TYPES = new Set<string>([
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

const EXTENSION_BY_TYPE: Record<UploadMimeType, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export interface CompressedImage {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly mimeType: UploadMimeType;
  readonly fileName: string;
  readonly originalBytes: number;
  readonly compressed: boolean;
}

/** File extension (no dot) for an upload content type, defaulting to `jpg`. */
export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_TYPE[mimeType as UploadMimeType] ?? 'jpg';
}

export class ImagePreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImagePreparationError';
  }
}

interface LoadedImage {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly release: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);

  try {
    // createImageBitmap is significantly faster and avoids a layout pass, but it
    // is not available for every format in every browser, so there is a fallback.
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => {
          URL.revokeObjectURL(url);
          bitmap.close();
        },
      };
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new ImagePreparationError('That image could not be decoded.'));
      element.src = url;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    if (error instanceof ImagePreparationError) throw error;
    throw new ImagePreparationError(
      'That image could not be read. Try a JPEG, PNG or WebP file.',
    );
  }
}

/** Encodes a canvas to a Blob of the requested type, or null on failure. */
function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/jpeg',
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
}

export function validateImageFile(file: File): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.`;
  }
  if (!file.type.startsWith('image/')) {
    return 'Only photographs can be analysed. Choose a JPEG, PNG or WebP file.';
  }
  return null;
}

export async function compressImageFile(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const validationError = validateImageFile(file);
  if (validationError) throw new ImagePreparationError(validationError);

  const maxEdge = options.maxEdge ?? 1600;
  const quality = options.quality ?? 0.82;

  const loaded = await loadImage(file);

  try {
    const scale = Math.min(1, maxEdge / Math.max(loaded.width, loaded.height));
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new ImagePreparationError('This browser cannot prepare images for upload.');
    }

    // A white matte avoids transparent PNG regions turning black once the alpha
    // channel is dropped by a lossy re-encode.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(loaded.source, 0, 0, width, height);

    // Prefer WebP; it is smaller than JPEG at the same quality. A browser that
    // cannot encode WebP from a canvas returns a different type (usually PNG),
    // so fall back to JPEG whenever the WebP encode did not actually happen.
    let blob = await encodeCanvas(canvas, 'image/webp', quality);
    let mimeType: UploadMimeType = 'image/webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await encodeCanvas(canvas, 'image/jpeg', quality);
      mimeType = 'image/jpeg';
    }

    if (!blob) {
      throw new ImagePreparationError('This browser could not encode the image.');
    }

    // Never make the upload bigger than it started.
    if (blob.size >= file.size && scale === 1) {
      return {
        blob: file,
        width: loaded.width,
        height: loaded.height,
        mimeType: DECLARABLE_TYPES.has(file.type) ? (file.type as UploadMimeType) : 'image/jpeg',
        fileName: file.name,
        originalBytes: file.size,
        compressed: false,
      };
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'material';

    return {
      blob,
      width,
      height,
      mimeType,
      fileName: `${baseName}.${extensionForMimeType(mimeType)}`,
      originalBytes: file.size,
      compressed: true,
    };
  } finally {
    loaded.release();
  }
}

/** Distinct photos, so re-selecting the same shot does not create a duplicate. */
export function dedupeFiles(existing: readonly File[], incoming: readonly File[]): File[] {
  const seen = new Set(existing.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const additions: File[] = [];

  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push(file);
  }

  return additions;
}

/** `1.4 MB` / `320 KB` */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
