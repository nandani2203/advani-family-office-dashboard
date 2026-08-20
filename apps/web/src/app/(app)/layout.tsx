'use client';

import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';

/**
 * The client-side guard for every authenticated page. The API is the real
 * boundary — it rejects an unauthenticated request whatever the browser does —
 * so this exists to route the user somewhere useful, not to enforce access.
 */
export default function AppLayout({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your session…
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
