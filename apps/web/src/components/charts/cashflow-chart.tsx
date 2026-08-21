'use client';

import { Table2 } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
 * One horizontal bar per month, split into three stacked segments — inflow,
 * outflow and net — each in its own hue, with all three values also listed on
 * hover.
 *
 * Read the bar as three quantities shown side by side, not as a sum: `net` is
 * `inflow − outflow`, so it is a restatement of the other two rather than a
 * third thing added to them, and the bar's full length is therefore not a
 * meaningful figure. That is why no total is printed at the end of the bar and
 * why the x-axis carries no cumulative label — each segment is annotated with
 * its own value instead, and "Show table" gives the exact numbers.
 *
 * Colours come from the first three categorical chart slots, which is the range
 * the palette validates for colour-vision-deficiency separation. Note the
 * deliberate move away from the positive/negative money tokens: these are three
 * series now, and per the palette rules a number's sign should not look like a
 * series. Net keeps one fixed hue whatever its sign; the sign is carried by the
 * number, and the segment's length is its magnitude.
 */
const SERIES = [
  { key: 'inflow', plotKey: 'inflow', label: 'Inflow', color: 'hsl(var(--chart-1))' },
  { key: 'outflow', plotKey: 'outflow', label: 'Outflow', color: 'hsl(var(--chart-2))' },
  // Stacking needs a non-negative length, so the magnitude is plotted and the
  // signed value is what gets labelled.
  { key: 'net', plotKey: 'netMagnitude', label: 'Net', color: 'hsl(var(--chart-3))' },
] as const;

const MILLION = 1_000_000;

/**
 * Label sizing. Segment values here span three orders of magnitude, so a fixed
 * width threshold either loses most of the labels or lets them spill over a
 * neighbouring segment. Instead each label is measured: the most precise form
 * that fits is used, falling back to fewer decimals, and only a segment too
 * narrow even for a single digit goes unlabelled.
 *
 * A digit is ~0.55em, so ~5px at the 9px size these are drawn at, and the
 * padding keeps the text clear of the segment's edges.
 */
const LABEL_DIGIT_PX = 5;
const LABEL_PADDING_PX = 6;

/**
 * The widest form of `value` that fits in `width`, in unit-free millions — the
 * axis and legend carry the currency and scale, so repeating "$…M" inside every
 * segment costs the room the number needs.
 *
 * Returns null when nothing fits, and also when the value would round to zero:
 * a segment labelled "0" reads as nothing there, which is worse than no label.
 */
function fitLabel(value: number, width: number): string | null {
  for (const digits of [1, 0]) {
    const text = (value / MILLION).toFixed(digits);
    if (Number.parseFloat(text) === 0) continue;
    if (text.length * LABEL_DIGIT_PX + LABEL_PADDING_PX <= width) return text;
  }

  return null;
}

type Row = Month & { tick: string; netMagnitude: number };

function shortLabel(month: Month): string {
  // "Sep 2025" is too wide for twelve ticks on a laptop; "Sep" plus the year on
  // January is enough to place the axis.
  const [name, year] = month.label.split(' ');
  return name === 'Jan' ? `${name} ${year.slice(2)}` : name;
}

/**
 * Recharts types a label's geometry as `string | number`, since an SVG
 * attribute can carry either, so these are widened here and coerced below
 * rather than asserted away.
 */
interface SegmentLabelProps {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  /** Row position, used to recover the signed figure behind a plotted width. */
  index?: number;
}

/**
 * Draws a value inside its own segment, and drops it when the segment is too
 * narrow to hold it rather than letting it spill over a neighbour.
 */
function makeSegmentLabel(rows: Row[], seriesKey: 'inflow' | 'outflow' | 'net') {
  function SegmentLabel(props: SegmentLabelProps): JSX.Element | null {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const height = Number(props.height ?? 0);
    const index = props.index ?? 0;

    if (!Number.isFinite(width)) return null;

    const row = rows[index];
    if (!row) return null;

    const text = fitLabel(row[seriesKey], width);
    if (text === null) return null;

    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-[9px] font-medium tabular"
      >
        {text}
      </text>
    );
  }

  return SegmentLabel;
}

interface TooltipPayloadEntry {
  payload: Row;
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

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{month.label}</p>
      <dl className="flex flex-col gap-1">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: series.color }}
            />
            <dt className="text-muted-foreground">{series.label}</dt>
            <dd className="ml-auto pl-4 font-medium text-popover-foreground tabular">
              {formatMoney(month[series.key])}
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
  const data: Row[] = cashflow.months.map((month) => ({
    ...month,
    tick: shortLabel(month),
    netMagnitude: Math.abs(month.net),
  }));
  const hasActivity = cashflow.months.some((month) => month.inflow !== 0 || month.outflow !== 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-4">
          {SERIES.map((series) => (
            <li
              key={series.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
            </li>
          ))}
          <li className="text-xs text-muted-foreground">
            · bar labels in $M · hover a bar for exact figures
          </li>
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
        <div className="w-full" style={{ height: Math.max(280, data.length * 34) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(value: number) => formatCompactMoney(value)}
              />
              <YAxis
                dataKey="tick"
                type="category"
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                content={<CashflowTooltip />}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
              />
              {SERIES.map((series, position) => (
                <Bar
                  key={series.key}
                  dataKey={series.plotKey}
                  name={series.label}
                  stackId="flow"
                  fill={series.color}
                  maxBarSize={22}
                  // Round only the outer ends so the stack reads as one bar.
                  radius={
                    position === 0
                      ? [4, 0, 0, 4]
                      : position === SERIES.length - 1
                        ? [0, 4, 4, 0]
                        : [0, 0, 0, 0]
                  }
                >
                  <LabelList content={makeSegmentLabel(data, series.key)} />
                </Bar>
              ))}
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
