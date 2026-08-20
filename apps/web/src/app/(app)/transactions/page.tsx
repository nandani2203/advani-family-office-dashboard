'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog, RowActionButtons } from '@/components/confirm-dialog';
import { Column, DataTable } from '@/components/data-table';
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
import { TransactionStatusBadge } from '@/components/status-badge';
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
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMoney } from '@/lib/format';
import { useList, useResource } from '@/lib/use-list';
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  type InvestmentOption,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface TransactionDraft {
  investmentId: string;
  type: TransactionType;
  amount: string;
  occurredAt: string;
  status: TransactionStatus;
  reference: string;
  description: string;
}

const EMPTY_DRAFT: TransactionDraft = {
  investmentId: '',
  type: 'CAPITAL_CALL',
  amount: '',
  occurredAt: new Date().toISOString().slice(0, 10),
  status: 'SETTLED',
  reference: '',
  description: '',
};

const DIRECTION_LABELS = { INFLOW: 'Inflow', OUTFLOW: 'Outflow' } as const;

/** Mirrors DIRECTION_BY_TYPE on the API, so the form can preview the direction. */
const DIRECTION_BY_TYPE: Record<TransactionType, 'INFLOW' | 'OUTFLOW'> = {
  CAPITAL_CALL: 'OUTFLOW',
  PURCHASE: 'OUTFLOW',
  FEE: 'OUTFLOW',
  SALE: 'INFLOW',
  DIVIDEND: 'INFLOW',
  INTEREST: 'INFLOW',
};

