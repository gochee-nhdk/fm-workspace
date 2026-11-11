import React from 'react';
import { POTrackerItemLine } from '@/types/po-tracker';
import { cn } from '@/lib/utils';

interface POProgressBarProps {
  status?: string;
  items?: POTrackerItemLine[];
  /** If no items, use these direct values */
  received?: number;
  total?: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const POProgressBar: React.FC<POProgressBarProps> = ({
  status,
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

  let pct = totalQty > 0 ? Math.min(100, Math.round((receivedQty / totalQty) * 100)) : 0;
  if (status === 'received') {
    pct = 100;
  }

  // Smooth Apple gradients for Liquid Bar
  const gradientClass =
    pct === 100
      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_1px_4px_rgba(16,185,129,0.3)]'
      : pct > 0
      ? 'bg-gradient-to-r from-[#007AFF] via-[#0088FF] to-[#00C7BE] shadow-[0_1px_4px_rgba(0,122,255,0.25)]'
      : 'bg-zinc-300 dark:bg-zinc-700';

  const heightClass = size === 'sm' ? 'h-2' : 'h-2.5';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-xs p-[0.5px] overflow-hidden',
          heightClass
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            gradientClass
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11.5px] font-semibold tabular-nums text-[#48484a] dark:text-[#a1a1a6] shrink-0 w-9 text-right">
          {pct}%
        </span>
      )}
    </div>
  );
};
