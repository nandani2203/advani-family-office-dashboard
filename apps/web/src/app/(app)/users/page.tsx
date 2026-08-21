'use client';

import { Info, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { GrantAccessDialog } from '@/components/grant-access-dialog';
import { PageHeader } from '@/components/page-header';
import { RoleBadge, UserStatusBadge } from '@/components/status-badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, humanise } from '@/lib/format';
import { useList } from '@/lib/use-list';
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  type ApiUser,
  type AuditLog,
  type Role,
} from '@/lib/types';

export default function UsersPage(): JSX.Element {
  const { isAdmin, user: currentUser } = useAuth();

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with access to this dashboard, and a record of what they changed."
      />

      {isAdmin ? (
        <Tabs defaultValue="staff" className="flex flex-col gap-4">
          <TabsList className="self-start">
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="flex flex-col gap-4">
            <StaffTable currentUserId={currentUser?.id ?? null} isAdmin />
          </TabsContent>

          <TabsContent value="audit">
            <AuditTable />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="flex gap-2.5 rounded-md border bg-card p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Staff accounts, roles and the audit log are managed by an administrator. You can see
              who has access, but not change it.
            </p>
          </div>
          <StaffTable currentUserId={currentUser?.id ?? null} isAdmin={false} />
        </>
      )}
    </>
  );
}

function StaffTable({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string | null;
  isAdmin: boolean;
}): JSX.Element {
  const list = useList<ApiUser>('/users', { sortBy: 'createdAt', sortDir: 'asc' });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<{ email: string; name: string; role: Role }>({
    email: '',
    name: '',
    role: 'VIEWER',
  });
  const [deleting, setDeleting] = useState<ApiUser | null>(null);

  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{ name: string; role: Role }>({
    name: '',
    role: 'VIEWER',
  });
  // Direct grants live in their own dialog; `grantUserId` pre-selects a row's
  // account when it is opened from that row rather than from the toolbar.
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState<string | null>(null);

  const openGrants = (id: string | null): void => {
    setGrantUserId(id);
    setGrantOpen(true);
  };

  const openEditUser = (user: ApiUser): void => {
    setEditingUser(user);
    setEditDraft({ name: user.name ?? '', role: user.role });
    setEditOpen(true);
  };

  const patchUser = async (user: ApiUser, body: Record<string, unknown>): Promise<void> => {
    try {
      await api.patch(`/users/${user.id}`, body);
      toast.success('Account updated.');
      list.refresh();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.detail : 'Could not update that account.');
    }
  };

  const columns: Array<Column<ApiUser>> = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (user) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium">
            {user.name ?? 'Unnamed'}
            {user.id === currentUserId ? <Badge variant="muted">You</Badge> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (user) => <UserStatusBadge status={user.status} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Last sign-in',
      sortable: true,
      align: 'right',
      render: (user) => (
        <span className="text-muted-foreground">
          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
        </span>
      ),
    },
  ];

  const filtersActive = Boolean(list.filters.search || list.filters.role || list.filters.status);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <FilterBar>
            <SearchInput
              value={(list.filters.search as string) ?? ''}
              onChange={(value) => list.setFilter('search', value)}
              placeholder="Search name or email"
            />
            <FilterSelect
              value={list.filters.role as string | undefined}
              onChange={(value) => list.setFilter('role', value)}
              anyLabel="Any role"
              options={optionsFrom(ROLE_LABELS)}
            />
            <FilterSelect
              value={list.filters.status as string | undefined}
              onChange={(value) => list.setFilter('status', value)}
              anyLabel="Any status"
              options={optionsFrom(USER_STATUS_LABELS)}
            />
            <ResetFilters
              active={filtersActive}
              onReset={() => {
                for (const key of ['search', 'role', 'status']) list.setFilter(key, undefined);
              }}
            />
          </FilterBar>

          <div className="flex items-center gap-2">
            <ExportButton<ApiUser>
              path="/users"
              filters={list.effectiveFilters}
              filename="users.csv"
              headers={['Name', 'Email', 'Role', 'Status', 'Last sign-in']}
              toRow={(user) => [
                user.name ?? '',
                user.email,
                ROLE_LABELS[user.role],
                USER_STATUS_LABELS[user.status],
                user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never',
              ]}
            />
            {isAdmin ? (
              <>
                <Button variant="outline" size="sm" onClick={() => openGrants(null)}>
                  <ShieldCheck className="h-4 w-4" />
                  Grant access
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setInvite({ email: '', name: '', role: 'VIEWER' });
                    setInviteOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Invite user
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={(user) => user.id}
          meta={list.meta}
          loading={list.loading}
          initialLoading={list.initialLoading}
          error={list.error}
          sortBy={list.filters.sortBy as string | undefined}
          sortDir={list.filters.sortDir as string | undefined}
          onSort={list.toggleSort}
          onPage={list.setPage}
          onRetry={list.refresh}
          emptyTitle="No accounts found"
          emptyDescription={filtersActive ? 'Nothing matches these filters.' : undefined}
          rowActions={
            isAdmin
              ? (user) => (
                  <RowActionButtons
                    onEdit={() => openEditUser(user)}
                    onDelete={user.id === currentUserId ? undefined : () => setDeleting(user)}
                    editLabel={`Edit ${user.email}`}
                    deleteLabel={`Delete ${user.email}`}
                  />
                )
              : undefined
          }
        />
      </div>

      <FormSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a staff account"
        description="The account starts as invited and becomes active the first time they sign in with a code."
        submitLabel="Create account"
        successMessage="Account created."
        onSubmit={async () => {
          await api.post('/users', {
            email: invite.email.trim().toLowerCase(),
            name: invite.name.trim() || undefined,
            role: invite.role,
          });
          list.refresh();
        }}
      >
        <FieldRow>
          <Field label="Email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              required
              value={invite.email}
              onChange={(event) => setInvite({ ...invite, email: event.target.value })}
              placeholder="priya@advanifamilyoffice.com"
            />
          </Field>

          <Field label="Name" htmlFor="invite-name">
            <Input
              id="invite-name"
              maxLength={120}
              value={invite.name}
              onChange={(event) => setInvite({ ...invite, name: event.target.value })}
              placeholder="Priya Nair"
            />
          </Field>
        </FieldRow>

        <Field label="Role" htmlFor="invite-role" hint={ROLE_DESCRIPTIONS[invite.role]}>
          <Select
            value={invite.role}
            onValueChange={(value) => setInvite({ ...invite, role: value as Role })}
          >
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {optionsFrom(ROLE_LABELS).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSheet>

      <FormSheet
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingUser(null);
        }}
        title="Edit user"
        description="Role sets the account's baseline access. Direct grants widen a single resource on top of it, and are managed separately."
        submitLabel="Save changes"
        successMessage="Account updated."
        onSubmit={async () => {
          if (!editingUser) return;
          await api.patch(`/users/${editingUser.id}`, {
            name: editDraft.name.trim() || undefined,
            role: editDraft.role,
          });
          list.refresh();
        }}
      >
        {editingUser ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {editingUser.email}
            {editingUser.id === currentUserId ? <Badge variant="muted" className="ml-2">You</Badge> : null}
          </p>
        ) : null}

        <FieldRow>
          <Field label="Name" htmlFor="edit-user-name">
            <Input
              id="edit-user-name"
              maxLength={120}
              value={editDraft.name}
              onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
            />
          </Field>

          <Field label="Role" htmlFor="edit-user-role" hint={ROLE_DESCRIPTIONS[editDraft.role]}>
            <Select
              value={editDraft.role}
              onValueChange={(value) => setEditDraft({ ...editDraft, role: value as Role })}
            >
              <SelectTrigger id="edit-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsFrom(ROLE_LABELS).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        {editingUser ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Account status</p>
              <p className="text-xs text-muted-foreground">
                {editingUser.status === 'SUSPENDED'
                  ? 'Suspended — this account cannot sign in.'
                  : USER_STATUS_LABELS[editingUser.status]}
              </p>
            </div>
            {editingUser.status === 'SUSPENDED' ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void patchUser(editingUser, { status: 'ACTIVE' })}
              >
                <UserCheck className="h-4 w-4" />
                Reinstate
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={editingUser.id === currentUserId}
                onClick={() => void patchUser(editingUser, { status: 'SUSPENDED' })}
              >
                <UserX className="h-4 w-4" />
                Suspend
              </Button>
            )}
          </div>
        ) : null}

        {editingUser ? (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Direct access</p>
              <p className="text-xs text-muted-foreground">
                Widen a single resource without changing the role above.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                // The sheet and the dialog would otherwise stack, and the sheet
                // is the one holding a half-finished name edit.
                setEditOpen(false);
                openGrants(editingUser.id);
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              Manage
            </Button>
          </div>
        ) : null}
      </FormSheet>

      <GrantAccessDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        initialUserId={grantUserId}
        onSaved={list.refresh}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.email ?? 'this account'}?`}
        description="They lose access immediately. Their audit-log entries are kept, with the actor left as their recorded email."
        confirmLabel="Delete account"
        successMessage="Account deleted."
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/users/${deleting.id}`);
          list.refresh();
        }}
      />
    </>
  );
}

