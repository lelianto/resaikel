import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: ComponentProps<'section'>) {
  return <section className={cn('panel overflow-hidden', className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <div className="micro-label">{eyebrow}</div> : null}
        <h2 className="truncate text-[0.9375rem] font-medium text-ink">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('px-5 py-4', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: ComponentProps<'footer'>) {
  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-5 py-3',
        className,
      )}
      {...rest}
    />
  );
}

/** Label + value pair used throughout specification panels. */
export function SpecRow({
  label,
  children,
  mono = false,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <dt className="micro-label shrink-0 pt-0.5">{label}</dt>
      <dd className={cn('text-right text-sm text-ink', mono && 'tnum font-mono text-[0.8125rem]')}>
        {children}
      </dd>
    </div>
  );
}

export function SpecList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-line', className)}>{children}</dl>;
}
