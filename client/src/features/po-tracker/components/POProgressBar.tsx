import React from 'react';
import { POTrackerItemLine } from '@/types/po-tracker';
import { cn } from '@/lib/utils';

interface POProgressBarProps {
  items?: POTrackerItemLine[];
  /** If no items, use these direct values */
  received?: number;
  total?: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const POProgressBar: React.FC<POProgressBarProps> = ({
  items,
  received,
  total,
  className,
  showLabel = true,
  size = 'md',
}) => {
  let totalQty = total ?? 0;
  let receivedQty = received ?? 0;

  if (items && items.length > 0) {
    totalQty = items.reduce((sum, i) => sum + (i.ordered_qty || 0), 0);
    receivedQty = items.reduce((sum, i) => sum + (i.received_qty || 0), 0);
  }

  const pct = totalQty > 0 ? Math.min(100, Math.round((receivedQty / totalQty) * 100)) : 0;

  const barColor =
    pct === 100
      ? 'bg-emerald-500'
      : pct >= 50
      ? 'bg-blue-500'
      : pct > 0
      ? 'bg-amber-500'
      : 'bg-zinc-300 dark:bg-zinc-600';

  const heightClass = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden', heightClass)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold tabular-nums text-[#555558] dark:text-[#a1a1a6] shrink-0 w-9 text-right">
          {pct}%
        </span>
      )}
    </div>
  );
};
