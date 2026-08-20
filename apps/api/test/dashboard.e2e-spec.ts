import { InvestmentStatus, Role, TransactionStatus } from '@prisma/client';
import { Harness, createHarness, purgeUsers } from './harness';

/**
 * Checks `/dashboard/summary` against what is actually in the database, rather
 * than against hard-coded numbers — so the suite passes on the seeded portfolio
 * and on whatever a reviewer has since edited.
 */
describe('Dashboard summary (e2e)', () => {
  let harness: Harness;
  const EMAIL = 'e2e-dashboard@advanifamilyoffice.com';
  let auth: { Authorization: string };
  let summary: Record<string, any>;

  beforeAll(async () => {
    harness = await createHarness();
    await purgeUsers(harness.prisma, [EMAIL]);

    const session = await harness.signIn(EMAIL, Role.VIEWER);
    auth = session.auth;

    const response = await harness.http().get('/api/dashboard/summary').set(auth).expect(200);
    summary = response.body;
  });

  afterAll(async () => {
    await purgeUsers(harness.prisma, [EMAIL]);
    await harness.close();
  });

  it('answers in a single request with every panel populated', () => {
    expect(Object.keys(summary).sort()).toEqual(
      [
        'cashflow',
        'committedVsDeployed',
        'distributions',
        'generatedAt',
        'kpis',
        'recentTransactions',
        'upcomingFilings',
        'valuationByAssetType',
      ].sort(),
    );
  });

  it('reports the portfolio valuation as the sum of active positions', async () => {
    const active = await harness.prisma.investment.aggregate({
      where: { status: InvestmentStatus.ACTIVE },
      _sum: { currentValuation: true, costBasis: true },
    });

    const expected = Number(active._sum.currentValuation ?? 0);
    const expectedCost = Number(active._sum.costBasis ?? 0);

    expect(summary.kpis.portfolioValuation).toBeCloseTo(expected, 2);
    expect(summary.kpis.costBasis).toBeCloseTo(expectedCost, 2);
    expect(summary.kpis.unrealisedGain).toBeCloseTo(expected - expectedCost, 2);
  });

  it('counts investments including the ones that are no longer active', async () => {
    const [all, active] = await Promise.all([
      harness.prisma.investment.count(),
      harness.prisma.investment.count({ where: { status: InvestmentStatus.ACTIVE } }),
    ]);

    expect(summary.kpis.investments).toBe(all);
    expect(summary.kpis.activeInvestments).toBe(active);
    expect(summary.kpis.investments).toBeGreaterThanOrEqual(summary.kpis.activeInvestments);
  });

  it('counts filings that are due inside the window and not yet closed', async () => {
    const expected = await harness.prisma.filing.count({
      where: {
        status: { not: 'CLOSED' },
        dueDate: { lte: new Date(Date.now() + summary.kpis.upcomingFilingsWindowDays * 86_400_000) },
      },
    });

    expect(summary.kpis.upcomingFilings).toBe(expected);
    expect(summary.upcomingFilings.length).toBeLessThanOrEqual(6);
  });

  describe('cashflow', () => {
    it('covers exactly twelve consecutive months, oldest first', () => {
      const months: string[] = summary.cashflow.months.map((month: any) => month.month);

      expect(months).toHaveLength(12);
      expect([...months].sort()).toEqual(months);
      expect(months.every((month) => /^\d{4}-\d{2}$/.test(month))).toBe(true);
    });

    it('nets each month and the total consistently', () => {
      for (const month of summary.cashflow.months) {
        expect(month.net).toBeCloseTo(month.inflow - month.outflow, 2);
      }

      const inflow = summary.cashflow.months.reduce((sum: number, m: any) => sum + m.inflow, 0);
      expect(summary.cashflow.totals.inflow).toBeCloseTo(inflow, 2);
      expect(summary.cashflow.totals.net).toBeCloseTo(
        summary.cashflow.totals.inflow - summary.cashflow.totals.outflow,
        2,
      );
    });

    it('excludes voided transactions from the chart', async () => {
      // The chart covers whole months, so bound the comparison the same way:
      // from the first charted month to the end of the current one.
      const windowStart = new Date(`${summary.cashflow.months[0].month}-01T00:00:00.000Z`);
      const lastMonth = summary.cashflow.months[11].month.split('-').map(Number);
      const windowEnd = new Date(Date.UTC(lastMonth[0], lastMonth[1], 1));
      const occurredAt = { gte: windowStart, lt: windowEnd };

      const [voided, notVoided] = await Promise.all([
        harness.prisma.transaction.aggregate({
          where: { status: TransactionStatus.VOID, occurredAt },
          _sum: { amount: true },
        }),
        harness.prisma.transaction.aggregate({
          where: { status: { not: TransactionStatus.VOID }, occurredAt },
          _sum: { amount: true },
        }),
      ]);

      const charted = summary.cashflow.totals.inflow + summary.cashflow.totals.outflow;

      expect(charted).toBeCloseTo(Number(notVoided._sum.amount ?? 0), 0);
      // And the seed always voids a few rows, so this is a real exclusion.
      expect(Number(voided._sum.amount ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('valuation by asset type', () => {
    it('adds up to the portfolio valuation', () => {
      const total = summary.valuationByAssetType.reduce((sum: number, slice: any) => sum + slice.value, 0);

      expect(total).toBeCloseTo(summary.kpis.portfolioValuation, 0);
    });

    it('shares add up to 100 percent', () => {
      if (summary.valuationByAssetType.length === 0) return;

      const shares = summary.valuationByAssetType.reduce(
        (sum: number, slice: any) => sum + slice.sharePct,
        0,
      );

      expect(shares).toBeCloseTo(100, 4);
    });

    it('is ordered from the largest holding down', () => {
      const values = summary.valuationByAssetType.map((slice: any) => slice.value);

      expect(values).toEqual([...values].sort((a: number, b: number) => b - a));
    });
  });

  describe('distributions and capital', () => {
    it('separates what has been paid from what is still owed', async () => {
      const paid = await harness.prisma.distribution.aggregate({
        where: { status: 'PAID' },
        _sum: { netAmount: true },
      });
      const pending = await harness.prisma.distribution.aggregate({
        where: { status: { in: ['DECLARED', 'APPROVED'] } },
        _sum: { netAmount: true },
      });

      expect(summary.distributions.paid).toBeCloseTo(Number(paid._sum.netAmount ?? 0), 2);
      expect(summary.distributions.pending).toBeCloseTo(Number(pending._sum.netAmount ?? 0), 2);
    });

    it('never reports more deployed than committed as uncalled', () => {
      const { committed, deployed, uncalled } = summary.committedVsDeployed;

      expect(uncalled).toBeGreaterThanOrEqual(0);
      expect(uncalled).toBeCloseTo(Math.max(0, committed - deployed), 2);
    });
  });

  it('serialises money as numbers, not Prisma Decimal objects', () => {
    expect(typeof summary.kpis.portfolioValuation).toBe('number');

    for (const transaction of summary.recentTransactions) {
      expect(typeof transaction.amount).toBe('number');
      expect(typeof transaction.occurredAt).toBe('string');
    }
  });

  it('is reachable by any authenticated role but not anonymously', async () => {
    await harness.http().get('/api/dashboard/summary').expect(401);
    await harness.http().get('/api/dashboard/summary').set(auth).expect(200);
  });
});
