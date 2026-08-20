'use client';

import { BadgeCheck, Banknote, Plus, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog, RowActionButtons } from '@/components/confirm-dialog';
import { Column, DataTable } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import {
  DateRangeFilter,
  FilterBar,
  FilterSelect,
  ResetFilters,
  SearchInput,
  optionsFrom,
} from '@/components/filter-bar';
import { Field, FieldRow, FormSheet } from '@/components/form-sheet';
import { PageHeader } from '@/components/page-header';
import { DistributionStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMoney } from '@/lib/format';
import { useList, useResource } from '@/lib/use-list';
import {
  DISTRIBUTION_STATUS_LABELS,
  type Distribution,
  type DistributionStatus,
  type InvestmentOption,
} from '@/lib/types';

interface DistributionDraft {
  investmentId: string;
  declaredDate: string;
  paymentDate: string;
  grossAmount: string;
  withholdingTax: string;
  notes: string;
}

const EMPTY_DRAFT: DistributionDraft = {
  investmentId: '',
  declaredDate: new Date().toISOString().slice(0, 10),
  paymentDate: '',
  grossAmount: '',
  withholdingTax: '',
  notes: '',
};

/**
 * The workflow the API enforces. Mirrored here so the row menu only offers moves
 * that will actually be accepted.
 */
const NEXT_STEPS: Record<DistributionStatus, DistributionStatus[]> = {
  DECLARED: ['APPROVED'],
  APPROVED: ['PAID', 'DECLARED'],
  PAID: ['APPROVED'],
};

const STEP_LABELS: Record<DistributionStatus, string> = {
  DECLARED: 'Send back to declared',
  APPROVED: 'Approve',
  PAID: 'Mark as paid',
};

const STEP_ICONS: Record<DistributionStatus, typeof BadgeCheck> = {
  DECLARED: Undo2,
  APPROVED: BadgeCheck,
  PAID: Banknote,
};