export default function TransactionsPage(): JSX.Element {
  const { canEdit, isAdmin } = useAuth();
  const list = useList<Transaction>('/transactions');
  const { data: investments } = useResource<InvestmentOption[]>('/investments/options');

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, investmentId: investments?.[0]?.id ?? '' });
    setFormOpen(true);
  };

  const openEdit = (transaction: Transaction): void => {
    setEditing(transaction);
    setDraft({
      investmentId: transaction.investmentId,
      type: transaction.type,
      amount: String(transaction.amount),
      occurredAt: transaction.occurredAt.slice(0, 10),
      status: transaction.status,
      reference: transaction.reference ?? '',
      description: transaction.description ?? '',
    });
    setFormOpen(true);
  };

  const save = async (): Promise<void> => {
    const payload = {
      investmentId: draft.investmentId,
      type: draft.type,
      amount: Number(draft.amount),
      occurredAt: draft.occurredAt,
      status: draft.status,
      reference: draft.reference.trim() || undefined,
      description: draft.description.trim() || undefined,
    };

    if (editing) await api.patch(`/transactions/${editing.id}`, payload);
    else await api.post('/transactions', payload);

    list.refresh();
  };

  const columns: Array<Column<Transaction>> = [
    {
      key: 'occurredAt',
      header: 'Date',
      sortable: true,
      render: (transaction) => (
        <span className="whitespace-nowrap tabular">{formatDate(transaction.occurredAt)}</span>
      ),
    },
    {
      key: 'investment',
      header: 'Investment',
      render: (transaction) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{transaction.investment.asset.name}</p>
          <p className="max-w-[300px] truncate text-xs text-muted-foreground">
            {transaction.investment.vehicleName}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (transaction) => (
        <div className="flex flex-col">
          <span className="whitespace-nowrap">{TRANSACTION_TYPE_LABELS[transaction.type]}</span>
          <span className="text-xs text-muted-foreground">
            {DIRECTION_LABELS[transaction.direction]}
          </span>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (transaction) =>
        transaction.reference ? (
          <span className="font-mono text-xs">{transaction.reference}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (transaction) => <TransactionStatusBadge status={transaction.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      render: (transaction) => (
        <span
          className={cn(
            'font-medium',
            // A voided row is struck through rather than hidden: it happened, and
            // then it was reversed.
            transaction.status === 'VOID' && 'text-muted-foreground line-through',
            transaction.status !== 'VOID' && transaction.direction === 'INFLOW' && 'text-positive',
          )}
        >
          {transaction.direction === 'INFLOW' ? '+' : '−'}
          {formatMoney(transaction.amount)}
        </span>
      ),
    },
  ];

  const filtersActive = Boolean(
    list.filters.search ||
      list.filters.type ||
      list.filters.status ||
      list.filters.investmentId ||
      list.filters.from ||
      list.filters.to,
  );

  return (
    <>
      <PageHeader
        title="Transactions"
        description="The cashflow ledger — capital calls, purchases, sales, fees and income. Voided entries stay on the record but are excluded from every total."
      >
        {canEdit ? (
          <Button
            size="sm"
            onClick={openCreate}
            disabled={!investments || investments.length === 0}
          >
            <Plus className="h-4 w-4" />
            New transaction
          </Button>
        ) : null}
      </PageHeader>

      <FilterBar>
        <SearchInput
          value={(list.filters.search as string) ?? ''}
          onChange={(value) => list.setFilter('search', value)}
          placeholder="Search description or reference"
        />
        <FilterSelect
          value={list.filters.type as string | undefined}
          onChange={(value) => list.setFilter('type', value)}
          anyLabel="Any type"
          options={optionsFrom(TRANSACTION_TYPE_LABELS)}
        />
        <FilterSelect
          value={list.filters.status as string | undefined}
          onChange={(value) => list.setFilter('status', value)}
          anyLabel="Any status"
          options={optionsFrom(TRANSACTION_STATUS_LABELS)}
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
            for (const key of ['search', 'type', 'status', 'investmentId', 'from', 'to']) {
              list.setFilter(key, undefined);
            }
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(transaction) => transaction.id}
        meta={list.meta}
        loading={list.loading}
        initialLoading={list.initialLoading}
        error={list.error}
        sortBy={list.filters.sortBy as string | undefined}
        sortDir={list.filters.sortDir as string | undefined}
        onSort={list.toggleSort}
        onPage={list.setPage}
        onRetry={list.refresh}
        emptyTitle="No transactions found"
        emptyDescription={
          filtersActive
            ? 'Nothing matches these filters. Try widening the date range.'
            : 'Record the money that moves in and out of each position.'
        }
        rowActions={
          canEdit
            ? (transaction) => (
                <RowActionButtons
                  onEdit={() => openEdit(transaction)}
                  onDelete={isAdmin ? () => setDeleting(transaction) : undefined}
                  editLabel="Edit transaction"
                  deleteLabel="Delete transaction"
                />
              )
            : undefined
        }
      />

      <FormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit transaction' : 'New transaction'}
        description="Direction follows the type — calls, purchases and fees go out; sales, dividends and interest come in."
        submitLabel={editing ? 'Save changes' : 'Record transaction'}
        successMessage={editing ? 'Transaction updated.' : 'Transaction recorded.'}
        onSubmit={save}
      >
        <Field label="Investment" htmlFor="transaction-investment">
          <Select
            value={draft.investmentId}
            onValueChange={(value) => setDraft({ ...draft, investmentId: value })}
          >
            <SelectTrigger id="transaction-investment">
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

        <FieldRow>
          <Field
            label="Type"
            htmlFor="transaction-type"
            hint={`Recorded as an ${DIRECTION_LABELS[DIRECTION_BY_TYPE[draft.type]].toLowerCase()}.`}
          >
            <Select
              value={draft.type}
              onValueChange={(value) => setDraft({ ...draft, type: value as TransactionType })}
            >
              <SelectTrigger id="transaction-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(TRANSACTION_TYPE_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" htmlFor="transaction-status">
            <Select
              value={draft.status}
              onValueChange={(value) => setDraft({ ...draft, status: value as TransactionStatus })}
            >
              <SelectTrigger id="transaction-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(TRANSACTION_STATUS_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Amount (USD)" htmlFor="transaction-amount">
            <Input
              id="transaction-amount"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </Field>

          <Field label="Occurred on" htmlFor="transaction-date">
            <Input
              id="transaction-date"
              type="date"
              required
              value={draft.occurredAt}
              onChange={(event) => setDraft({ ...draft, occurredAt: event.target.value })}
            />
          </Field>
        </FieldRow>

        <Field label="Reference" htmlFor="transaction-reference" hint="Wire or statement reference.">
          <Input
            id="transaction-reference"
            maxLength={80}
            value={draft.reference}
            onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
            placeholder="WIRE-2026-0814-08"
          />
        </Field>

        <Field label="Description" htmlFor="transaction-description">
          <Textarea
            id="transaction-description"
            maxLength={500}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>
      </FormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this transaction?"
        description="Consider setting it to Void instead — that keeps the record while removing it from every total."
        successMessage="Transaction deleted."
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/transactions/${deleting.id}`);
          list.refresh();
        }}
      />
    </>
  );
}