function AuditTable(): JSX.Element {
  const list = useList<AuditLog>('/users/audit-logs');

  const columns: Array<Column<AuditLog>> = [
    {
      key: 'createdAt',
      header: 'When',
      sortable: true,
      render: (log) => <span className="whitespace-nowrap tabular">{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'actorEmail',
      header: 'Actor',
      render: (log) => log.actorEmail ?? <span className="text-muted-foreground">System</span>,
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (log) => <Badge variant="outline">{humanise(log.action)}</Badge>,
    },
    {
      key: 'resource',
      header: 'Resource',
      sortable: true,
      render: (log) => (
        <div className="min-w-0">
          <p className="font-medium">{humanise(log.resource)}</p>
          {log.resourceId ? (
            <p className="truncate font-mono text-xs text-muted-foreground">{log.resourceId}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      align: 'right',
      render: (log) => (
        <span className="font-mono text-xs text-muted-foreground">{log.ip ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SearchInput
          value={(list.filters.search as string) ?? ''}
          onChange={(value) => list.setFilter('search', value)}
          placeholder="Search actor, action or resource"
        />
        <FilterSelect
          value={list.filters.resource as string | undefined}
          onChange={(value) => list.setFilter('resource', value)}
          anyLabel="Any resource"
          options={[
            { value: 'investment', label: 'Investments' },
            { value: 'asset', label: 'Assets' },
            { value: 'transaction', label: 'Transactions' },
            { value: 'distribution', label: 'Distributions' },
            { value: 'filing', label: 'Filings' },
            { value: 'user', label: 'Users' },
          ]}
        />
        <ResetFilters
          active={Boolean(list.filters.search || list.filters.resource)}
          onReset={() => {
            list.setFilter('search', undefined);
            list.setFilter('resource', undefined);
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(log) => log.id}
        meta={list.meta}
        loading={list.loading}
        initialLoading={list.initialLoading}
        error={list.error}
        sortBy={list.filters.sortBy as string | undefined}
        sortDir={list.filters.sortDir as string | undefined}
        onSort={list.toggleSort}
        onPage={list.setPage}
        onRetry={list.refresh}
        emptyTitle="Nothing recorded yet"
        emptyDescription="Every create, update and delete lands here as it happens."
      />
    </div>
  );
}
