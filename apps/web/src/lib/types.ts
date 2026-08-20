/**
 * Mirrors the API's response shapes. Kept hand-written rather than generated so
 * the frontend has one obvious place to look, and so the enums can carry the
 * labels the UI shows.
 */

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export type AssetType =
  | 'PRIVATE_EQUITY'
  | 'PUBLIC_EQUITY'
  | 'CRYPTO'
  | 'FUND'
  | 'DEBT'
  | 'REAL_ESTATE'
  | 'TOKENIZED';

export type VehicleType = 'SPV' | 'FUND' | 'DIRECT';
export type InvestmentStatus = 'ACTIVE' | 'EXITED' | 'WRITTEN_OFF';

export type TransactionType =
  | 'CAPITAL_CALL'
  | 'PURCHASE'
  | 'SALE'
  | 'FEE'
  | 'DIVIDEND'
  | 'INTEREST';

export type TransactionDirection = 'INFLOW' | 'OUTFLOW';
export type TransactionStatus = 'PENDING' | 'SETTLED' | 'VOID';
export type DistributionStatus = 'DECLARED' | 'APPROVED' | 'PAID';
export type FilingType = 'KYC' | 'VAT' | 'MRV' | 'ANNUAL_RETURN' | 'TAX';
export type FilingStatus = 'OPEN' | 'IN_PROGRESS' | 'SUBMITTED' | 'CLOSED';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

export interface OtpChallenge {
  email: string;
  expiresAt: string;
  resendInSeconds: number;
  devCode?: string;
  message?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  ticker: string | null;
  sector: string | null;
  currency: string;
  description: string | null;
  createdAt: string;
  _count?: { investments: number };
}

export interface Investment {
  id: string;
  assetId: string;
  vehicle: VehicleType;
  vehicleName: string;
  committedAmount: number;
  investedAmount: number;
  costBasis: number;
  currentValuation: number;
  ownershipPct: number | null;
  status: InvestmentStatus;
  investedAt: string;
  notes: string | null;
  asset: Pick<Asset, 'id' | 'name' | 'type'> & { ticker?: string | null };
}

export interface Transaction {
  id: string;
  investmentId: string;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;
  currency: string;
  fxRate: number;
  occurredAt: string;
  status: TransactionStatus;
  reference: string | null;
  description: string | null;
  investment: {
    id: string;
    vehicleName: string;
    asset: { name: string; type?: AssetType };
  };
}

export interface Distribution {
  id: string;
  investmentId: string;
  declaredDate: string;
  paymentDate: string | null;
  grossAmount: number;
  withholdingTax: number;
  netAmount: number;
  currency: string;
  status: DistributionStatus;
  notes: string | null;
  investment: { id: string; vehicleName: string; asset: { name: string } };
}

export interface Filing {
  id: string;
  vehicleName: string;
  type: FilingType;
  jurisdiction: string | null;
  dueDate: string;
  submittedAt: string | null;
  status: FilingStatus;
  assigneeId: string | null;
  notes: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  kpis: {
    portfolioValuation: number;
    costBasis: number;
    unrealisedGain: number;
    unrealisedGainPct: number;
    investments: number;
    activeInvestments: number;
    upcomingFilings: number;
    upcomingFilingsWindowDays: number;
  };
  cashflow: {
    months: Array<{
      month: string;
      label: string;
      inflow: number;
      outflow: number;
      net: number;
    }>;
    totals: { inflow: number; outflow: number; net: number };
  };
  valuationByAssetType: Array<{
    type: AssetType;
    value: number;
    costBasis: number;
    investments: number;
    sharePct: number;
  }>;
  distributions: {
    paid: number;
    pending: number;
    byStatus: Array<{ status: DistributionStatus; amount: number; count: number }>;
  };
  committedVsDeployed: {
    committed: number;
    deployed: number;
    uncalled: number;
    deployedPct: number;
  };
  recentTransactions: Transaction[];
  upcomingFilings: Filing[];
  generatedAt: string;
}

export interface InvestmentSummary {
  totalValuation: number;
  totalCostBasis: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
  count: number;
  activeCount: number;
}

export type PermissionResource =
  | 'INVESTMENTS'
  | 'ASSETS'
  | 'TRANSACTIONS'
  | 'DISTRIBUTIONS'
  | 'FILINGS';

export type PermissionLevel = 'READ' | 'WRITE' | 'FULL';

export interface UserPermission {
  id: string;
  userId: string;
  resource: PermissionResource;
  level: PermissionLevel;
}

export const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
  INVESTMENTS: 'Investments',
  ASSETS: 'Assets',
  TRANSACTIONS: 'Transactions',
  DISTRIBUTIONS: 'Distributions',
  FILINGS: 'Filings',
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  READ: 'Read',
  WRITE: 'Write',
  FULL: 'Full',
};

export const PERMISSION_LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  READ: 'Can view — already true for any signed-in account.',
  WRITE: 'Can create and edit this resource, like an Editor.',
  FULL: 'Can also delete, like an Admin — scoped to just this resource.',
};

export interface AssetOption {
  id: string;
  name: string;
  type: AssetType;
}

export interface InvestmentOption {
  id: string;
  label: string;
  assetName: string;
}

export interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

// ------------------------------------------------------------------- vocabulary

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  PRIVATE_EQUITY: 'Private equity',
  PUBLIC_EQUITY: 'Public equity',
  CRYPTO: 'Crypto',
  FUND: 'Fund',
  DEBT: 'Debt',
  REAL_ESTATE: 'Real estate',
  TOKENIZED: 'Tokenized',
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  SPV: 'SPV',
  FUND: 'Fund',
  DIRECT: 'Direct',
};

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatus, string> = {
  ACTIVE: 'Active',
  EXITED: 'Exited',
  WRITTEN_OFF: 'Written off',
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  CAPITAL_CALL: 'Capital call',
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  FEE: 'Fee',
  DIVIDEND: 'Dividend',
  INTEREST: 'Interest',
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Pending',
  SETTLED: 'Settled',
  VOID: 'Void',
};

export const DISTRIBUTION_STATUS_LABELS: Record<DistributionStatus, string> = {
  DECLARED: 'Declared',
  APPROVED: 'Approved',
  PAID: 'Paid',
};

export const FILING_TYPE_LABELS: Record<FilingType, string> = {
  KYC: 'KYC',
  VAT: 'VAT',
  MRV: 'MRV',
  ANNUAL_RETURN: 'Annual return',
  TAX: 'Tax',
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  CLOSED: 'Closed',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Full access, including staff accounts and the audit log.',
  EDITOR: 'Can create and edit portfolio, finance and compliance records.',
  VIEWER: 'Read-only across the dashboard.',
};
