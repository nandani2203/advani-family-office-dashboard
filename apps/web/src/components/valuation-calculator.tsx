'use client';

import { Calculator } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney, formatSignedPercent } from '@/lib/format';
import type { Investment } from '@/lib/types';
import { cn } from '@/lib/utils';

const MULTIPLES = [1.5, 2, 3, 5, 10];

/**
 * A what-if tool, not a form that writes anything — every number here is
 * computed client-side from the same gain formula used in the table and on
 * the overview. Picking a position just prefills the inputs; nothing is
 * persisted until someone records an actual mark.
 */
export function ValuationCalculator({ positions }: { positions: Investment[] }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [investmentId, setInvestmentId] = useState<string>('');
  const [costBasis, setCostBasis] = useState('');
  const [valuation, setValuation] = useState('');
  const [ownershipPct, setOwnershipPct] = useState('');

  const applyPosition = (id: string): void => {
    setInvestmentId(id);
    const position = positions.find((row) => row.id === id);
    if (!position) return;
    setCostBasis(String(position.costBasis));
    setValuation(String(position.currentValuation));
    setOwnershipPct(position.ownershipPct === null ? '' : String(position.ownershipPct));
  };

  const cost = Number(costBasis) || 0;
  const value = Number(valuation) || 0;
  const ownership = ownershipPct === '' ? null : Number(ownershipPct);

  const result = useMemo(() => {
    const gain = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const moic = cost > 0 ? value / cost : 0;
    const proceeds = ownership !== null && !Number.isNaN(ownership) ? value * (ownership / 100) : null;
    return { gain, gainPct, moic, proceeds };
  }, [cost, value, ownership]);

  const reset = (): void => {
    setInvestmentId('');
    setCostBasis('');
    setValuation('');
    setOwnershipPct('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calculator className="h-4 w-4" />
          Valuation calculator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Valuation calculator</DialogTitle>
          <DialogDescription>
            A what-if tool — nothing here is saved. To record a real mark, use &ldquo;Record
            valuation&rdquo; on the position itself.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {positions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="calc-position">Prefill from a position</Label>
              <Select value={investmentId} onValueChange={applyPosition}>
                <SelectTrigger id="calc-position">
                  <SelectValue placeholder="Choose a position, or enter numbers manually" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.asset.name} — {position.vehicleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="calc-cost">Cost basis (USD)</Label>
              <Input
                id="calc-cost"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={costBasis}
                onChange={(event) => setCostBasis(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="calc-valuation">Hypothetical valuation (USD)</Label>
              <Input
                id="calc-valuation"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={valuation}
                onChange={(event) => setValuation(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Quick multiple of cost:</span>
            {MULTIPLES.map((multiple) => (
              <Button
                key={multiple}
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={cost <= 0}
                onClick={() => setValuation(String(cost * multiple))}
              >
                {multiple}×
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="calc-ownership">Ownership % (optional)</Label>
            <Input
              id="calc-ownership"
              type="number"
              min={0}
              max={100}
              step="0.0001"
              className="tabular"
              value={ownershipPct}
              onChange={(event) => setOwnershipPct(event.target.value)}
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3">
            <div>
              <dt className="text-xs text-muted-foreground">Gain</dt>
              <dd
                className={cn(
                  'text-sm font-medium tabular',
                  result.gain > 0 && 'text-positive',
                  result.gain < 0 && 'text-negative',
                )}
              >
                {formatMoney(result.gain)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Gain %</dt>
              <dd
                className={cn(
                  'text-sm font-medium tabular',
                  result.gain > 0 && 'text-positive',
                  result.gain < 0 && 'text-negative',
                )}
              >
                {formatSignedPercent(result.gainPct)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">MOIC</dt>
              <dd className="text-sm font-medium tabular">{result.moic.toFixed(2)}×</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Prorated proceeds</dt>
              <dd className="text-sm font-medium tabular">
                {result.proceeds === null ? '—' : formatMoney(result.proceeds)}
              </dd>
            </div>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
