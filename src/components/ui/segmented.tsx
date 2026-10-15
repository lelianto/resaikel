'use client';

import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Compact segmented control for view switches and sort modes. Rendered as a
 * real radiogroup so keyboard and screen-reader behaviour is inherited rather
 * than reimplemented.
 */
export function SegmentedControl<T extends string>({
  name,
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-subtle p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            name={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors',
              size === 'sm'
                ? 'min-h-11 px-2.5 text-xs sm:min-h-8 sm:px-2'
                : 'min-h-11 px-3 text-[0.8125rem] sm:min-h-9 sm:px-2.5',
              selected
                ? 'bg-surface text-ink shadow-[0_1px_1px_rgb(32_39_32/0.06)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
