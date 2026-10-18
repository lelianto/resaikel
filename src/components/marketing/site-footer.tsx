import Link from 'next/link';

import { Logo } from '@/components/signature/logo';
import { Container } from '@/components/ui/layout';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/sign-in?next=/materials/new', label: 'Scan material' },
      { href: '/impact', label: 'Impact' },
      { href: '/community', label: 'Community' },
      { href: '/about', label: 'About' },
      { href: '/sign-in', label: 'Sign in' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container
        width="wide"
        className="grid gap-8 py-10 sm:grid-cols-2 sm:gap-10 sm:py-12 lg:grid-cols-4"
      >
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
            Turn waste into worth. Material, production, and market intelligence for circular
            manufacturing.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-3">
            <h2 className="micro-label">{column.title}</h2>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm text-ink-muted transition-colors hover:text-ink sm:min-h-0"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="space-y-3">
          <h2 className="micro-label">Honesty note</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Every example shown on this site is illustrative sample data. resaikel does not claim
            verified market statistics, active buyer commitments or certified engineering results.
          </p>
        </div>
      </Container>

      <Container
        width="wide"
        className="flex flex-col gap-1 border-t border-line py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        <p className="micro-label">© {new Date().getFullYear()} resaikel</p>
        <p className="micro-label text-ink-faint">Turn waste into worth</p>
      </Container>
    </footer>
  );
}
