import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  /** The one line that explains what the number counts. */
  hint?: string;
  /** A signed figure — coloured by direction, never by series. */
  delta?: { text: string; direction: 'up' | 'down' | 'flat' };
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, delta, icon }: StatCardProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>

        <p className="font-serif text-2xl font-medium tracking-tight tabular">{value}</p>

        <div className="flex min-h-[18px] flex-wrap items-center gap-2">
          {delta ? (
            <span
              className={cn(
                'text-xs font-medium tabular',
                delta.direction === 'up' && 'text-positive',
                delta.direction === 'down' && 'text-negative',
                delta.direction === 'flat' && 'text-muted-foreground',
              )}
            >
              {delta.text}
            </span>
          ) : null}
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}
