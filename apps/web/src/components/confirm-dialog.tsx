'use client';

import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  successMessage: string;
}

/**
 * Used for deletes and other one-way actions. The API's own message is shown on
 * failure — it is the one that explains *why*, e.g. that an asset still has
 * investments pointing at it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  successMessage,
}: ConfirmDialogProps): JSX.Element {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (): Promise<void> => {
    setWorking(true);
    setError(null);

    try {
      await onConfirm();
      toast.success(successMessage);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : 'That did not work.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-md border border-negative/25 bg-negative/10 px-3 py-2 text-sm text-negative">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={working}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Direct edit + delete icons at the end of a table row — either can be omitted. */
export function RowActionButtons({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  extra,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel: string;
  deleteLabel?: string;
  /** Extra row actions before edit/delete — e.g. a "Restore" button for an archived row. */
  extra?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-1">
      {extra}
      {onEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={editLabel}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-negative/10 hover:text-negative"
          aria-label={deleteLabel ?? 'Delete'}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
