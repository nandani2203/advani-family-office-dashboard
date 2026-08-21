'use client';

import { Loader2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, api } from '@/lib/api-client';
import { useResource } from '@/lib/use-list';
import {
  PERMISSION_LEVEL_DESCRIPTIONS,
  PERMISSION_LEVEL_LABELS,
  PERMISSION_RESOURCE_LABELS,
  type ApiUser,
  type Paginated,
  type PermissionLevel,
  type PermissionResource,
  type UserPermission,
} from '@/lib/types';

const PERMISSION_RESOURCES: PermissionResource[] = [
  'INVESTMENTS',
  'ASSETS',
  'TRANSACTIONS',
  'DISTRIBUTIONS',
  'FILINGS',
];

const PERMISSION_LEVELS: PermissionLevel[] = ['READ', 'WRITE', 'FULL'];

/**
 * Write is the default rather than Full or Read: Read grants nothing a signed-in
 * account does not already have, and defaulting a permission dialog to the most
 * permissive option is the wrong way round.
 */
const DEFAULT_LEVEL: PermissionLevel = 'WRITE';

/** Staff counts here are in single digits, so one page covers everyone. */
const USER_PAGE_SIZE = 100;

function userLabel(user: ApiUser): string {
  return user.name ? `${user.name} — ${user.email}` : user.email;
}

/**
 * Grants one user a direct, per-resource override on top of whatever their role
 * already allows — the narrow alternative to promoting them everywhere.
 *
 * Deliberately a separate dialog rather than a section of the Edit User sheet:
 * a direct grant is an exception to the role model, and giving it its own
 * surface keeps that visible instead of burying it under a name field. The
 * dialog also lists and revokes what a user already has, so this is the one
 * place a grant is created, reviewed and taken away.
 *
 * The dialog stays open after a successful grant and refreshes the list below,
 * so an admin can see the change land and grant a second resource without
 * reopening.
 */
export function GrantAccessDialog({
  open,
  onOpenChange,
  initialUserId = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects a user. The picker stays editable either way. */
  initialUserId?: string | null;
  onSaved?: () => void;
}): JSX.Element {
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [resource, setResource] = useState<PermissionResource | null>(null);
  const [level, setLevel] = useState<PermissionLevel>(DEFAULT_LEVEL);
  const [working, setWorking] = useState(false);
  const [revoking, setRevoking] = useState<PermissionResource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: users } = useResource<Paginated<ApiUser>>('/users', {
    enabled: open,
    query: { pageSize: USER_PAGE_SIZE, sortBy: 'name', sortDir: 'asc' },
  });

  const {
    data: grants,
    loading: grantsLoading,
    refresh: refreshGrants,
  } = useResource<UserPermission[]>(userId ? `/users/${userId}/permissions` : '', {
    enabled: open && userId !== null,
  });

  // Reopening for a different row should not inherit the last row's selection.
  useEffect(() => {
    if (!open) return;
    setUserId(initialUserId);
    setResource(null);
    setLevel(DEFAULT_LEVEL);
    setError(null);
  }, [open, initialUserId]);

  const selectedUser = users?.data.find((user) => user.id === userId) ?? null;
  const activeGrants = grants ?? [];
  const existing = resource
    ? (activeGrants.find((grant) => grant.resource === resource) ?? null)
    : null;

  const save = async (
    target: PermissionResource,
    nextLevel: PermissionLevel | null,
  ): Promise<void> => {
    if (!userId) return;
    setError(null);

    try {
      // One entry only touches that one resource — the endpoint upserts each
      // grant it is given and deletes the ones passed as null, so this does not
      // disturb the user's other resources.
      await api.put(`/users/${userId}/permissions`, {
        grants: [{ resource: target, level: nextLevel }],
      });
      refreshGrants();
      onSaved?.();
      toast.success(
        nextLevel === null
          ? `Revoked ${PERMISSION_RESOURCE_LABELS[target]} access.`
          : `Granted ${PERMISSION_LEVEL_LABELS[nextLevel]} on ${PERMISSION_RESOURCE_LABELS[target]}.`,
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : 'Could not change that grant.');
      throw cause;
    }
  };

  const grant = async (): Promise<void> => {
    if (!userId || !resource) return;
    setWorking(true);

    try {
      await save(resource, level);
      // Cleared so the next grant starts fresh, but the user stays selected.
      setResource(null);
      setLevel(DEFAULT_LEVEL);
    } catch {
      // `save` has already surfaced the message.
    } finally {
      setWorking(false);
    }
  };

  const revoke = async (target: PermissionResource): Promise<void> => {
    setRevoking(target);

    try {
      await save(target, null);
    } catch {
      // Already surfaced.
    } finally {
      setRevoking(null);
    }
  };

  const canGrant = Boolean(userId && resource) && !working;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant Direct Access</DialogTitle>
          <DialogDescription>
            Grant a user direct access to a specific resource, without changing their role.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-user">
              User <span className="text-negative">*</span>
            </Label>
            <Select value={userId ?? undefined} onValueChange={(value) => setUserId(value)}>
              <SelectTrigger id="grant-user">
                <SelectValue placeholder="Select a user…" />
              </SelectTrigger>
              <SelectContent>
                {(users?.data ?? []).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {userLabel(user)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUser?.role === 'ADMIN' ? (
              <p className="text-xs text-muted-foreground">
                Administrators already have full access everywhere — a direct grant would not widen
                anything.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-resource">Resource Type</Label>
            <Select
              value={resource ?? undefined}
              onValueChange={(value) => setResource(value as PermissionResource)}
            >
              <SelectTrigger id="grant-resource">
                <SelectValue placeholder="Select resource type" />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_RESOURCES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {PERMISSION_RESOURCE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existing ? (
              <p className="text-xs text-muted-foreground">
                Currently {PERMISSION_LEVEL_LABELS[existing.level]} — granting again replaces it.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-level">Action</Label>
            <Select value={level} onValueChange={(value) => setLevel(value as PermissionLevel)}>
              <SelectTrigger id="grant-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVELS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === 'FULL'
                      ? `${PERMISSION_LEVEL_LABELS[item]} (all actions)`
                      : PERMISSION_LEVEL_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PERMISSION_LEVEL_DESCRIPTIONS[level]}
            </p>
          </div>

          {userId ? (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-medium">
                Direct access {selectedUser ? `for ${selectedUser.name ?? selectedUser.email}` : ''}
              </p>

              {grantsLoading && activeGrants.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : activeGrants.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  None — this account has only what its role allows.
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {activeGrants.map((item) => (
                    <li
                      key={item.resource}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        {PERMISSION_RESOURCE_LABELS[item.resource]}
                        <span className="text-xs text-muted-foreground">
                          {PERMISSION_LEVEL_LABELS[item.level]}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={revoking !== null}
                        onClick={() => void revoke(item.resource)}
                        aria-label={`Revoke ${PERMISSION_RESOURCE_LABELS[item.resource]} access`}
                      >
                        {revoking === item.resource ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-negative/25 bg-negative/10 px-3 py-2 text-sm text-negative">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Close
          </Button>
          <Button onClick={() => void grant()} disabled={!canGrant}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
