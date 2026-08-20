'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CashflowChart } from '@/components/charts/cashflow-chart';
import { ValuationBreakdown } from '@/components/charts/valuation-breakdown';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { FilingStatusBadge, TransactionStatusBadge } from '@/components/status-badge';
import {
  daysUntil,
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedPercent,
} from '@/lib/format';
import { useResource } from '@/lib/use-list';
import {
  FILING_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  type DashboardSummary,
} from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage(): JSX.Element {
  const { data, loading, error, refresh } = useResource<DashboardSummary>('/dashboard/summary');

  if (error) {
    return (
      <>
        <PageHeader title="Overview" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-medium">Could not load the overview</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  if (loading || !data) return <DashboardSkeleton />;

  const { kpis, cashflow, distributions, committedVsDeployed } = data;
  const distributionsTotal = distributions.paid + distributions.pending;

  return (
    <>
      <PageHeader
        title="Overview"
        description="What we own, what it is worth, what moved, and what is due."
      >
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio valuation"
          value={formatCompactMoney(kpis.portfolioValuation)}
          hint="Active positions, at the latest mark"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Unrealised gain"
          value={formatCompactMoney(kpis.unrealisedGain)}
          hint="Valuation less cost basis"
          delta={{
            text: formatSignedPercent(kpis.unrealisedGainPct),
            direction:
              kpis.unrealisedGain > 0 ? 'up' : kpis.unrealisedGain < 0 ? 'down' : 'flat',
          }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Investments"
          value={formatNumber(kpis.investments)}
          hint={`${formatNumber(kpis.activeInvestments)} active, excluding voided transactions`}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Upcoming filings"
          value={formatNumber(kpis.upcomingFilings)}
          hint={`Due in the next ${kpis.upcomingFilingsWindowDays} days`}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cashflow, last 12 months</CardTitle>
          <CardDescription>
            Settled and pending transactions in USD. Voided entries are excluded. Net for the
            period: <span className="font-medium tabular">{formatMoney(cashflow.totals.net)}</span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowChart cashflow={cashflow} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valuation by asset type</CardTitle>
          <CardDescription>Share of the active portfolio.</CardDescription>
        </CardHeader>
        <CardContent>
          <ValuationBreakdown slices={data.valuationByAssetType} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>The last eight entries in the ledger.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/transactions">
                View ledger
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {data.recentTransactions.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Investment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap pl-5 text-muted-foreground">
                        {formatDate(transaction.occurredAt)}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <p className="truncate font-medium">{transaction.investment.asset.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {transaction.investment.vehicleName}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                      </TableCell>
                      <TableCell>
                        <TransactionStatusBadge status={transaction.status} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap pr-5 text-right font-medium tabular',
                          transaction.direction === 'INFLOW' ? 'text-positive' : 'text-foreground',
                        )}
                      >
                        {transaction.direction === 'INFLOW' ? '+' : '−'}
                        {formatMoney(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Distributions</CardTitle>
              <CardDescription>Paid against what is still owed to LPs.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Paid</span>
                <span className="text-sm font-medium tabular">
                  {formatCompactMoney(distributions.paid)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="text-sm font-medium tabular">
                  {formatCompactMoney(distributions.pending)}
                </span>
              </div>

              {/* One bar, two segments, 2px of surface between them. */}
              <div
                className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded"
                role="img"
                aria-label={`Paid ${formatMoney(distributions.paid)}, pending ${formatMoney(
                  distributions.pending,
                )}`}
              >
                <div
                  className="h-full rounded bg-chart-3"
                  style={{
                    width: `${
                      distributionsTotal > 0 ? (distributions.paid / distributionsTotal) * 100 : 0
                    }%`,
                  }}
                />
                <div
                  className="h-full rounded bg-chart-2"
                  style={{
                    width: `${
                      distributionsTotal > 0
                        ? (distributions.pending / distributionsTotal) * 100
                        : 0
                    }%`,
                  }}
                />
                {distributionsTotal === 0 ? <div className="h-full w-full bg-muted" /> : null}
              </div>

              <ul className="flex flex-wrap gap-4">
                <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="h-2 w-2 rounded-sm bg-chart-3" />
                  Paid
                </li>
                <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="h-2 w-2 rounded-sm bg-chart-2" />
                  Declared or approved
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Committed vs deployed</CardTitle>
              <CardDescription>
                {formatPercent(committedVsDeployed.deployedPct)} of commitments called down.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-chart-1"
                  style={{ width: `${Math.min(100, committedVsDeployed.deployedPct)}%` }}
                />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Committed</dt>
                  <dd className="mt-0.5 font-medium tabular">
                    {formatCompactMoney(committedVsDeployed.committed)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Deployed</dt>
                  <dd className="mt-0.5 font-medium tabular">
                    {formatCompactMoney(committedVsDeployed.deployed)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Uncalled</dt>
                  <dd className="mt-0.5 font-medium tabular">
                    {formatCompactMoney(committedVsDeployed.uncalled)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Filings due soon</CardTitle>
            <CardDescription>
              Open compliance work inside the next {kpis.upcomingFilingsWindowDays} days.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/filings">
              All filings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.upcomingFilings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the window. </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.upcomingFilings.map((filing) => {
                const days = daysUntil(filing.dueDate);
                const overdue = days !== null && days < 0;

                return (
                  <li
                    key={filing.id}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{filing.vehicleName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {FILING_TYPE_LABELS[filing.type]}
                        {filing.jurisdiction ? ` · ${filing.jurisdiction}` : ''}
                        {filing.assignee ? ` · ${filing.assignee.name ?? filing.assignee.email}` : ''}
                      </p>
                    </div>
                    <FilingStatusBadge status={filing.status} />
                    <div className="w-28 text-right">
                      <p className="text-sm tabular">{formatDate(filing.dueDate)}</p>
                      <p
                        className={cn(
                          'text-xs tabular',
                          overdue ? 'font-medium text-negative' : 'text-muted-foreground',
                        )}
                      >
                        {overdue ? `${Math.abs(days)} days overdue` : `in ${days} days`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function DashboardSkeleton(): JSX.Element {
  return (
    <>
      <PageHeader title="Overview" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-lg" />
      <Skeleton className="h-[320px] rounded-lg" />
      <Skeleton className="h-[320px] rounded-lg" />
    </>
  );
}
