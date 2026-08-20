'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from './api-client';
import type { Paginated } from './types';

export type Filters = Record<string, string | number | boolean | undefined>;

interface ListState<T> {
  rows: T[];
  meta: Paginated<T>['meta'];
  loading: boolean;
  /** True only on the very first load, so the table can show skeletons once. */
  initialLoading: boolean;
  error: string | null;
  filters: Filters;
  /** `filters` with the search term debounced — the same set actually sent to
   * the API, useful for a second query (e.g. summary totals) that should stay
   * in lockstep with the table instead of firing on every keystroke. */
  effectiveFilters: Filters;
  /** Sets one filter and returns to page 1, because the old page may not exist. */
  setFilter: (key: string, value: string | number | boolean | undefined) => void;
  setPage: (page: number) => void;
  /** Toggles asc/desc when the same column is clicked twice. */
  toggleSort: (column: string) => void;
  refresh: () => void;
}

const EMPTY_META = { page: 1, pageSize: 25, total: 0, totalPages: 1 };

/**
 * The shared behaviour behind every list page: query-string filters, pagination,
 * sorting, debounced search, and cancellation of a response that a newer request
 * has already superseded.
 */
export function useList<T>(path: string, initialFilters: Filters = {}): ListState<T> {
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    pageSize: 25,
    ...initialFilters,
  });
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Typing in the search box should not fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const search = filters.search;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const queryKey = JSON.stringify(query);

  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;

    setLoading(true);

    api
      .get<Paginated<T>>(path, query, next.signal)
      .then((response) => {
        setRows(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((cause: unknown) => {
        // An aborted request is a superseded one, not a failure to report.
        if (next.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.detail : 'Could not load this list.');
        setRows([]);
        setMeta(EMPTY_META);
      })
      .finally(() => {
        if (next.signal.aborted) return;
        setLoading(false);
        setInitialLoading(false);
      });

    return () => next.abort();
    // `queryKey` is the stable identity of `query`; `nonce` forces a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, nonce]);

  const setFilter = useCallback<ListState<T>['setFilter']>((key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value === '' ? undefined : value,
      ...(key === 'page' ? {} : { page: 1 }),
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  const toggleSort = useCallback((column: string) => {
    setFilters((current) => ({
      ...current,
      sortBy: column,
      sortDir: current.sortBy === column && current.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }, []);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return {
    rows,
    meta,
    loading,
    initialLoading,
    error,
    filters,
    effectiveFilters: query,
    setFilter,
    setPage,
    toggleSort,
    refresh,
  };
}

/**
 * Fetches a single value once — the dashboard summary, an options list. Kept
 * separate from `useList` because there is no pagination or filtering involved.
 */
export function useResource<T>(
  path: string,
  options: { enabled?: boolean; query?: Filters } = {},
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const { enabled = true, query } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    api
      .get<T>(path, query, controller.signal)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.detail : 'Could not load this data.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, nonce, queryKey]);

  return { data, loading, error, refresh: () => setNonce((value) => value + 1) };
}
