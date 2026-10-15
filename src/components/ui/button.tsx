import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-ink-inverse hover:bg-primary-hover',
  accent: 'bg-accent text-[#2a2013] hover:brightness-[0.94]',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-subtle',
  ghost: 'text-ink-muted hover:bg-surface-subtle hover:text-ink',
  danger: 'bg-danger text-ink-inverse hover:brightness-[0.93]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.8125rem]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[0.9375rem]',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

export interface IconButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Required: an icon-only control needs an accessible name. */
  label: string;
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const dimension = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-11' : 'size-10';

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        BASE,
        VARIANTS[variant],
        dimension,
        'shrink-0 px-0',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Full-width button that submits a form and shows a pending state. */
export function SubmitButton({
  pending,
  children,
  ...rest
}: ButtonProps & { pending?: boolean }) {
  return (
    <Button type="submit" loading={pending === true} {...rest}>
      {children}
    </Button>
  );
}
