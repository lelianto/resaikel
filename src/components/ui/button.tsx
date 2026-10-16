import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold ' +
  'transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-ink-inverse shadow-[0_6px_18px_-10px_rgb(14_165_163/0.85)] hover:bg-primary-hover hover:-translate-y-0.5',
  accent: 'bg-accent text-ink hover:brightness-[0.97] hover:-translate-y-0.5',
  outline: 'border border-line-strong bg-surface text-ink hover:border-primary/35 hover:bg-primary-soft/40 hover:-translate-y-0.5',
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
