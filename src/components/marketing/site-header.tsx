'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/signature/logo';
import { Button, IconButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/materials/new', label: 'Scan' },
  { href: '/impact', label: 'Impact' },
  { href: '/community', label: 'Community' },
  { href: '/about', label: 'About' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-xl">
      <Container width="wide" className="flex h-14 items-center justify-between gap-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-sm lg:min-h-0"
          aria-label="resaikel home"
        >
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/sign-in"
            className="rounded-sm px-3 py-2 text-[0.8125rem] text-ink-muted transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <Link href="/materials/new">
            <Button size="sm">Scan material</Button>
          </Link>
        </div>

        <IconButton
          label={open ? 'Close menu' : 'Open menu'}
          className="lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
        </IconButton>
      </Container>

      <div
        className={cn(
          'overflow-hidden border-t border-line bg-surface lg:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <Container width="wide" className="flex flex-col gap-1 py-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-sm px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/materials/new" className="pt-2" onClick={() => setOpen(false)}>
            <Button fullWidth>Scan material</Button>
          </Link>
        </Container>
      </div>
    </header>
  );
}
