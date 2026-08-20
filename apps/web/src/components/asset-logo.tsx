'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return initials.join('') || '?';
}

/**
 * A small square logo next to an asset's name, falling back to an initials
 * avatar when there's no `logoUrl` (real estate, funds, credit notes — things
 * with no brand mark) or the image fails to load (a stale/unreachable URL).
 */
export function AssetLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}): JSX.Element {
  const [errored, setErrored] = useState(false);

  if (logoUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable-domain logos; next/image would need per-domain config.
      <img
        src={logoUrl}
        alt=""
        className={cn('h-7 w-7 shrink-0 rounded-md border bg-white object-contain p-0.5', className)}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-secondary-foreground',
        className,
      )}
      aria-hidden
    >
      {initialsFor(name)}
    </span>
  );
}
