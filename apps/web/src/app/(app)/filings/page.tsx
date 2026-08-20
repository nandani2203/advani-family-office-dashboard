'use client';

import { AlarmClock, Plus } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog, RowActionButtons } from '@/components/confirm-dialog';
import { Column, DataTable } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import {
  FilterBar,
  FilterSelect,
  ResetFilters,
  SearchInput,
  optionsFrom,
} from '@/components/filter-bar';
import { Field, FieldRow, FormSheet } from '@/components/form-sheet';
import { PageHeader } from '@/components/page-header';
import { FilingStatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
import { daysUntil, formatDate } from '@/lib/format';
import { useList, useResource } from '@/lib/use-list';
import {
  FILING_STATUS_LABELS,
  FILING_TYPE_LABELS,
  type Filing,
  type FilingStatus,
  type FilingType,
  type UserOption,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface FilingDraft {
  vehicleName: string;
  type: FilingType;
  jurisdiction: string;
  dueDate: string;
  status: FilingStatus;
  assigneeId: string;
  notes: string;
}

/** Radix Select needs a non-empty value, so "nobody" is a sentinel. */
const UNASSIGNED = '__unassigned__';

const EMPTY_DRAFT: FilingDraft = {
  vehicleName: '',
  type: 'KYC',
  jurisdiction: '',
  dueDate: new Date().toISOString().slice(0, 10),
  status: 'OPEN',
  assigneeId: UNASSIGNED,
  notes: '',
};

export default function FilingsPage(): JSX.Element {
  const { canEdit, isAdmin } = useAuth();
  const list = useList<Filing>('/filings');
  const { data: users } = useResource<UserOption[]>('/users/options');

  const [editing, setEditing] = useState<Filing | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<FilingDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<Filing | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (filing: Filing): void => {
    setEditing(filing);
    setDraft({
      vehicleName: filing.vehicleName,
      type: filing.type,
      jurisdiction: filing.jurisdiction ?? '',
      dueDate: filing.dueDate.slice(0, 10),
      status: filing.status,
      assigneeId: filing.assigneeId ?? UNASSIGNED,
      notes: filing.notes ?? '',
    });
    setFormOpen(true);
  };

  const save = async (): Promise<void> => {
    const payload = {
      vehicleName: draft.vehicleName.trim(),
      type: draft.type,
      jurisdiction: draft.jurisdiction.trim() || undefined,
      dueDate: draft.dueDate,
      status: draft.status,
      assigneeId: draft.assigneeId === UNASSIGNED ? undefined : draft.assigneeId,
      notes: draft.notes.trim() || undefined,
    };

    if (editing) await api.patch(`/filings/${editing.id}`, payload);
    else await api.post('/filings', payload);

    list.refresh();
  };

  const columns: Array<Column<Filing>> = [
    {
      key: 'dueDate',
      header: 'Due',
      sortable: true,
      render: (filing) => {
        const days = daysUntil(filing.dueDate);
        const closed = filing.status === 'CLOSED' || filing.status === 'SUBMITTED';
        const overdue = !closed && days !== null && days < 0;
        const imminent = !closed && days !== null && days >= 0 && days <= 7;

        return (
          <div className="whitespace-nowrap">
            <p className="font-medium tabular">{formatDate(filing.dueDate)}</p>
            <p
              className={cn(
                'text-xs tabular',
                overdue && 'font-medium text-negative',
                imminent && 'font-medium text-warning',
                !overdue && !imminent && 'text-muted-foreground',
              )}
            >
              {closed
                ? '—'
                : overdue
                  ? `${Math.abs(days as number)} days overdue`
                  : days === 0
                    ? 'today'
                    : `in ${days} days`}
            </p>
          </div>
        );
      },
    },
    {
      key: 'vehicleName',
      header: 'Vehicle',
      sortable: true,
      render: (filing) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{filing.vehicleName}</p>
          {filing.notes ? (
            <p className="max-w-[340px] truncate text-xs text-muted-foreground">{filing.notes}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (filing) => <Badge variant="outline">{FILING_TYPE_LABELS[filing.type]}</Badge>,
    },
    {
      key: 'jurisdiction',
      header: 'Jurisdiction',
      render: (filing) => filing.jurisdiction ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (filing) =>
        filing.assignee ? (
          <span className="whitespace-nowrap">
            {filing.assignee.name ?? filing.assignee.email}
          </span>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (filing) => <FilingStatusBadge status={filing.status} />,
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      align: 'right',
      render: (filing) => (
        <span className="text-muted-foreground">{formatDate(filing.submittedAt)}</span>
      ),
    },
  ];

  const dueSoon = list.filters.dueSoon === true;
  const filtersActive = Boolean(
    list.filters.search || list.filters.type || list.filters.status || dueSoon,
  );

  return (
    <>
      <PageHeader
        title="Filings"
        description="KYC refreshes, VAT returns, annual returns and tax work, soonest deadline first. This is the list that gets missed."
      >
        <ExportButton<Filing>
          path="/filings"
          filters={list.effectiveFilters}
          filename="filings.csv"
          headers={['Filing', 'Type', 'Jurisdiction', 'Status', 'Due', 'Submitted', 'Assignee']}
          toRow={(filing) => [
            filing.vehicleName,
            FILING_TYPE_LABELS[filing.type],
            filing.jurisdiction ?? '',
            FILING_STATUS_LABELS[filing.status],
            formatDate(filing.dueDate),
            filing.submittedAt ? formatDate(filing.submittedAt) : '',
            filing.assignee?.name ?? filing.assignee?.email ?? '',
          ]}
        />
        {canEdit ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New filing
          </Button>
        ) : null}
      </PageHeader>

      <FilterBar>
        <SearchInput
          value={(list.filters.search as string) ?? ''}
          onChange={(value) => list.setFilter('search', value)}
          placeholder="Search vehicle, jurisdiction or notes"
        />
        <FilterSelect
          value={list.filters.type as string | undefined}
          onChange={(value) => list.setFilter('type', value)}
          anyLabel="Any type"
          options={optionsFrom(FILING_TYPE_LABELS)}
        />
        <FilterSelect
          value={list.filters.status as string | undefined}
          onChange={(value) => list.setFilter('status', value)}
          anyLabel="Any status"
          options={optionsFrom(FILING_STATUS_LABELS)}
        />
        <Button
          variant={dueSoon ? 'default' : 'outline'}
          size="sm"
          aria-pressed={dueSoon}
          onClick={() => list.setFilter('dueSoon', dueSoon ? undefined : true)}
        >
          <AlarmClock className="h-4 w-4" />
          Due in 30 days
        </Button>
        <ResetFilters
          active={filtersActive}
          onReset={() => {
            for (const key of ['search', 'type', 'status', 'dueSoon']) {
              list.setFilter(key, undefined);
            }
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(filing) => filing.id}
        meta={list.meta}
        loading={list.loading}
        initialLoading={list.initialLoading}
        error={list.error}
        sortBy={list.filters.sortBy as string | undefined}
        sortDir={list.filters.sortDir as string | undefined}
        onSort={list.toggleSort}
        onPage={list.setPage}
        onRetry={list.refresh}
        emptyTitle="No filings found"
        emptyDescription={
          filtersActive
            ? 'Nothing matches these filters.'
            : 'Track a deadline so it shows up on the overview before it is late.'
        }
        rowActions={
          canEdit
            ? (filing) => (
                <RowActionButtons
                  onEdit={() => openEdit(filing)}
                  onDelete={isAdmin ? () => setDeleting(filing) : undefined}
                  editLabel={`Edit ${filing.vehicleName}`}
                  deleteLabel={`Delete ${filing.vehicleName}`}
                />
              )
            : undefined
        }
      />

      <FormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit filing' : 'New filing'}
        description="Moving a filing to submitted or closed stamps the submission date; reopening it clears the stamp."
        submitLabel={editing ? 'Save changes' : 'Create filing'}
        successMessage={editing ? 'Filing updated.' : 'Filing created.'}
        onSubmit={save}
      >
        <Field label="Vehicle or entity" htmlFor="filing-vehicle">
          <Input
            id="filing-vehicle"
            required
            maxLength={160}
            value={draft.vehicleName}
            onChange={(event) => setDraft({ ...draft, vehicleName: event.target.value })}
            placeholder="Advani Holdings DIFC Ltd"
          />
        </Field>

        <FieldRow>
          <Field label="Type" htmlFor="filing-type">
            <Select
              value={draft.type}
              onValueChange={(value) => setDraft({ ...draft, type: value as FilingType })}
            >
              <SelectTrigger id="filing-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(FILING_TYPE_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" htmlFor="filing-status">
            <Select
              value={draft.status}
              onValueChange={(value) => setDraft({ ...draft, status: value as FilingStatus })}
            >
              <SelectTrigger id="filing-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(FILING_STATUS_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Jurisdiction" htmlFor="filing-jurisdiction">
            <Input
              id="filing-jurisdiction"
              maxLength={80}
              value={draft.jurisdiction}
              onChange={(event) => setDraft({ ...draft, jurisdiction: event.target.value })}
              placeholder="DIFC, UAE"
            />
          </Field>

          <Field label="Due date" htmlFor="filing-due">
            <Input
              id="filing-due"
              type="date"
              required
              value={draft.dueDate}
              onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
            />
          </Field>
        </FieldRow>

        <Field label="Assignee" htmlFor="filing-assignee">
          <Select
            value={draft.assigneeId}
            onValueChange={(value) => setDraft({ ...draft, assigneeId: value })}
          >
            <SelectTrigger id="filing-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {(users ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name ?? user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Notes" htmlFor="filing-notes">
          <Textarea
            id="filing-notes"
            maxLength={1000}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            placeholder="What needs doing, and who is waiting on what."
          />
        </Field>
      </FormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the ${deleting ? FILING_TYPE_LABELS[deleting.type] : ''} filing?`}
        description="This removes the deadline from the tracker. Close it instead if the work is done."
        successMessage="Filing deleted."
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/filings/${deleting.id}`);
          list.refresh();
        }}
      />
    </>
  );
}
