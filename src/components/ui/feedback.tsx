import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<AlertTone, { wrapper: string; icon: ReactNode }> = {
  info: {
    wrapper: 'border-info/25 bg-info-soft text-info',
    icon: <Info className="size-4 shrink-0" aria-hidden />,
  },
  success: {
    wrapper: 'border-success/25 bg-success-soft text-success',
    icon: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
  },
  warning: {
    wrapper: 'border-warning/30 bg-warning-soft text-warning',
    icon: <AlertTriangle className="size-4 shrink-0" aria-hidden />,
  },
  danger: {
    wrapper: 'border-danger/30 bg-danger-soft text-danger',
    icon: <XCircle className="size-4 shrink-0" aria-hidden />,
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, actions, className }: AlertProps) {
  const config = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border px-3.5 py-3 text-sm', config.wrapper, className)}
    >
      <span className="pt-0.5">{config.icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="leading-relaxed opacity-90">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-start gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="grid size-10 place-items-center rounded-md bg-surface-subtle text-ink-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[0.9375rem] font-medium text-ink">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className, ...rest }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton', className)} {...rest} />;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const safeMax = max <= 0 ? 1 : max;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Indeterminate progress used while an async job is running. */
export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuetext="working"
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle', className)}
    >
      <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      <style>{'@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
    </div>
  );
}
