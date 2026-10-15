import { ImageOff } from 'lucide-react';

import { GridBackdrop } from '@/components/signature/annotations';
import type { MaterialPhoto } from '@/domain/materials/types';
import { cn } from '@/lib/cn';

/**
 * Material photography.
 *
 * Images are served through the authorised proxy route rather than from a public
 * or signed URL, so access is checked on every request and revocation is
 * immediate. They are plain `<img>` elements on purpose: the optimiser would have
 * to fetch and cache private business data.
 */

export function PhotoThumbnail({
  materialId,
  photoId,
  alt,
  className,
}: {
  materialId: string;
  photoId: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/materials/${materialId}/photos/${photoId}`}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('size-full object-cover', className)}
    />
  );
}

export function PhotoPlaceholder({ label = 'No photograph' }: { label?: string }) {
  return (
    <div className="relative grid size-full place-items-center bg-surface-sunken">
      <GridBackdrop />
      <span className="relative flex flex-col items-center gap-1.5 text-ink-faint">
        <ImageOff className="size-5" strokeWidth={1.5} aria-hidden />
        <span className="micro-label">{label}</span>
      </span>
    </div>
  );
}

export function PhotoGallery({
  materialId,
  photos,
  title,
}: {
  materialId: string;
  photos: readonly MaterialPhoto[];
  title: string;
}) {
  if (photos.length === 0) {
    return (
      <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line">
        <PhotoPlaceholder label="No photographs yet" />
      </div>
    );
  }

  const [primary, ...rest] = photos;

  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line">
        {primary ? (
          <PhotoThumbnail
            materialId={materialId}
            photoId={primary.id}
            alt={`${title} — photograph 1 of ${photos.length}`}
          />
        ) : null}
      </div>

      {rest.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3">
          {rest.map((photo, index) => (
            <li
              key={photo.id}
              className="aspect-square overflow-hidden rounded-md border border-line"
            >
              <PhotoThumbnail
                materialId={materialId}
                photoId={photo.id}
                alt={`${title} — photograph ${index + 2} of ${photos.length}`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="micro-label tnum">
        {photos.length} photograph{photos.length === 1 ? '' : 's'} · private to your organisation
      </p>
    </div>
  );
}
