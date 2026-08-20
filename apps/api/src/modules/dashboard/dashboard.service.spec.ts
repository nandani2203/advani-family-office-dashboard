import { Test } from '@nestjs/testing';
import { DistributionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

/**
 * The service issues all of its reads inside one `$transaction([...])`, so the
 * mock returns the results positionally. Anything the individual Prisma methods
 * return is irrelevant — only the transaction result reaches the maths.
 */
function buildPrismaMock(results: unknown[]): PrismaService {
  const noop = jest.fn().mockReturnValue({});
  return {
    $transaction: jest.fn().mockResolvedValue(results),
    $queryRaw: noop,
    investment: { aggregate: noop, count: noop },
    filing: { count: noop, findMany: noop },
    distribution: { groupBy: noop },
    transaction: { findMany: noop },
  } as unknown as PrismaService;
}

/** `YYYY-MM` for the month `offset` months before now, in UTC. */
function monthKey(offset: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('DashboardService', () => {
  const build = async (results: unknown[]): Promise<DashboardService> => {
    const prisma = buildPrismaMock(results);
    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return moduleRef.get(DashboardService);
  };

  /** A full, well-formed transaction result with sensible defaults. */
  const results = (overrides: Partial<Record<number, unknown>> = {}): unknown[] => {
    const base: unknown[] = [
      {
        _sum: {
          currentValuation: decimal(3_000_000_000),
          costBasis: decimal(1_200_000_000),
          committedAmount: decimal(1_500_000_000),
          investedAmount: decimal(1_200_000_000),
        },
      },
      210, // active investments
      217, // all investments
      9, // filings due soon
      [
        { status: DistributionStatus.PAID, _sum: { netAmount: decimal(48_000_000) }, _count: { _all: 12 } },
        { status: DistributionStatus.APPROVED, _sum: { netAmount: decimal(9_000_000) }, _count: { _all: 3 } },
        { status: DistributionStatus.DECLARED, _sum: { netAmount: decimal(4_000_000) }, _count: { _all: 2 } },
      ],
      [], // cashflow rows
      [], // valuation rows
      [], // recent transactions
      [], // upcoming filings
    ];
    for (const [index, value] of Object.entries(overrides)) {
      base[Number(index)] = value;
    }
    return base;
  };

  describe('kpis', () => {
    it('reports valuation, cost basis and the unrealised gain between them', async () => {
      const service = await build(results());
      const { kpis } = await service.summary();

      expect(kpis.portfolioValuation).toBe(3_000_000_000);
      expect(kpis.costBasis).toBe(1_200_000_000);
      expect(kpis.unrealisedGain).toBe(1_800_000_000);
      expect(kpis.unrealisedGainPct).toBeCloseTo(150, 6);
      expect(kpis.investments).toBe(217);
      expect(kpis.activeInvestments).toBe(210);
      expect(kpis.upcomingFilings).toBe(9);
      expect(kpis.upcomingFilingsWindowDays).toBe(30);
    });

    it('does not divide by zero when nothing has been invested yet', async () => {
      const service = await build(
        results({
          0: {
            _sum: {
              currentValuation: null,
              costBasis: null,
              committedAmount: null,
              investedAmount: null,
            },
          },
          4: [],
        }),
      );

      const summary = await service.summary();

      expect(summary.kpis.portfolioValuation).toBe(0);
      expect(summary.kpis.unrealisedGain).toBe(0);
      expect(summary.kpis.unrealisedGainPct).toBe(0);
      expect(summary.committedVsDeployed.deployedPct).toBe(0);
    });

    it('surfaces a loss as a negative unrealised gain rather than clamping it', async () => {
      const service = await build(
        results({
          0: {
            _sum: {
              currentValuation: decimal(80_000_000),
              costBasis: decimal(100_000_000),
              committedAmount: decimal(100_000_000),
              investedAmount: decimal(100_000_000),
            },
          },
        }),
      );

      const { kpis } = await service.summary();

      expect(kpis.unrealisedGain).toBe(-20_000_000);
      expect(kpis.unrealisedGainPct).toBeCloseTo(-20, 6);
    });
  });

  describe('cashflow', () => {
    it('always returns a continuous 12-month axis, zero-filling quiet months', async () => {
      const service = await build(results());
      const { cashflow } = await service.summary();

      expect(cashflow.months).toHaveLength(12);
      expect(cashflow.months.map((month) => month.month)).toEqual(
        Array.from({ length: 12 }, (_, index) => monthKey(11 - index)),
      );
      expect(cashflow.months.every((month) => month.inflow === 0 && month.net === 0)).toBe(true);
      expect(cashflow.totals).toEqual({ inflow: 0, outflow: 0, net: 0 });
    });

    it('nets inflows against outflows per month and in the total', async () => {
      const thisMonth = monthKey(0);
      const lastMonth = monthKey(1);

      const service = await build(
        results({
          5: [
            { month: thisMonth, direction: 'INFLOW', total: '5000000' },
            { month: thisMonth, direction: 'OUTFLOW', total: '2000000' },
            { month: lastMonth, direction: 'OUTFLOW', total: '7500000' },
          ],
        }),
      );

      const { cashflow } = await service.summary();
      const byMonth = new Map(cashflow.months.map((month) => [month.month, month]));

      expect(byMonth.get(thisMonth)).toMatchObject({
        inflow: 5_000_000,
        outflow: 2_000_000,
        net: 3_000_000,
      });
      expect(byMonth.get(lastMonth)).toMatchObject({
        inflow: 0,
        outflow: 7_500_000,
        net: -7_500_000,
      });
      expect(cashflow.totals).toEqual({
        inflow: 5_000_000,
        outflow: 9_500_000,
        net: -4_500_000,
      });
    });

    it('ignores rows that fall outside the 12-month window', async () => {
      const service = await build(
        results({
          5: [
            { month: monthKey(0), direction: 'INFLOW', total: '1000000' },
            { month: monthKey(40), direction: 'INFLOW', total: '999000000' },
          ],
        }),
      );

      const { cashflow } = await service.summary();

      expect(cashflow.totals.inflow).toBe(1_000_000);
    });
  });

  describe('valuation by asset type', () => {
    it('turns each group into a share of the portfolio total', async () => {
      const service = await build(
        results({
          6: [
            { type: 'PRIVATE_EQUITY', value: '2100000000', cost_basis: '800000000', investments: 120 },
            { type: 'CRYPTO', value: '900000000', cost_basis: '400000000', investments: 40 },
          ],
        }),
      );

      const { valuationByAssetType } = await service.summary();

      expect(valuationByAssetType).toEqual([
        {
          type: 'PRIVATE_EQUITY',
          value: 2_100_000_000,
          costBasis: 800_000_000,
          investments: 120,
          sharePct: 70,
        },
        {
          type: 'CRYPTO',
          value: 900_000_000,
          costBasis: 400_000_000,
          investments: 40,
          sharePct: 30,
        },
      ]);
    });
  });

  describe('distributions and capital', () => {
    it('counts declared and approved payouts as the pending liability', async () => {
      const service = await build(results());
      const { distributions } = await service.summary();

      expect(distributions.paid).toBe(48_000_000);
      expect(distributions.pending).toBe(13_000_000);
      expect(distributions.byStatus).toHaveLength(3);
    });

    it('derives uncalled capital from the commitment less what is deployed', async () => {
      const service = await build(results());
      const { committedVsDeployed } = await service.summary();

      expect(committedVsDeployed).toEqual({
        committed: 1_500_000_000,
        deployed: 1_200_000_000,
        uncalled: 300_000_000,
        deployedPct: 80,
      });
    });

    it('never reports negative uncalled capital when a position is over-called', async () => {
      const service = await build(
        results({
          0: {
            _sum: {
              currentValuation: decimal(10),
              costBasis: decimal(10),
              committedAmount: decimal(100),
              investedAmount: decimal(140),
            },
          },
        }),
      );

      const { committedVsDeployed } = await service.summary();

      expect(committedVsDeployed.uncalled).toBe(0);
    });
  });

  it('reads the whole overview in a single database round-trip', async () => {
    const prisma = buildPrismaMock(results());
    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    await moduleRef.get(DashboardService).summary();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
