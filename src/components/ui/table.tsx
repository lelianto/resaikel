import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Data table with a responsive fallback. Below `md` each row is rendered as a
 * stacked definition list using the same cell labels, so no horizontal
 * scrolling is required on a phone.
 */
export function Table({ className, children, ...rest }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-surface-sunken">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'micro-label px-4 py-2.5 font-medium',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ className, ...rest }: ComponentProps<'tr'>) {
  return <tr className={cn('hover:bg-surface-subtle/60', className)} {...rest} />;
}

export function TD({
  children,
  align = 'left',
  mono = false,
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'px-4 py-2.5 align-top text-ink',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        mono && 'tnum font-mono text-[0.8125rem]',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Pagination({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  summary,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  summary: ReactNode;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-xs text-ink-muted">{summary}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="h-8 rounded-sm border border-line-strong px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-subtle disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="h-8 rounded-sm border border-line-strong px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-subtle disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
