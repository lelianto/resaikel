'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/signature/logo';
import { Button, IconButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { cn } from '@/lib/cn';

/**
 * The marketing site is a single page at `/`; the nav scrolls to in-page
 * sections rather than routing. Each href is a hash that matches a section id
 * on the landing page.
 */
const NAV_LINKS = [
  { id: 'top', label: 'Home' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'examples', label: 'Examples' },
  { id: 'impact', label: 'Impact' },
  { id: 'about', label: 'About' },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('top');

  // Scroll-spy: highlight the nav item whose section is crossing the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    for (const link of NAV_LINKS) {
      const el = document.getElementById(link.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-xl">
      <Container width="wide" className="flex h-14 items-center justify-between gap-6">
        <Link
          href="/#top"
          className="inline-flex min-h-11 items-center rounded-sm lg:min-h-0"
          aria-label="resaikel home"
        >
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = active === link.id;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors',
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-muted hover:bg-primary-soft hover:text-primary',
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/sign-in">
            <Button size="sm">Open App</Button>
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
          {NAV_LINKS.map((link) => {
            const isActive = active === link.id;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'rounded-sm px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-ink-muted hover:bg-surface-subtle hover:text-ink',
                )}
              >
                {link.label}
              </a>
            );
          })}
          <Link href="/sign-in" className="pt-2" onClick={() => setOpen(false)}>
            <Button fullWidth>Open App</Button>
          </Link>
        </Container>
      </div>
    </header>
  );
}
