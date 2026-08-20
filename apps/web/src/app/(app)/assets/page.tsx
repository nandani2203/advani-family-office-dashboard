'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog, RowActionButtons } from '@/components/confirm-dialog';
import { Column, DataTable } from '@/components/data-table';
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
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatNumber } from '@/lib/format';
import { useList } from '@/lib/use-list';
import { ASSET_TYPE_LABELS, type Asset, type AssetType } from '@/lib/types';

interface AssetDraft {
  name: string;
  type: AssetType;
  ticker: string;
  sector: string;
  description: string;
}

const EMPTY_DRAFT: AssetDraft = {
  name: '',
  type: 'PRIVATE_EQUITY',
  ticker: '',
  sector: '',
  description: '',
};

export default function AssetsPage(): JSX.Element {
  const { canEdit, isAdmin } = useAuth();
  const list = useList<Asset>('/assets', { sortBy: undefined });

  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<Asset | null>(null);

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
    };

    if (editing) await api.patch(`/assets/${editing.id}`, payload);
    else await api.post('/assets', payload);

    list.refresh();
  };

  const columns: Array<Column<Asset>> = [
    {
      key: 'name',
      header: 'Asset',
      sortable: true,
      render: (asset) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{asset.name}</p>
          {asset.description ? (
            <p className="max-w-[380px] truncate text-xs text-muted-foreground">
              {asset.description}
            </p>
          ) : null}
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

  const filtersActive = Boolean(list.filters.search || list.filters.type);

  return (
    <>
      <PageHeader
        title="Assets"
        description="The underlying companies, funds and tokens a position can point at."
      >
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
        <ResetFilters
          active={filtersActive}
          onReset={() => {
            list.setFilter('search', undefined);
            list.setFilter('type', undefined);
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
                  onDelete={isAdmin ? () => setDeleting(asset) : undefined}
                  editLabel={`Edit ${asset.name}`}
                  deleteLabel={`Delete ${asset.name}`}
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
      </FormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'asset'}?`}
        description="This cannot be undone. An asset with positions against it cannot be deleted — remove those first."
        successMessage="Asset deleted."
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/assets/${deleting.id}`);
          list.refresh();
        }}
      />
    </>
  );
}
