import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Container({
  className,
  width = 'default',
  ...rest
}: ComponentProps<'div'> & { width?: 'default' | 'wide' | 'narrow' }) {
  const max = width === 'wide' ? 'max-w-[88rem]' : width === 'narrow' ? 'max-w-2xl' : 'max-w-6xl';
  return <div className={cn('mx-auto w-full px-5 sm:px-6 lg:px-8', max, className)} {...rest} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5',
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? <div className="micro-label">{eyebrow}</div> : null}
        <h1 className="text-2xl font-medium tracking-[-0.02em] text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  align = 'left',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' && 'mx-auto max-w-2xl text-center',
        className,
      )}
    >
      {eyebrow ? <div className="micro-label">{eyebrow}</div> : null}
      <h2 className="text-xl font-medium tracking-[-0.02em] text-ink sm:text-2xl">{title}</h2>
      {description ? (
        <p className="text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">{description}</p>
      ) : null}
    </div>
  );
}

/** Responsive grid helper that keeps gap and column rules consistent. */
export function Grid({
  children,
  min = '18rem',
  className,
}: {
  children: ReactNode;
  min?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-5', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}
    >
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-line', className)} />;
}
