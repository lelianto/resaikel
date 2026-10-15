'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { IconButton } from './button';

/**
 * Modal built on the native <dialog> element so focus trapping, escape
 * handling and inertness come from the platform rather than from a library.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    element.addEventListener('cancel', handleCancel);
    return () => element.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-raised',
        'backdrop:bg-[rgb(32_39_32/0.42)] backdrop:backdrop-blur-[1px]',
        width,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-medium text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
        <IconButton label="Close" size="sm" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </header>

      {children ? <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div> : null}

      {footer ? (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-sunken px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </dialog>
  );
}
