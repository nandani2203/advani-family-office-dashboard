'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

const COLLAPSE_KEY = 'nav.collapsed';

function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 px-3 py-4">
      {NAV.map((group) => (
        <div key={group.label ?? 'root'} className="flex flex-col gap-1">
          {group.label && !collapsed ? (
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
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {collapsed ? null : item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  /** Omitted on the mobile drawer, which has no collapsed state of its own. */
  onToggleCollapse?: () => void;
}): JSX.Element {
  const logo = (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
      AF
    </div>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-b px-2 py-4">
        {logo}
        {onToggleCollapse ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Expand navigation"
            onClick={onToggleCollapse}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 border-b px-5 py-4">
      {logo}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">Advani Family Office</p>
        <p className="text-xs text-muted-foreground">Internal dashboard</p>
      </div>
      {onToggleCollapse ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Collapse navigation"
          onClick={onToggleCollapse}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : null}
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

function UserMenu({ collapsed }: { collapsed?: boolean }): JSX.Element | null {
  const { user, signOut } = useAuth();
  if (!user) return null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account menu for ${user.name ?? user.email}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {initialsFor(user.name, user.email)}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="right" className="w-60">
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
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  // Close the mobile drawer behind any navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Restore the collapsed preference after mount only, so the server-rendered
  // (always expanded) markup matches the client's first paint.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  const toggleCollapsed = (): void => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/*
        Persistent on desktop — part of the page's own layout (not an overlay),
        so it never scrolls with `main` and is always reachable, just narrower
        when collapsed. `main` scrolls on its own inside the h-screen/overflow
        -hidden row below, which is what keeps the rail from moving at all.
      */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r bg-card transition-[width] duration-200 ease-in-out lg:flex',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        )}
      >
        <Brand collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <NavLinks collapsed={collapsed} />
        <UserMenu collapsed={collapsed} />
      </aside>

      {/*
        Below `lg`, there's no room for a persistent rail, so navigation lives
        in this overlay Sheet instead — closed by default, opened only by the
        header's Menu button. Radix's Dialog content is portaled to <body>
        with `fixed` positioning and locks background scroll while open.
      */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand collapsed={false} />
          <NavLinks onNavigate={() => setDrawerOpen(false)} />
          <UserMenu />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
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

        <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
