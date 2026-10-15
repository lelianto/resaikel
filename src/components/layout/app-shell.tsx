'use client';

import {
  Boxes,
  Compass,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkle,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { Logo } from '@/components/signature/logo';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { firebaseAuth } from '@/lib/firebase/client';

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', mobileLabel: 'Home', icon: LayoutDashboard },
  { href: '/materials', label: 'Materials', mobileLabel: 'Materials', icon: Boxes },
  { href: '/discover', label: 'Discover', mobileLabel: 'Discover', icon: Compass },
  { href: '/opportunities', label: 'Opportunities', mobileLabel: 'Results', icon: Sparkle },
  { href: '/workspace', label: 'Workspace', mobileLabel: 'Workshop', icon: Wrench },
] as const;

export interface ShellIdentity {
  readonly displayName: string;
  readonly email: string | null;
  readonly orgName: string;
  readonly roleLabel: string;
  readonly currency: string;
  readonly country: string;
  readonly roleLabels: readonly string[];
  readonly onboarded: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'R';
}

export function AppShell({
  identity,
  children,
}: {
  identity: ShellIdentity;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await apiRequest('/api/auth/session', { method: 'DELETE' });
      await firebaseAuth().signOut().catch(() => undefined);
      router.replace('/sign-in');
      router.refresh();
    } catch {
      setSignOutError('Could not sign out cleanly. Reload the page and try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-line px-5">
          <Link href="/overview" aria-label="resaikel">
            <Logo />
          </Link>
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-ink-muted hover:bg-surface-subtle hover:text-ink',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-line p-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
          >
            <Settings className="size-4 shrink-0" aria-hidden />
            Settings
          </button>

          <div className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
            <p className="truncate text-[0.8125rem] font-medium text-ink">{identity.orgName}</p>
            <p className="micro-label mt-0.5">
              {identity.roleLabel} · {identity.currency} · {identity.country}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur-md lg:hidden">
          <Link href="/overview" aria-label="resaikel">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Account and settings"
            className="grid size-9 place-items-center rounded-full bg-primary-soft text-xs font-medium text-primary"
          >
            {initials(identity.displayName)}
          </button>
        </header>

        <main id="main" className="min-w-0 flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgb(32_39_32_/_0.06)] backdrop-blur-md lg:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium transition-colors',
                  active ? 'text-primary' : 'text-ink-faint',
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{item.mobileLabel}</span>
                {active ? <span className="absolute inset-x-3 top-0 h-0.5 bg-primary" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Account and organisation"
        description="Your role and currency are set per organisation. Only owners and administrators can change them."
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setSettingsOpen(false)}>
            Close
          </Button>
        }
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="micro-label">Signed in as</dt>
            <dd className="text-ink">{identity.displayName}</dd>
            <dd className="text-ink-muted">{identity.email ?? 'No email on this account'}</dd>
          </div>
          <div>
            <dt className="micro-label">Organisation</dt>
            <dd className="text-ink">{identity.orgName}</dd>
          </div>
          <div>
            <dt className="micro-label">Role</dt>
            <dd className="text-ink">{identity.roleLabel}</dd>
          </div>
          <div>
            <dt className="micro-label">Your declared roles</dt>
            <dd className="text-ink">
              {identity.roleLabels.length > 0 ? identity.roleLabels.join(', ') : 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="micro-label">Currency and market</dt>
            <dd className="tnum font-mono text-[0.8125rem]">
              {identity.currency} · {identity.country}
            </dd>
          </div>
        </dl>

        {signOutError ? (
          <p role="alert" className="mt-4 text-xs text-danger">
            {signOutError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link href="/workspace/settings">
            <Button variant="outline" size="sm">
              Organisation settings
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<LogOut className="size-4" aria-hidden />}
            loading={signingOut}
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
