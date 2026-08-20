'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  Building2,
  ChevronDown,
  Coins,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Sun,
  Users as UsersIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/types';
import { initialsFor } from '@/lib/format';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/** Mirrors the reference solution: Overview, the register, then Finances. */
const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Portfolio',
    items: [
      { href: '/investments', label: 'Investments', icon: Building2 },
      { href: '/assets', label: 'Assets', icon: Coins },
    ],
  },
  {
    label: 'Finances',
    items: [
      { href: '/transactions', label: 'Transactions', icon: Receipt },
      { href: '/distributions', label: 'Distributions', icon: Banknote },
      { href: '/filings', label: 'Filings', icon: FileCheck2 },
    ],
  },
  {
    label: 'Administration',
    items: [{ href: '/users', label: 'Users', icon: UsersIcon }],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 px-3 py-4">
      {NAV.map((group) => (
        <div key={group.label ?? 'root'} className="flex flex-col gap-1">
          {group.label ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          ) : null}

          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand(): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 border-b px-5 py-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        AF
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">Advani Family Office</p>
        <p className="text-xs text-muted-foreground">Internal dashboard</p>
      </div>
    </div>
  );
}

function ThemeToggle(): JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The resolved theme is unknown on the server, so the icon only renders
  // once mounted — otherwise the first paint can mismatch the client.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted ? isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" /> : null}
    </Button>
  );
}

function UserMenu(): JSX.Element | null {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-1.5 border-t p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {initialsFor(user.name, user.email)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name ?? user.email}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="truncate text-sm">{user.name ?? 'Staff account'}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  // Close the drawer behind any navigation, on any screen size.
  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      {/*
        The nav lives only in this Sheet — at every breakpoint, not just on
        phones. Radix's Dialog content is portaled to <body> with `fixed`
        positioning and locks background scroll while open, so the drawer
        never travels with page scroll and the page itself can't scroll out
        from under it while it's open. Closed by default; opened only by the
        header's Menu button.
      */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavLinks onNavigate={() => setDrawerOpen(false)} />
          <UserMenu />
        </SheetContent>
      </Sheet>

      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <p className="flex-1 truncate text-sm font-semibold">Advani Family Office</p>
        {user ? <Badge variant="muted">{ROLE_LABELS[user.role]}</Badge> : null}
        <ThemeToggle />
      </header>

      <main className="flex-1 bg-muted/30 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
