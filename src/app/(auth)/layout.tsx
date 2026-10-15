import Link from 'next/link';
import type { ReactNode } from 'react';

import { Logo } from '@/components/signature/logo';
import { GridBackdrop } from '@/components/signature/annotations';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <GridBackdrop className="opacity-60" />

      <header className="relative border-b border-line/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="rounded-sm" aria-label="resaikel home">
            <Logo />
          </Link>
          <Link
            href="/how-it-works"
            className="text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
          >
            How it works
          </Link>
        </div>
      </header>

      <main id="main" className="relative flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          {children}
          <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
            resaikel reports what it can substantiate and nothing more. Material properties are
            confirmed by a person, feasibility is calculated deterministically, and missing market
            evidence is reported as missing rather than estimated.
          </p>
        </div>
      </main>
    </div>
  );
}
