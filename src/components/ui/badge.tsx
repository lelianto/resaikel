import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-muted border-line',
  primary: 'bg-primary-soft text-primary border-transparent',
  accent: 'bg-accent-soft text-accent-ink border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
};

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: BadgeTone;
  icon?: ReactNode;
  /** Renders in the monospace micro-label style - used for dimensions, ids, categories. */
  technical?: boolean;
}

export function Badge({
  tone = 'neutral',
  icon,
  technical = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-sm border px-1.5 py-0.5 align-middle',
        technical
          ? 'font-mono text-[0.6875rem] uppercase tracking-[0.06em]'
          : 'text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Small square swatch showing a material colour, with a texture overlay. */
export function Swatch({
  color,
  label,
  className,
}: {
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'material-texture inline-block size-4 shrink-0 rounded-xs border border-line-strong',
        className,
      )}
      style={{ backgroundColor: color }}
    />
  );
}
