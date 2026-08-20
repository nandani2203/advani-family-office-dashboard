'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ASSET_TYPE_LABELS, type DashboardSummary } from '@/lib/types';
import { formatCompactMoney, formatMoney, formatPercent } from '@/lib/format';

type Slice = DashboardSummary['valuationByAssetType'][number];

/**
 * Seven asset classes ranked by value. Deliberately one hue rather than seven:
 * the measure is a single magnitude and the category is already named on every
 * bar, so colour would be decoration — and seven categorical hues cannot clear
 * the colour-vision-deficiency gates anyway.
 */
function ValuationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Slice }>;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  const gain = slice.value - slice.costBasis;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{ASSET_TYPE_LABELS[slice.type]}</p>
      <dl className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground">Valuation</dt>
          <dd className="ml-auto font-medium text-popover-foreground tabular">
            {formatMoney(slice.value)}
          </dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground">Share</dt>
          <dd className="ml-auto font-medium text-popover-foreground tabular">
            {formatPercent(slice.sharePct, 1)}
          </dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground">{gain >= 0 ? 'Up' : 'Down'} on cost</dt>
          <dd className="ml-auto font-medium text-popover-foreground tabular">
            {formatCompactMoney(Math.abs(gain))}
          </dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground">Positions</dt>
          <dd className="ml-auto font-medium text-popover-foreground tabular">
            {slice.investments}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ValuationBreakdown({
  slices,
}: {
  slices: DashboardSummary['valuationByAssetType'];
}): JSX.Element {
  if (slices.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No active positions to value yet.
      </p>
    );
  }

  const data = slices.map((slice) => ({ ...slice, label: ASSET_TYPE_LABELS[slice.type] }));
  const height = Math.max(180, data.length * 42);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
          barCategoryGap={10}
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
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={96}
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
          />
          <Tooltip content={<ValuationTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
          <Bar dataKey="value" name="Valuation" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
