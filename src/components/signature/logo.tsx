import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * resaikel's mark is the leaf-R: a stylised "R" whose counter is cut by a
 * rising leaf, reclaimed material growing back into something useful. It is
 * shipped as a transparent raster (no clean vector source) sized up from the
 * favicon artwork, so it reads on both the canvas and the surface footer.
 */
export function NestingMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className={cn('shrink-0', className)}
    />
  );
}

export function Logo({
  className,
  size = 22,
  showWordmark = true,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <NestingMark size={size} />
      {showWordmark ? (
        <span className="text-[1.0625rem] font-bold leading-none tracking-[-0.04em] text-ink">
          resaikel
        </span>
      ) : null}
    </span>
  );
}
