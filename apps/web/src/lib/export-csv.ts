import { api } from './api-client';
import type { Filters } from './use-list';

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(toCsvCell).join(','));
  // A leading BOM keeps Excel from mangling non-ASCII currency/company names.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; totalPages: number };
}

/**
 * Exports every row matching the current filters, not just the page on
 * screen — walks all pages at the API's max page size and concatenates them.
 */
export async function exportListToCsv<T>(options: {
  path: string;
  filters: Filters;
  filename: string;
  headers: string[];
  toRow: (item: T) => unknown[];
}): Promise<number> {
  const { path, filters, filename, headers, toRow } = options;
  const { page: _page, ...rest } = filters;
  void _page;

  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get<Paginated<T>>(path, { ...rest, page, pageSize: 100 });
    all.push(...response.data);
    totalPages = response.meta.totalPages;
    page += 1;
  } while (page <= totalPages);

  downloadCsv(filename, headers, all.map(toRow));
  return all.length;
}