export default function DistributionsPage(): JSX.Element {
  const { canEdit, isAdmin } = useAuth();
  const list = useList<Distribution>('/distributions');
  const { data: investments } = useResource<InvestmentOption[]>('/investments/options');

  const [editing, setEditing] = useState<Distribution | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<DistributionDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<Distribution | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, investmentId: investments?.[0]?.id ?? '' });
    setFormOpen(true);
  };

  const openEdit = (distribution: Distribution): void => {
    setEditing(distribution);
    setDraft({
      investmentId: distribution.investmentId,
      declaredDate: distribution.declaredDate.slice(0, 10),
      paymentDate: distribution.paymentDate?.slice(0, 10) ?? '',
      grossAmount: String(distribution.grossAmount),
      withholdingTax: String(distribution.withholdingTax),
      notes: distribution.notes ?? '',
    });
    setFormOpen(true);
  };

  const save = async (): Promise<void> => {
    const shared = {
      declaredDate: draft.declaredDate,
      paymentDate: draft.paymentDate || undefined,
      grossAmount: Number(draft.grossAmount),
      withholdingTax: draft.withholdingTax === '' ? 0 : Number(draft.withholdingTax),
      notes: draft.notes.trim() || undefined,
    };

    // The API refuses to reassign a distribution to a different investment, so
    // the id is only sent on create.
    if (editing) await api.patch(`/distributions/${editing.id}`, shared);
    else await api.post('/distributions', { ...shared, investmentId: draft.investmentId });

    list.refresh();
  };

  const moveTo = async (
    distribution: Distribution,
    status: DistributionStatus,
  ): Promise<void> => {
    try {
      await api.patch(`/distributions/${distribution.id}/status`, { status });
      toast.success(`Distribution moved to ${DISTRIBUTION_STATUS_LABELS[status].toLowerCase()}.`);
      list.refresh();
      setFormOpen(false);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.detail : 'Could not change that status.');
    }
  };

  const netPreview =
    draft.grossAmount === ''
      ? null
      : Number(draft.grossAmount) - (draft.withholdingTax === '' ? 0 : Number(draft.withholdingTax));

  const columns: Array<Column<Distribution>> = [
    {
      key: 'declaredDate',
      header: 'Declared',
      sortable: true,
      render: (distribution) => (
        <span className="whitespace-nowrap tabular">{formatDate(distribution.declaredDate)}</span>
      ),
    },
    {
      key: 'investment',
      header: 'Investment',
      render: (distribution) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{distribution.investment.asset.name}</p>
          <p className="max-w-[300px] truncate text-xs text-muted-foreground">
            {distribution.investment.vehicleName}
          </p>
        </div>
      ),
    },
    {
      key: 'grossAmount',
      header: 'Gross',
      sortable: true,
      align: 'right',
      render: (distribution) => formatMoney(distribution.grossAmount),
    },
    {
      key: 'withholdingTax',
      header: 'Withholding',
      align: 'right',
      render: (distribution) =>
        distribution.withholdingTax > 0 ? (
          <span className="text-muted-foreground">
            −{formatMoney(distribution.withholdingTax)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'netAmount',
      header: 'Net to LPs',
      sortable: true,
      align: 'right',
      render: (distribution) => (
        <span className="font-medium">{formatMoney(distribution.netAmount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (distribution) => <DistributionStatusBadge status={distribution.status} />,
    },
    {
      key: 'paymentDate',
      header: 'Paid',
      sortable: true,
      align: 'right',
      render: (distribution) => (
        <span className="text-muted-foreground">{formatDate(distribution.paymentDate)}</span>
      ),
    },
  ];

  const filtersActive = Boolean(
    list.filters.search ||
      list.filters.status ||
      list.filters.investmentId ||
      list.filters.from ||
      list.filters.to,
  );

  return (
    <>
      <PageHeader
        title="Distributions"
        description="LP payouts through the declared → approved → paid workflow. Net is always gross less withholding tax."
      >
        <ExportButton<Distribution>
          path="/distributions"
          filters={list.effectiveFilters}
          filename="distributions.csv"
          headers={['Declared', 'Position', 'Status', 'Gross', 'Withholding', 'Net', 'Paid']}
          toRow={(distribution) => [
            formatDate(distribution.declaredDate),
            distribution.investment.vehicleName,
            DISTRIBUTION_STATUS_LABELS[distribution.status],
            distribution.grossAmount,
            distribution.withholdingTax,
            distribution.netAmount,
            distribution.paymentDate ? formatDate(distribution.paymentDate) : '',
          ]}
        />
        {canEdit ? (
          <Button
            size="sm"
            onClick={openCreate}
            disabled={!investments || investments.length === 0}
          >
            <Plus className="h-4 w-4" />
            New distribution
          </Button>
        ) : null}
      </PageHeader>

      <FilterBar>
        <SearchInput
          value={(list.filters.search as string) ?? ''}
          onChange={(value) => list.setFilter('search', value)}
          placeholder="Search notes or investment"
        />
        <FilterSelect
          value={list.filters.status as string | undefined}
          onChange={(value) => list.setFilter('status', value)}
          anyLabel="Any status"
          options={optionsFrom(DISTRIBUTION_STATUS_LABELS)}
        />
        <FilterSelect
          value={list.filters.investmentId as string | undefined}
          onChange={(value) => list.setFilter('investmentId', value)}
          anyLabel="Any investment"
          className="w-full sm:w-[240px]"
          options={(investments ?? []).map((investment) => ({
            value: investment.id,
            label: investment.label,
          }))}
        />
        <DateRangeFilter
          from={list.filters.from as string | undefined}
          to={list.filters.to as string | undefined}
          onChange={(key, value) => list.setFilter(key, value)}
        />
        <ResetFilters
          active={filtersActive}
          onReset={() => {
            for (const key of ['search', 'status', 'investmentId', 'from', 'to']) {
              list.setFilter(key, undefined);
            }
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(distribution) => distribution.id}
        meta={list.meta}
        loading={list.loading}
        initialLoading={list.initialLoading}
        error={list.error}
        sortBy={list.filters.sortBy as string | undefined}
        sortDir={list.filters.sortDir as string | undefined}
        onSort={list.toggleSort}
        onPage={list.setPage}
        onRetry={list.refresh}
        emptyTitle="No distributions found"
        emptyDescription={
          filtersActive
            ? 'Nothing matches these filters.'
            : 'Declare a distribution when a position returns capital.'
        }
        rowActions={
          canEdit
            ? (distribution) => (
                <RowActionButtons
                  onEdit={() => openEdit(distribution)}
                  onDelete={
                    isAdmin && distribution.status !== 'PAID'
                      ? () => setDeleting(distribution)
                      : undefined
                  }
                  editLabel="Edit distribution"
                  deleteLabel="Delete distribution"
                />
              )
            : undefined
        }
      />

      <FormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit distribution' : 'New distribution'}
        description="The net amount is derived, never entered — it is what actually reaches the LPs."
        submitLabel={editing ? 'Save changes' : 'Declare distribution'}
        successMessage={editing ? 'Distribution updated.' : 'Distribution declared.'}
        onSubmit={save}
      >
        {editing && canEdit && NEXT_STEPS[editing.status].length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-md border bg-muted/40 p-3">
            {NEXT_STEPS[editing.status].map((status) => {
              const Icon = STEP_ICONS[status];
              return (
                <Button
                  key={status}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void moveTo(editing, status)}
                >
                  <Icon className="h-4 w-4" />
                  {STEP_LABELS[status]}
                </Button>
              );
            })}
          </div>
        ) : null}

        {editing ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {editing.investment.asset.name}
            <span className="block text-xs text-muted-foreground">
              {editing.investment.vehicleName} · the investment cannot be reassigned
            </span>
          </p>
        ) : (
          <Field label="Investment" htmlFor="distribution-investment">
            <Select
              value={draft.investmentId}
              onValueChange={(value) => setDraft({ ...draft, investmentId: value })}
            >
              <SelectTrigger id="distribution-investment">
                <SelectValue placeholder="Choose an investment" />
              </SelectTrigger>
              <SelectContent>
                {(investments ?? []).map((investment) => (
                  <SelectItem key={investment.id} value={investment.id}>
                    {investment.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <FieldRow>
          <Field label="Declared on" htmlFor="distribution-declared">
            <Input
              id="distribution-declared"
              type="date"
              required
              value={draft.declaredDate}
              onChange={(event) => setDraft({ ...draft, declaredDate: event.target.value })}
            />
          </Field>

          <Field
            label="Payment date"
            htmlFor="distribution-payment"
            hint="Optional until it is paid."
          >
            <Input
              id="distribution-payment"
              type="date"
              value={draft.paymentDate}
              onChange={(event) => setDraft({ ...draft, paymentDate: event.target.value })}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Gross (USD)" htmlFor="distribution-gross">
            <Input
              id="distribution-gross"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={draft.grossAmount}
              onChange={(event) => setDraft({ ...draft, grossAmount: event.target.value })}
            />
          </Field>

          <Field label="Withholding tax (USD)" htmlFor="distribution-withholding">
            <Input
              id="distribution-withholding"
              type="number"
              min={0}
              step="0.01"
              className="tabular"
              value={draft.withholdingTax}
              onChange={(event) => setDraft({ ...draft, withholdingTax: event.target.value })}
            />
          </Field>
        </FieldRow>

        {netPreview !== null ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Net to LPs:{' '}
            <span className="font-medium tabular">{formatMoney(netPreview)}</span>
            {netPreview < 0 ? (
              <span className="mt-1 block text-xs text-negative">
                Withholding tax cannot exceed the gross amount.
              </span>
            ) : null}
          </p>
        ) : null}

        <Field label="Notes" htmlFor="distribution-notes">
          <Textarea
            id="distribution-notes"
            maxLength={500}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </Field>
      </FormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this distribution?"
        description="Only a distribution that has not been paid can be deleted. A paid one must be reversed instead."
        successMessage="Distribution deleted."
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/distributions/${deleting.id}`);
          list.refresh();
        }}
      />
    </>
  );
}
