'use client';

import { Loader2 } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  /** Resolves when the write succeeds; throwing surfaces the API's message. */
  onSubmit: () => Promise<void>;
  successMessage: string;
  children: ReactNode;
}

/**
 * The create/edit shell every entity form shares: submit state, a single place
 * where an API error becomes readable text, and a toast on success.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  successMessage,
  children,
}: FormSheetProps): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit();
      toast.success(successMessage);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : 'Could not save those changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Discard a stale error so reopening the form is a clean slate.
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-4">{children}</div>

          {error ? (
            <p className="rounded-md border border-negative/25 bg-negative/10 px-3 py-2 text-sm text-negative">
              {error}
            </p>
          ) : null}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }): JSX.Element {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
