import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  DISTRIBUTION_STATUS_LABELS,
  FILING_STATUS_LABELS,
  INVESTMENT_STATUS_LABELS,
  ROLE_LABELS,
  TRANSACTION_STATUS_LABELS,
  USER_STATUS_LABELS,
  type DistributionStatus,
  type FilingStatus,
  type InvestmentStatus,
  type Role,
  type TransactionStatus,
  type UserStatus,
} from '@/lib/types';

type Variant = NonNullable<BadgeProps['variant']>;

/**
 * One mapping from a domain status to a colour, used everywhere. Defined here so
 * "settled" is never green on one page and blue on another.
 */
const INVESTMENT: Record<InvestmentStatus, Variant> = {
  ACTIVE: 'positive',
  EXITED: 'info',
  WRITTEN_OFF: 'negative',
};

const TRANSACTION: Record<TransactionStatus, Variant> = {
  SETTLED: 'positive',
  PENDING: 'warning',
  VOID: 'muted',
};

const DISTRIBUTION: Record<DistributionStatus, Variant> = {
  DECLARED: 'muted',
  APPROVED: 'warning',
  PAID: 'positive',
};

const FILING: Record<FilingStatus, Variant> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  SUBMITTED: 'positive',
  CLOSED: 'muted',
};

const USER: Record<UserStatus, Variant> = {
  ACTIVE: 'positive',
  INVITED: 'info',
  SUSPENDED: 'negative',
};

const ROLE: Record<Role, Variant> = {
  ADMIN: 'info',
  EDITOR: 'default',
  VIEWER: 'muted',
};

export function InvestmentStatusBadge({ status }: { status: InvestmentStatus }): JSX.Element {
  return <Badge variant={INVESTMENT[status]}>{INVESTMENT_STATUS_LABELS[status]}</Badge>;
}

export function TransactionStatusBadge({ status }: { status: TransactionStatus }): JSX.Element {
  return <Badge variant={TRANSACTION[status]}>{TRANSACTION_STATUS_LABELS[status]}</Badge>;
}

export function DistributionStatusBadge({ status }: { status: DistributionStatus }): JSX.Element {
  return <Badge variant={DISTRIBUTION[status]}>{DISTRIBUTION_STATUS_LABELS[status]}</Badge>;
}

export function FilingStatusBadge({ status }: { status: FilingStatus }): JSX.Element {
  return <Badge variant={FILING[status]}>{FILING_STATUS_LABELS[status]}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }): JSX.Element {
  return <Badge variant={USER[status]}>{USER_STATUS_LABELS[status]}</Badge>;
}

export function RoleBadge({ role }: { role: Role }): JSX.Element {
  return <Badge variant={ROLE[role]}>{ROLE_LABELS[role]}</Badge>;
}
