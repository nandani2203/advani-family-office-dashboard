import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginForm } from './login-form';

/**
 * The form reads `?expired=1` via `useSearchParams`, which Next requires to sit
 * behind a Suspense boundary, so the route shell stays a server component.
 */
export default function LoginPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
          <Skeleton className="h-[420px] w-full max-w-md rounded-lg" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
