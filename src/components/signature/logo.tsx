import { cn } from '@/lib/cn';

/**
 * resaikel's mark is a nesting diagram: a stock rectangle with three parts laid
 * out inside it. It is the product's actual subject matter rather than an
 * abstract logo, which is why it survives at 16px. The pine-teal parts carry
 * Reka's plumage; one part is picked out in the mascot's feather-gold — the
 * reclaimed piece that found a new use.
 */
export function NestingMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('shrink-0 text-primary', className)}
    >
      <rect
        x="1.75"
        y="1.75"
        width="20.5"
        height="20.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <rect x="4.5" y="4.5" width="8.5" height="9" fill="currentColor" opacity="0.9" />
      <rect x="15.5" y="4.5" width="4" height="15" fill="var(--color-gold)" opacity="0.95" />
      <rect x="4.5" y="16" width="8.5" height="3.5" fill="currentColor" opacity="0.4" />
    </svg>
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
