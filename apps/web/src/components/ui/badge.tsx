import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Status colours are semantic, not decorative: `positive` always means money or
 * work in a good state, `warning` means attention, `negative` means a problem.
 * Chart hues never appear here.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        positive: 'border-positive/25 bg-positive/10 text-positive',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        negative: 'border-negative/25 bg-negative/10 text-negative',
        info: 'border-chart-1/25 bg-chart-1/10 text-chart-1',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
