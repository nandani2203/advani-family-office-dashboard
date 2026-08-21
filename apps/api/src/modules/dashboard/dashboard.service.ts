import { Injectable } from '@nestjs/common';
import {
  AssetType,
  DistributionStatus,
  FilingStatus,
  InvestmentStatus,
  Prisma,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DUE_SOON_WINDOW_DAYS } from '../filings/filings.service';

export interface CashflowMonth {
  /** `YYYY-MM`, so the frontend can sort without parsing a label. */
  month: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface ValuationSlice {
  type: AssetType;
  value: number;
  costBasis: number;
  investments: number;
  sharePct: number;
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
    months: CashflowMonth[];
    totals: { inflow: number; outflow: number; net: number };
  };
  valuationByAssetType: ValuationSlice[];
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
  recentTransactions: unknown[];
  upcomingFilings: unknown[];
  generatedAt: string;
}

/** How many months of cashflow history the overview chart shows. */
const CASHFLOW_MONTHS = 12;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface CashflowRow {
  month: string;
  direction: 'INFLOW' | 'OUTFLOW';
  total: string;
}

interface ValuationRow {
  type: AssetType;
  value: string;
  cost_basis: string;
  investments: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every number the overview screen shows, in a single round-trip to Postgres.
   * The two grouped reads are raw SQL because Prisma's `groupBy` cannot group by
   * a relation column (`assets.type`) or truncate a timestamp to a month.
   *
   * Sums are cast to text in SQL so the driver hands back an exact decimal
   * string rather than a lossy float.
   */
  async summary(): Promise<DashboardSummary> {
    const now = new Date();
    const cashflowStart = this.startOfMonthUtc(now, -(CASHFLOW_MONTHS - 1));
    const filingsCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 86_400_000);

    const distributionsByStatusQuery = this.prisma.distribution.groupBy({
      by: ['status'],
      orderBy: { status: 'asc' },
      _sum: { netAmount: true },
      _count: { _all: true },
    });

