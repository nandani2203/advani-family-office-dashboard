'use client';

import { ArchiveRestore, Plus } from 'lucide-react';
import { useState } from 'react';
import { AssetLogo } from '@/components/asset-logo';
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
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatNumber } from '@/lib/format';
import { useList } from '@/lib/use-list';
import { ASSET_TYPE_LABELS, type Asset, type AssetType } from '@/lib/types';
import { toast } from 'sonner';

interface AssetDraft {
  name: string;
  type: AssetType;
  ticker: string;
  sector: string;
  description: string;
  logoUrl: string;
}

const EMPTY_DRAFT: AssetDraft = {
  name: '',
  type: 'PRIVATE_EQUITY',
  ticker: '',
  sector: '',
  description: '',
  logoUrl: '',
};

const STATUS_LABELS = { ACTIVE: 'Active', ARCHIVED: 'Archived' } as const;

export default function AssetsPage(): JSX.Element {
  const { canEdit, isAdmin } = useAuth();
  const list = useList<Asset>('/assets', { sortBy: undefined });

  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(EMPTY_DRAFT);
  const [archiving, setArchiving] = useState<Asset | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (asset: Asset): void => {
    setEditing(asset);
    setDraft({
      name: asset.name,
      type: asset.type,
      ticker: asset.ticker ?? '',
      sector: asset.sector ?? '',
      description: asset.description ?? '',
      logoUrl: asset.logoUrl ?? '',
    });
    setFormOpen(true);
  };

  const save = async (): Promise<void> => {
    // Empty optional strings are omitted rather than sent as "", which the API's
    // length validators would reject.
    const payload = {
      name: draft.name.trim(),
      type: draft.type,
      ticker: draft.ticker.trim() || undefined,
      sector: draft.sector.trim() || undefined,
      description: draft.description.trim() || undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
    };

    if (editing) await api.patch(`/assets/${editing.id}`, payload);
    else await api.post('/assets', payload);

    list.refresh();
  };

  const restore = async (asset: Asset): Promise<void> => {
    try {
      await api.patch(`/assets/${asset.id}/restore`);
      toast.success(`${asset.name} restored.`);
      list.refresh();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.detail : 'Could not restore that asset.');
    }
  };

  const columns: Array<Column<Asset>> = [
    {
      key: 'name',
      header: 'Asset',
      sortable: true,
      render: (asset) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <AssetLogo name={asset.name} logoUrl={asset.logoUrl} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-medium">
              {asset.name}
              {asset.archivedAt ? <Badge variant="muted">Archived</Badge> : null}
            </p>
            {asset.description ? (
              <p className="max-w-[380px] truncate text-xs text-muted-foreground">
                {asset.description}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'ticker',
      header: 'Ticker',
      render: (asset) =>
        asset.ticker ? (
          <span className="font-mono text-xs">{asset.ticker}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (asset) => <Badge variant="outline">{ASSET_TYPE_LABELS[asset.type]}</Badge>,
    },
    {
      key: 'sector',
      header: 'Sector',
      sortable: true,
      render: (asset) => asset.sector ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'positions',
      header: 'Positions',
      align: 'right',
      render: (asset) => formatNumber(asset._count?.investments ?? 0),
    },
    {
      key: 'createdAt',
      header: 'Added',
      sortable: true,
      align: 'right',
      render: (asset) => (
        <span className="text-muted-foreground">{formatDate(asset.createdAt)}</span>
      ),
    },
  ];

  const filtersActive = Boolean(list.filters.search || list.filters.type || list.filters.status);

  return (
    <>
      <PageHeader
        title="Assets"
        description="The underlying companies, funds and tokens a position can point at."
      >
        <ExportButton<Asset>
          path="/assets"
          filters={list.effectiveFilters}
          filename="assets.csv"
          headers={['Name', 'Type', 'Ticker', 'Sector', 'Positions', 'Status', 'Added']}
          toRow={(asset) => [
            asset.name,
            ASSET_TYPE_LABELS[asset.type],
            asset.ticker ?? '',
            asset.sector ?? '',
            asset._count?.investments ?? 0,
            asset.archivedAt ? 'Archived' : 'Active',
            formatDate(asset.createdAt),
          ]}
        />
        {canEdit ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New asset
          </Button>
        ) : null}
      </PageHeader>

      <FilterBar>
        <SearchInput
          value={(list.filters.search as string) ?? ''}
          onChange={(value) => list.setFilter('search', value)}
          placeholder="Search name, ticker or sector"
        />
        <FilterSelect
          value={list.filters.type as string | undefined}
          onChange={(value) => list.setFilter('type', value)}
          anyLabel="Any type"
          options={optionsFrom(ASSET_TYPE_LABELS)}
        />
        <FilterSelect
          value={list.filters.status as string | undefined}
          onChange={(value) => list.setFilter('status', value)}
          anyLabel="Active"
          options={optionsFrom(STATUS_LABELS)}
        />
        <ResetFilters
          active={filtersActive}
          onReset={() => {
            list.setFilter('search', undefined);
            list.setFilter('type', undefined);
            list.setFilter('status', undefined);
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(asset) => asset.id}
        meta={list.meta}
        loading={list.loading}
        initialLoading={list.initialLoading}
        error={list.error}
        sortBy={list.filters.sortBy as string | undefined}
        sortDir={list.filters.sortDir as string | undefined}
        onSort={list.toggleSort}
        onPage={list.setPage}
        onRetry={list.refresh}
        emptyTitle="No assets found"
        emptyDescription={
          filtersActive
            ? 'Nothing matches these filters. Try clearing them.'
            : 'Add the companies, funds and tokens the portfolio holds.'
        }
        rowActions={
          canEdit
            ? (asset) => (
                <RowActionButtons
                  onEdit={() => openEdit(asset)}
                  onDelete={
                    isAdmin && !asset.archivedAt ? () => setArchiving(asset) : undefined
                  }
                  editLabel={`Edit ${asset.name}`}
                  deleteLabel={`Archive ${asset.name}`}
                  extra={
                    isAdmin && asset.archivedAt ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Restore ${asset.name}`}
                        onClick={() => void restore(asset)}
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    ) : undefined
                  }
                />
              )
            : undefined
        }
      />

      <FormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit asset' : 'New asset'}
        description={
          editing
            ? 'Changing an asset affects every position that points at it.'
            : 'Create the underlying holding first, then add positions against it.'
        }
        submitLabel={editing ? 'Save changes' : 'Create asset'}
        successMessage={editing ? 'Asset updated.' : 'Asset created.'}
        onSubmit={save}
      >
        <Field label="Name" htmlFor="asset-name">
          <Input
            id="asset-name"
            required
            maxLength={120}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="SpaceX"
          />
        </Field>

        <FieldRow>
          <Field label="Type" htmlFor="asset-type">
            <Select
              value={draft.type}
              onValueChange={(value) => setDraft({ ...draft, type: value as AssetType })}
            >
              <SelectTrigger id="asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(ASSET_TYPE_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Ticker" htmlFor="asset-ticker" hint="Optional — for listed or token assets.">
            <Input
              id="asset-ticker"
              maxLength={20}
              value={draft.ticker}
              onChange={(event) => setDraft({ ...draft, ticker: event.target.value })}
              placeholder="BTC"
            />
          </Field>
        </FieldRow>

        <Field label="Sector" htmlFor="asset-sector">
          <Input
            id="asset-sector"
            maxLength={80}
            value={draft.sector}
            onChange={(event) => setDraft({ ...draft, sector: event.target.value })}
            placeholder="Aerospace"
          />
        </Field>

        <Field label="Description" htmlFor="asset-description">
          <Textarea
            id="asset-description"
            maxLength={2000}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="What this holding is, and how we got into it."
          />
        </Field>

        <Field
          label="Logo URL"
          htmlFor="asset-logo"
          hint="Optional — shown next to the name in lists. Falls back to initials if left blank or unreachable."
        >
          <Input
            id="asset-logo"
            type="url"
            maxLength={500}
            value={draft.logoUrl}
            onChange={(event) => setDraft({ ...draft, logoUrl: event.target.value })}
            placeholder="https://www.google.com/s2/favicons?domain=spacex.com&sz=128"
          />
        </Field>
      </FormSheet>

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? 'asset'}?`}
        description="Hides it from the active list. Positions and history against it are preserved, and you can restore it anytime from the Archived filter."
        confirmLabel="Archive"
        successMessage="Asset archived."
        onConfirm={async () => {
          if (!archiving) return;
          await api.delete(`/assets/${archiving.id}`);
          list.refresh();
        }}
      />
    </>
  );
}
