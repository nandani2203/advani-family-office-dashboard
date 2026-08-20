'use client';

import { Briefcase, LineChart, Plus, TrendingUp, Wallet } from 'lucide-react';
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
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { InvestmentStatusBadge } from '@/components/status-badge';
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
import { ValuationCalculator } from '@/components/valuation-calculator';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedPercent,
} from '@/lib/format';
import { useList, useResource } from '@/lib/use-list';
import {
  ASSET_TYPE_LABELS,
  INVESTMENT_STATUS_LABELS,
  VEHICLE_LABELS,
  type AssetOption,
  type Investment,
  type InvestmentStatus,
  type InvestmentSummary,
  type VehicleType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface InvestmentDraft {
  assetId: string;
  vehicle: VehicleType;
  vehicleName: string;
  committedAmount: string;
  investedAmount: string;
  costBasis: string;
  currentValuation: string;
  ownershipPct: string;
  status: InvestmentStatus;
  investedAt: string;
  notes: string;
}

const EMPTY_DRAFT: InvestmentDraft = {
  assetId: '',
  vehicle: 'SPV',
  vehicleName: '',
  committedAmount: '',
  investedAmount: '',
  costBasis: '',
  currentValuation: '',
  ownershipPct: '',
  status: 'ACTIVE',
  investedAt: new Date().toISOString().slice(0, 10),
  notes: '',
};

/** `2024-04-18T00:00:00.000Z` → `2024-04-18` for a date input. */
const toDateInput = (value: string): string => value.slice(0, 10);

export default function InvestmentsPage(): JSX.Element {
  const { canEdit, isAdmin } = useAuth();
  const list = useList<Investment>('/investments');
  const { data: assets } = useResource<AssetOption[]>('/assets/options');
  const { data: summary, loading: summaryLoading } = useResource<InvestmentSummary>(
    '/investments/summary',
    { query: list.effectiveFilters },
  );

  const [editing, setEditing] = useState<Investment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<InvestmentDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  const [marking, setMarking] = useState<Investment | null>(null);
  const [mark, setMark] = useState({ asOf: '', value: '', source: '' });

  const openCreate = (): void => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, assetId: assets?.[0]?.id ?? '' });
    setFormOpen(true);
  };

  const openEdit = (investment: Investment): void => {
    setEditing(investment);
    setDraft({
      assetId: investment.assetId,
      vehicle: investment.vehicle,
      vehicleName: investment.vehicleName,
      committedAmount: String(investment.committedAmount),
      investedAmount: String(investment.investedAmount),
      costBasis: String(investment.costBasis),
      currentValuation: String(investment.currentValuation),
      ownershipPct: investment.ownershipPct === null ? '' : String(investment.ownershipPct),
      status: investment.status,
      investedAt: toDateInput(investment.investedAt),
      notes: investment.notes ?? '',
    });
    setFormOpen(true);
  };

  const openMark = (investment: Investment): void => {
    setMarking(investment);
    setMark({
      asOf: new Date().toISOString().slice(0, 10),
      value: String(investment.currentValuation),
      source: '',
    });
  };

  const save = async (): Promise<void> => {
    const payload = {
      assetId: draft.assetId,
      vehicle: draft.vehicle,
      vehicleName: draft.vehicleName.trim(),
      committedAmount: Number(draft.committedAmount),
      investedAmount: Number(draft.investedAmount),
      costBasis: Number(draft.costBasis),
      currentValuation: Number(draft.currentValuation),
      ownershipPct: draft.ownershipPct === '' ? undefined : Number(draft.ownershipPct),
      status: draft.status,
      investedAt: draft.investedAt,
      notes: draft.notes.trim() || undefined,
    };

    if (editing) await api.patch(`/investments/${editing.id}`, payload);
    else await api.post('/investments', payload);

    list.refresh();
  };

  const columns: Array<Column<Investment>> = [
    {
      key: 'vehicleName',
      header: 'Position',
      sortable: true,
      render: (investment) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{investment.asset.name}</p>
          <p className="max-w-[320px] truncate text-xs text-muted-foreground">
            {investment.vehicleName}
          </p>
        </div>
      ),
    },
    {
      key: 'assetType',
      header: 'Class',
      render: (investment) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="outline">{ASSET_TYPE_LABELS[investment.asset.type]}</Badge>
          <span className="text-xs text-muted-foreground">
            {VEHICLE_LABELS[investment.vehicle]}
          </span>
        </div>
      ),
    },
    {
      key: 'costBasis',
      header: 'Cost basis',
      align: 'right',
      render: (investment) => formatMoney(investment.costBasis),
    },
    {
      key: 'currentValuation',
      header: 'Valuation',
      sortable: true,
      align: 'right',
      render: (investment) => (
        <span className="font-medium">{formatMoney(investment.currentValuation)}</span>
      ),
    },
    {
      key: 'gain',
      header: 'Gain',
      align: 'right',
      render: (investment) => {
        const gain = investment.currentValuation - investment.costBasis;
        const pct = investment.costBasis > 0 ? (gain / investment.costBasis) * 100 : 0;

        return (
          <div
            className={cn(
              'flex flex-col items-end',
              gain > 0 && 'text-positive',
              gain < 0 && 'text-negative',
            )}
          >
            <span className="font-medium">{formatMoney(gain)}</span>
            <span className="text-xs">{formatSignedPercent(pct)}</span>
          </div>
        );
      },
    },
    {
      key: 'ownershipPct',
      header: 'Ownership',
      align: 'right',
      render: (investment) =>
        investment.ownershipPct === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatPercent(investment.ownershipPct, 2)
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (investment) => <InvestmentStatusBadge status={investment.status} />,
    },
    {
      key: 'investedAt',
      header: 'Invested',
      sortable: true,
      align: 'right',
      render: (investment) => (
        <span className="text-muted-foreground">{formatDate(investment.investedAt)}</span>
      ),
    },
  ];

  const filtersActive = Boolean(
    list.filters.search || list.filters.status || list.filters.vehicle || list.filters.assetId,
  );

  return (
    <>
      <PageHeader
        title="Investments"
        description="Every position we hold, through an SPV, a fund or directly. The source of truth for cost basis and ownership."
      >
        <ExportButton<Investment>
          path="/investments"
          filters={list.effectiveFilters}
          filename="investments.csv"
          headers={[
            'Asset',
            'Position',
            'Class',
            'Vehicle',
            'Cost basis',
            'Valuation',
            'Ownership %',
            'Status',
            'Invested',
          ]}
          toRow={(investment) => [
            investment.asset.name,
            investment.vehicleName,
            ASSET_TYPE_LABELS[investment.asset.type],
            VEHICLE_LABELS[investment.vehicle],
            investment.costBasis,
            investment.currentValuation,
            investment.ownershipPct ?? '',
            INVESTMENT_STATUS_LABELS[investment.status],
            formatDate(investment.investedAt),
          ]}
        />
        <ValuationCalculator positions={list.rows} />
        {canEdit ? (
          <Button size="sm" onClick={openCreate} disabled={!assets || assets.length === 0}>
            <Plus className="h-4 w-4" />
            New investment
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLoading || !summary ? (
          Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Valuation"
              value={formatCompactMoney(summary.totalValuation)}
              hint="Matching the filters below"
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatCard
              label="Cost basis"
              value={formatCompactMoney(summary.totalCostBasis)}
              icon={<Briefcase className="h-4 w-4" />}
            />
            <StatCard
              label="Unrealised gain"
              value={formatCompactMoney(summary.unrealisedGain)}
              delta={{
                text: formatSignedPercent(summary.unrealisedGainPct),
                direction:
                  summary.unrealisedGain > 0 ? 'up' : summary.unrealisedGain < 0 ? 'down' : 'flat',
              }}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Positions"
              value={formatNumber(summary.count)}
              hint={`${formatNumber(summary.activeCount)} active`}
              icon={<LineChart className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <FilterBar>
        <SearchInput
          value={(list.filters.search as string) ?? ''}
          onChange={(value) => list.setFilter('search', value)}
          placeholder="Search vehicle or asset"
        />
        <FilterSelect
          value={list.filters.status as string | undefined}
          onChange={(value) => list.setFilter('status', value)}
          anyLabel="Any status"
          options={optionsFrom(INVESTMENT_STATUS_LABELS)}
        />
        <FilterSelect
          value={list.filters.vehicle as string | undefined}
          onChange={(value) => list.setFilter('vehicle', value)}
          anyLabel="Any vehicle"
          options={optionsFrom(VEHICLE_LABELS)}
        />
        <FilterSelect
          value={list.filters.assetId as string | undefined}
          onChange={(value) => list.setFilter('assetId', value)}
          anyLabel="Any asset"
          className="w-full sm:w-[220px]"
          options={(assets ?? []).map((asset) => ({ value: asset.id, label: asset.name }))}
        />
        <ResetFilters
          active={filtersActive}
          onReset={() => {
            for (const key of ['search', 'status', 'vehicle', 'assetId']) {
              list.setFilter(key, undefined);
            }
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(investment) => investment.id}
        meta={list.meta}
        loading={list.loading}
        initialLoading={list.initialLoading}
        error={list.error}
        sortBy={list.filters.sortBy as string | undefined}
        sortDir={list.filters.sortDir as string | undefined}
        onSort={list.toggleSort}
        onPage={list.setPage}
        onRetry={list.refresh}
        emptyTitle="No investments found"
        emptyDescription={
          filtersActive
            ? 'Nothing matches these filters. Try clearing them.'
            : 'Record the first position to start tracking the portfolio.'
        }
        rowActions={
          canEdit
            ? (investment) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Record a valuation for ${investment.vehicleName}`}
                    onClick={() => openMark(investment)}
                  >
                    <LineChart className="h-4 w-4" />
                  </Button>
                  <RowActionButtons
                    onEdit={() => openEdit(investment)}
                    onDelete={isAdmin ? () => setDeleting(investment) : undefined}
                    editLabel={`Edit ${investment.vehicleName}`}
                    deleteLabel={`Delete ${investment.vehicleName}`}
                  />
                </div>
              )
            : undefined
        }
      />

      <FormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit investment' : 'New investment'}
        description="All amounts are in USD. Cost basis drives the unrealised-gain figures on the overview."
        submitLabel={editing ? 'Save changes' : 'Create investment'}
        successMessage={editing ? 'Investment updated.' : 'Investment created.'}
        onSubmit={save}
      >
        <Field label="Asset" htmlFor="investment-asset">
          <Select
            value={draft.assetId}
            onValueChange={(value) => setDraft({ ...draft, assetId: value })}
          >
            <SelectTrigger id="investment-asset">
              <SelectValue placeholder="Choose an asset" />
            </SelectTrigger>
            <SelectContent>
              {(assets ?? []).map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.name} · {ASSET_TYPE_LABELS[asset.type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <FieldRow>
          <Field label="Vehicle" htmlFor="investment-vehicle">
            <Select
              value={draft.vehicle}
              onValueChange={(value) => setDraft({ ...draft, vehicle: value as VehicleType })}
            >
              <SelectTrigger id="investment-vehicle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(VEHICLE_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" htmlFor="investment-status">
            <Select
              value={draft.status}
              onValueChange={(value) => setDraft({ ...draft, status: value as InvestmentStatus })}
            >
              <SelectTrigger id="investment-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(INVESTMENT_STATUS_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <Field
          label="Vehicle name"
          htmlFor="investment-vehicle-name"
          hint="How the ops team refers to this position."
        >
          <Input
            id="investment-vehicle-name"
            required
            maxLength={160}
            value={draft.vehicleName}
            onChange={(event) => setDraft({ ...draft, vehicleName: event.target.value })}
            placeholder="Advani SPV 07 — SpaceX (2024)"
          />
        </Field>

        <FieldRow>
          <Field label="Committed (USD)" htmlFor="investment-committed">
            <Input
              id="investment-committed"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={draft.committedAmount}
              onChange={(event) => setDraft({ ...draft, committedAmount: event.target.value })}
            />
          </Field>

          <Field label="Invested (USD)" htmlFor="investment-invested">
            <Input
              id="investment-invested"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={draft.investedAmount}
              onChange={(event) => setDraft({ ...draft, investedAmount: event.target.value })}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Cost basis (USD)" htmlFor="investment-cost">
            <Input
              id="investment-cost"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={draft.costBasis}
              onChange={(event) => setDraft({ ...draft, costBasis: event.target.value })}
            />
          </Field>

          <Field label="Valuation (USD)" htmlFor="investment-valuation">
            <Input
              id="investment-valuation"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={draft.currentValuation}
              onChange={(event) => setDraft({ ...draft, currentValuation: event.target.value })}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Ownership %" htmlFor="investment-ownership" hint="Optional, 0–100.">
            <Input
              id="investment-ownership"
              type="number"
              min={0}
              max={100}
              step="0.0001"
              className="tabular"
              value={draft.ownershipPct}
              onChange={(event) => setDraft({ ...draft, ownershipPct: event.target.value })}
            />
          </Field>

          <Field label="Invested on" htmlFor="investment-date">
            <Input
              id="investment-date"
              type="date"
              required
              value={draft.investedAt}
              onChange={(event) => setDraft({ ...draft, investedAt: event.target.value })}
            />
          </Field>
        </FieldRow>

        <Field label="Notes" htmlFor="investment-notes">
          <Textarea
            id="investment-notes"
            maxLength={2000}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </Field>
      </FormSheet>

      <FormSheet
        open={marking !== null}
        onOpenChange={(open) => !open && setMarking(null)}
        title="Record a valuation"
        description="This also becomes the position's current mark, so the portfolio total and the history never disagree."
        submitLabel="Record mark"
        successMessage="Valuation recorded."
        onSubmit={async () => {
          if (!marking) return;
          await api.post(`/investments/${marking.id}/valuations`, {
            asOf: mark.asOf,
            value: Number(mark.value),
            source: mark.source.trim() || undefined,
          });
          list.refresh();
        }}
      >
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {marking?.asset.name}
          <span className="block text-xs text-muted-foreground">{marking?.vehicleName}</span>
        </p>

        <FieldRow>
          <Field label="As of" htmlFor="mark-date">
            <Input
              id="mark-date"
              type="date"
              required
              value={mark.asOf}
              onChange={(event) => setMark({ ...mark, asOf: event.target.value })}
            />
          </Field>

          <Field label="Value (USD)" htmlFor="mark-value">
            <Input
              id="mark-value"
              type="number"
              min={0}
              step="0.01"
              required
              className="tabular"
              value={mark.value}
              onChange={(event) => setMark({ ...mark, value: event.target.value })}
            />
          </Field>
        </FieldRow>

        <Field label="Source" htmlFor="mark-source" hint="Where this mark came from.">
          <Input
            id="mark-source"
            maxLength={200}
            value={mark.source}
            onChange={(event) => setMark({ ...mark, source: event.target.value })}
            placeholder="Q2 2026 secondary print"
          />
        </Field>
      </FormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.vehicleName ?? 'investment'}?`}
        description="Its transactions, distributions and valuation history are deleted with it. This cannot be undone."
        successMessage="Investment deleted."
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/investments/${deleting.id}`);
          list.refresh();
        }}
      />
    </>
  );
}
