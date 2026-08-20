'use client';

import { Table2 } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCompactMoney, formatMoney } from '@/lib/format';
import type { DashboardSummary } from '@/lib/types';

type Month = DashboardSummary['cashflow']['months'][number];

/**
 * One bar per month — the net of inflow and outflow, coloured by sign — with
 * the full breakdown (inflow, outflow, net) surfaced on hover instead of as
 * three grouped bars. Stacking inflow and outflow wouldn't be honest here:
 * outflow reduces the total, it doesn't add to it, so a single signed bar is
 * the correct shape for this data, not just a tidier one.
 *
 * Colours reuse the same positive/negative tokens as the rest of the app
 * (gain/loss on Investments, etc.), so green/red here means the same thing
 * it means everywhere else, and the same numbers are one click away as a table.
 */
const SERIES = [
  { key: 'inflow', label: 'Inflow', color: 'hsl(var(--positive))' },
  { key: 'outflow', label: 'Outflow', color: 'hsl(var(--negative))' },
] as const;

const positiveColor = 'hsl(var(--positive))';
const negativeColor = 'hsl(var(--negative))';

function shortLabel(month: Month): string {
  // "Sep 2025" is too wide for twelve ticks on a laptop; "Sep" plus the year on
  // January is enough to place the axis.
  const [name, year] = month.label.split(' ');
  return name === 'Jan' ? `${name} ${year.slice(2)}` : name;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  payload: Month;
}

function CashflowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const month = payload[0].payload;
  const rows = [...SERIES, { key: 'net' as const, label: 'Net', color: month.net >= 0 ? positiveColor : negativeColor }];

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{month.label}</p>
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
            />
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="ml-auto pl-4 font-medium text-popover-foreground tabular">
              {formatMoney(month[row.key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CashflowChart({
  cashflow,
}: {
  cashflow: DashboardSummary['cashflow'];
}): JSX.Element {
  const [showTable, setShowTable] = useState(false);
  const data = cashflow.months.map((month) => ({ ...month, tick: shortLabel(month) }));
  const hasActivity = cashflow.months.some((month) => month.inflow !== 0 || month.outflow !== 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-4">
          {[
            { label: 'Net inflow', color: positiveColor },
            { label: 'Net outflow', color: negativeColor },
          ].map((item) => (
            <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </li>
          ))}
          <li className="text-xs text-muted-foreground">· hover a bar for the full breakdown</li>
        </ul>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
        >
          <Table2 className="h-4 w-4" />
          {showTable ? 'Hide table' : 'Show table'}
        </Button>
      </div>

      {hasActivity ? (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="tick"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(value: number) => formatCompactMoney(value)}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                content={<CashflowTooltip />}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
              />
              <Bar dataKey="net" name="Net" radius={[4, 4, 4, 4]} maxBarSize={22}>
                {data.map((month) => (
                  <Cell key={month.month} fill={month.net >= 0 ? positiveColor : negativeColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">
            No transactions in the last twelve months.
          </p>
        </div>
      )}

      {showTable ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Inflow</TableHead>
              <TableHead className="text-right">Outflow</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashflow.months.map((month) => (
              <TableRow key={month.month}>
                <TableCell className="whitespace-nowrap">{month.label}</TableCell>
                <TableCell className="text-right tabular">{formatMoney(month.inflow)}</TableCell>
                <TableCell className="text-right tabular">{formatMoney(month.outflow)}</TableCell>
                <TableCell className="text-right tabular font-medium">
                  {formatMoney(month.net)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 hover:bg-transparent">
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right tabular font-medium">
                {formatMoney(cashflow.totals.inflow)}
              </TableCell>
              <TableCell className="text-right tabular font-medium">
                {formatMoney(cashflow.totals.outflow)}
              </TableCell>
              <TableCell className="text-right tabular font-medium">
                {formatMoney(cashflow.totals.net)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