    const [
      totals,
      activeInvestments,
      investments,
      upcomingFilingsCount,
      distributionsByStatus,
      cashflowRows,
      valuationRows,
      recentTransactions,
      upcomingFilings,
    ] = await this.prisma.$transaction([
      this.prisma.investment.aggregate({
        where: { status: InvestmentStatus.ACTIVE },
        _sum: {
          currentValuation: true,
          costBasis: true,
          committedAmount: true,
          investedAmount: true,
        },
      }),
      this.prisma.investment.count({ where: { status: InvestmentStatus.ACTIVE } }),
      this.prisma.investment.count(),
      this.prisma.filing.count({
        where: { status: { not: FilingStatus.CLOSED }, dueDate: { lte: filingsCutoff } },
      }),
      distributionsByStatusQuery,
      this.prisma.$queryRaw<CashflowRow[]>`
        SELECT to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS month,
               direction::text AS direction,
               SUM(amount * fx_rate)::text AS total
        FROM transactions
        WHERE status <> CAST(${TransactionStatus.VOID} AS "TransactionStatus")
          AND occurred_at >= ${cashflowStart}
        GROUP BY 1, 2
      `,
      this.prisma.$queryRaw<ValuationRow[]>`
        SELECT a.type::text AS type,
               SUM(i.current_valuation)::text AS value,
               SUM(i.cost_basis)::text AS cost_basis,
               COUNT(*)::int AS investments
        FROM investments i
        JOIN assets a ON a.id = i.asset_id
        WHERE i.status = CAST(${InvestmentStatus.ACTIVE} AS "InvestmentStatus")
        GROUP BY a.type
        -- Order on the numeric sum, not the ::text column at ordinal 2, which
        -- would sort "65000000" above "2026000000".
        ORDER BY SUM(i.current_valuation) DESC
      `,
      this.prisma.transaction.findMany({
        where: { status: { not: TransactionStatus.VOID } },
        orderBy: { occurredAt: 'desc' },
        take: 8,
        include: {
          investment: {
            select: {
              id: true,
              vehicleName: true,
              asset: { select: { name: true, type: true } },
            },
          },
        },
      }),
      this.prisma.filing.findMany({
        where: { status: { not: FilingStatus.CLOSED }, dueDate: { lte: filingsCutoff } },
        orderBy: { dueDate: 'asc' },
        take: 6,
        include: { assignee: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const portfolioValuation = this.toNumber(totals._sum.currentValuation);
    const costBasis = this.toNumber(totals._sum.costBasis);
    const unrealisedGain = portfolioValuation - costBasis;

    const committed = this.toNumber(totals._sum.committedAmount);
    const deployed = this.toNumber(totals._sum.investedAmount);

    const paid = this.sumDistributions(distributionsByStatus, [DistributionStatus.PAID]);
    const pending = this.sumDistributions(distributionsByStatus, [
      DistributionStatus.DECLARED,
      DistributionStatus.APPROVED,
    ]);

    return {
      kpis: {
        portfolioValuation,
        costBasis,
        unrealisedGain,
        unrealisedGainPct: costBasis > 0 ? (unrealisedGain / costBasis) * 100 : 0,
        investments,
        activeInvestments,
        upcomingFilings: upcomingFilingsCount,
        upcomingFilingsWindowDays: DUE_SOON_WINDOW_DAYS,
      },
      cashflow: this.buildCashflow(cashflowRows, cashflowStart),
      valuationByAssetType: this.buildValuationSlices(valuationRows, portfolioValuation),
      distributions: {
        paid,
        pending,
        byStatus: distributionsByStatus.map((row) => ({
          status: row.status,
          amount: this.toNumber(row._sum.netAmount),
          count: row._count._all,
        })),
      },
      committedVsDeployed: {
        committed,
        deployed,
        // What we have promised but not yet called down.
        uncalled: Math.max(0, committed - deployed),
        deployedPct: committed > 0 ? (deployed / committed) * 100 : 0,
      },
      recentTransactions,
      upcomingFilings,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Postgres only returns months that actually had transactions. The chart needs
   * a continuous 12-month axis, so the gaps are filled with zeroes here.
   */
  private buildCashflow(rows: CashflowRow[], start: Date): DashboardSummary['cashflow'] {
    const byMonth = new Map<string, CashflowMonth>();

    for (let offset = 0; offset < CASHFLOW_MONTHS; offset += 1) {
      const date = this.startOfMonthUtc(start, offset);
      const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      byMonth.set(month, {
        month,
        label: `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
        inflow: 0,
        outflow: 0,
        net: 0,
      });
    }

    for (const row of rows) {
      const bucket = byMonth.get(row.month);
      if (!bucket) continue;
      const amount = Number(row.total);
      if (row.direction === 'INFLOW') bucket.inflow += amount;
      else bucket.outflow += amount;
    }

    const months = [...byMonth.values()];
    for (const bucket of months) bucket.net = bucket.inflow - bucket.outflow;

    return {
      months,
      totals: {
        inflow: months.reduce((sum, month) => sum + month.inflow, 0),
        outflow: months.reduce((sum, month) => sum + month.outflow, 0),
        net: months.reduce((sum, month) => sum + month.net, 0),
      },
    };
  }

  private buildValuationSlices(rows: ValuationRow[], total: number): ValuationSlice[] {
    return rows.map((row) => {
      const value = Number(row.value);
      return {
        type: row.type,
        value,
        costBasis: Number(row.cost_basis),
        investments: Number(row.investments),
        sharePct: total > 0 ? (value / total) * 100 : 0,
      };
    });
  }

  private sumDistributions(
    rows: Array<{ status: DistributionStatus; _sum: { netAmount: Prisma.Decimal | null } }>,
    statuses: DistributionStatus[],
  ): number {
    return rows
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + this.toNumber(row._sum.netAmount), 0);
  }

  /** Midnight UTC on the first of the month, `offset` months from `from`. */
  private startOfMonthUtc(from: Date, offset: number): Date {
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1));
  }

  private toNumber(value: Prisma.Decimal | null | undefined): number {
    return value ? value.toNumber() : 0;
  }
}
