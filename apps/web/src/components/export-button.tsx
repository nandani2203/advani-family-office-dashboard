'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { exportListToCsv } from '@/lib/export-csv';
import type { Filters } from '@/lib/use-list';

/**
 * Exports every row matching the current filters (all pages, not just the
 * one on screen) as a CSV download.
 */
export function ExportButton<T>({
  path,
  filters,
  filename,
  headers,
  toRow,
}: {
  path: string;
  filters: Filters;
  filename: string;
  headers: string[];
  toRow: (item: T) => unknown[];
}): JSX.Element {
  const [exporting, setExporting] = useState(false);

  const run = async (): Promise<void> => {
    setExporting(true);
    try {
      const count = await exportListToCsv<T>({ path, filters, filename, headers, toRow });
      toast.success(count === 1 ? 'Exported 1 row.' : `Exported ${count} rows.`);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.detail : 'Could not export this list.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" disabled={exporting} onClick={() => void run()}>
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export
    </Button>
  );
}
