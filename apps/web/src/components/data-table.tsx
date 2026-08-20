'use client';

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, TriangleAlert } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/lib/types';

export interface Column<T> {
  /** Matches the API's sortable column name when `sortable` is set. */
  key: string;
  header: string;
  sortable?: boolean;
  /** Money and counts go right, so the digits line up down the column. */
  align?: 'left' | 'right';
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  meta: Paginated<T>['meta'];
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  sortBy?: string;
  sortDir?: string;
  onSort: (column: string) => void;
  onPage: (page: number) => void;
  emptyTitle: string;
  emptyDescription?: string;
  /** Rendered at the end of every row — usually an actions menu. */
  rowActions?: (row: T) => ReactNode;
  onRetry?: () => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  meta,
  loading,
  initialLoading,
  error,
  sortBy,
  sortDir,
  onSort,
  onPage,
  emptyTitle,
  emptyDescription,
  rowActions,
  onRetry,
}: DataTableProps<T>): JSX.Element {
  const columnCount = columns.length + (rowActions ? 1 : 0);
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="rounded-lg border bg-card">
      {/* A refetch dims the old rows rather than replacing them with skeletons —
          the numbers stay readable while a filter is applied. */}
      <div className={cn('transition-opacity', loading && !initialLoading && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        sortBy === column.key && 'text-foreground',
                      )}
                      aria-label={`Sort by ${column.header}`}
                    >
                      {column.header}
                      {sortBy === column.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
              {rowActions ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {initialLoading ? (
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <TableCell key={`skeleton-cell-${cellIndex}`}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="py-14">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <TriangleAlert className="h-7 w-7 text-negative" />
                    <div>
                      <p className="text-sm font-medium">Could not load this list</p>
                      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    </div>
                    {onRetry ? (
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Try again
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="py-14">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Inbox className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    {emptyDescription ? (
                      <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.align === 'right' && 'text-right tabular',
                        column.cellClassName,
                      )}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell className="text-right">{rowActions(row)}</TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground tabular">
          {meta.total === 0
            ? 'No records'
            : `Showing ${from}–${to} of ${meta.total.toLocaleString('en-US')}`}
        </p>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPage(meta.page - 1)}
            disabled={meta.page <= 1 || loading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPage(meta.page + 1)}
            disabled={meta.page >= meta.totalPages || loading}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
