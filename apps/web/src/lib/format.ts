/**
 * One place for every number and date the UI renders. Two rules:
 *  - money is always tabular, so columns line up;
 *  - big figures are abbreviated on cards and shown in full in tables, because a
 *    KPI is for scanning and a ledger row is for reconciling.
 */

const FULL_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const EXACT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DECIMAL = new Intl.NumberFormat('en-US');

/** `$1,250,000` — for table cells, where the exact figure matters. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return FULL_USD.format(value);
}

/** `$1,250,000.00` — for detail views and reconciliation. */
export function formatMoneyExact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return EXACT_USD.format(value);
}

/**
 * `$2.03B` / `$41.5M` / `$820K` — for KPI cards and chart axes, where the
 * magnitude is the message.
 */
export function formatCompactMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000_000) return `${sign}$${(magnitude / 1_000_000_000).toFixed(2)}B`;
  if (magnitude >= 1_000_000) return `${sign}$${(magnitude / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${sign}$${Math.round(magnitude / 1_000)}K`;
  return `${sign}$${magnitude.toFixed(0)}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return DECIMAL.format(value);
}

/** `+150.0%` — the sign is always explicit on a change figure. */
export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** `18 Aug 2026` — unambiguous for a team split across en-US and en-GB. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

/** `in 12 days` / `9 days ago` / `today` — how a deadline is actually discussed. */
export function formatRelativeDays(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const days = daysUntil(value);
  if (days === null) return '—';

  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Whole days from today to `value`; negative once the date has passed. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;

  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return Math.round((target - today) / 86_400_000);
}

/** `INITIAL_CAPS_ENUM` → `Initial caps enum`, for values with no label mapping. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function initialsFor(name: string | null, email: string): string {
  const source = name?.trim() || email.split('@')[0].replace(/[._-]+/g, ' ');
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return initials.join('') || email.charAt(0).toUpperCase();
}
