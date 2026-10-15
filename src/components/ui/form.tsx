import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const CONTROL_BASE =
  'w-full rounded-md border bg-surface text-sm text-ink transition-colors placeholder:text-ink-faint ' +
  'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted';

function controlState(invalid: boolean): string {
  return invalid
    ? 'border-danger focus:border-danger'
    : 'border-line-strong hover:border-[#aeb4a6] focus:border-primary';
}

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  description,
  children,
  className,
}: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)} data-describedby={describedBy}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline gap-1 text-[0.8125rem] font-medium text-ink"
      >
        <span>{label}</span>
        {required ? (
          <span className="text-danger" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-[0.6875rem] font-normal text-ink-faint">optional</span>
        )}
      </label>
      {description ? <p className="text-xs leading-relaxed text-ink-muted">{description}</p> : null}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends ComponentProps<'input'> {
  invalid?: boolean;
  /** Adornment rendered inside the control on the right (a unit, usually). */
  trailing?: ReactNode;
  /** Adornment rendered inside the control on the left. */
  leading?: ReactNode;
}

export function Input({ invalid = false, trailing, leading, className, ...rest }: InputProps) {
  const control = (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        controlState(invalid),
        'h-10 px-3',
        leading ? 'pl-9' : null,
        trailing ? 'pr-12' : null,
        className,
      )}
      {...rest}
    />
  );

  if (!trailing && !leading) return control;

  return (
    <div className="relative">
      {leading ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">
          {leading}
        </span>
      ) : null}
      {control}
      {trailing ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-ink-faint">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

/** Numeric input with a fixed unit suffix, used for every millimetre value. */
export function MeasurementInput({
  unit = 'mm',
  invalid = false,
  className,
  ...rest
}: InputProps & { unit?: string }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      invalid={invalid}
      trailing={unit}
      className={cn('tnum text-right', className)}
      {...rest}
    />
  );
}

export interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, controlState(invalid), 'min-h-24 resize-y px-3 py-2', className)}
      {...rest}
    />
  );
}

export interface SelectProps extends ComponentProps<'select'> {
  invalid?: boolean;
}

export function Select({ invalid = false, className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          controlState(invalid),
          'h-10 appearance-none py-0 pl-3 pr-9',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 8"
        className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-ink-faint"
      >
        <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md px-0.5 py-1 text-sm text-ink',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded-xs border-line-strong text-primary accent-[var(--color-primary)]"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block leading-snug">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
  className,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: ReactNode; description?: ReactNode }[];
  value: string | null;
  onChange: (value: string) => void;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-1.5', className)}>
      <legend className="text-[0.8125rem] font-medium text-ink">{legend}</legend>
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      <div className="space-y-1 pt-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2.5 rounded-md px-0.5 py-1 text-sm text-ink"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-0.5 size-4 shrink-0 border-line-strong accent-[var(--color-primary)]"
            />
            <span className="min-w-0">
              <span className="block leading-snug">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
