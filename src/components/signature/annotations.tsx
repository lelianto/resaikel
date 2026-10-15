import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Quiet engineering-grid backdrop for material and specification surfaces. */
export function GridBackdrop({
  variant = 'fine',
  className,
}: {
  variant?: 'fine' | 'major';
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0',
        variant === 'major' ? 'grid-backdrop-major' : 'grid-backdrop',
        className,
      )}
    />
  );
}

/**
 * Dimension annotation: end ticks, extension lines and a centred measurement
 * label. Used to label real geometry - never as decoration.
 */
export function DimensionLine({
  label,
  orientation = 'horizontal',
  className,
}: {
  label: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  if (orientation === 'vertical') {
    return (
      <div className={cn('flex h-full flex-col items-center gap-1.5', className)}>
        <span className="w-3 border-t border-line-strong" />
        <span className="w-px flex-1 bg-line-strong" />
        <span className="micro-label whitespace-nowrap [writing-mode:vertical-rl]">{label}</span>
        <span className="w-px flex-1 bg-line-strong" />
        <span className="w-3 border-t border-line-strong" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="h-3 w-px bg-line-strong" />
      <span className="h-px flex-1 bg-line-strong" />
      <span className="micro-label whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-line-strong" />
      <span className="h-3 w-px bg-line-strong" />
    </div>
  );
}

/** Uppercase monospace category label - the product's smallest typographic unit. */
export function CategoryLabel({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'p';
}) {
  return <Tag className={cn('micro-label', className)}>{children}</Tag>;
}

/** Section rule with a technical label, used between landing-page sections. */
export function SectionRule({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-4 border-t border-line pt-4">
      <span className="micro-label tnum">{index}</span>
      <span className="micro-label text-ink-muted">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
