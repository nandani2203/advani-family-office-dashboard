'use client';

import { Search, X } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Radix Select cannot hold an empty string value, so "any" is a sentinel. */
const ANY = '__any__';

export function FilterBar({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): JSX.Element {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

interface FilterSelectProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Shown when nothing is selected, e.g. "Any status". */
  anyLabel: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}

export function FilterSelect({
  value,
  onChange,
  anyLabel,
  options,
  className = 'w-full sm:w-[170px]',
}: FilterSelectProps): JSX.Element {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => onChange(next === ANY ? undefined : next)}
    >
      <SelectTrigger className={className} aria-label={anyLabel}>
        <SelectValue placeholder={anyLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Turns a `Record<Enum, string>` label map into select options. */
export function optionsFrom<T extends string>(labels: Record<T, string>): Array<{
  value: string;
  label: string;
}> {
  return (Object.keys(labels) as T[]).map((key) => ({ value: key, label: labels[key] }));
}

export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string | undefined;
  to: string | undefined;
  onChange: (key: 'from' | 'to', value: string | undefined) => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from ?? ''}
        onChange={(event) => onChange('from', event.target.value || undefined)}
        className="w-[145px]"
        aria-label="From date"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={to ?? ''}
        onChange={(event) => onChange('to', event.target.value || undefined)}
        className="w-[145px]"
        aria-label="To date"
      />
    </div>
  );
}

export function ResetFilters({
  active,
  onReset,
}: {
  active: boolean;
  onReset: () => void;
}): JSX.Element | null {
  if (!active) return null;

  return (
    <Button variant="ghost" size="sm" onClick={onReset}>
      <X className="h-4 w-4" />
      Clear filters
    </Button>
  );
}
