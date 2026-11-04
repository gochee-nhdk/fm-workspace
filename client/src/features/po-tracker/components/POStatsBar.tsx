import React from 'react';
import { POTrackerStats, POStatus, PO_STATUS_CONFIG } from '@/types/po-tracker';
import { cn } from '@/lib/utils';

interface POStatsBarProps {
  stats: POTrackerStats | null;
  loading?: boolean;
  activeStatus: POStatus | null;
  onStatusFilter: (status: POStatus | null) => void;
}

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: string;
  color: string;
  bg: string;
  onClick?: () => void;
  active?: boolean;
  pulse?: boolean;
}> = ({ label, value, icon, color, bg, onClick, active, pulse }) => (
  <button
    onClick={onClick}
    type="button"
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] text-left select-none',
      active
        ? `${bg} border-current ${color} shadow-sm ring-1 ring-current/20`
        : 'bg-white/50 dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.07] hover:bg-white/80 dark:hover:bg-white/[0.08]',
      !onClick && 'cursor-default pointer-events-none'
    )}
  >
    <span className={cn('text-xl leading-none', pulse && 'animate-pulse')}>
      {icon}
    </span>
    <div className="min-w-0">
      <div className={cn('text-[20px] font-bold tabular-nums leading-tight', active ? color : 'text-[#1d1d1f] dark:text-white')}>
        {value}
      </div>
      <div className="text-[11px] font-medium text-[#555558] dark:text-[#a1a1a6] whitespace-nowrap">
        {label}
      </div>
    </div>
  </button>
);

export const POStatsBar: React.FC<POStatsBarProps> = ({
  stats,
  loading,
  activeStatus,
  onStatusFilter,
}) => {
  if (loading || !stats) {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[140px] h-[72px] rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const totalOverdue = (stats.actually_overdue || 0) + (stats.overdue || 0);

  const cards = [
    {
      label: 'Tổng PO',
      value: stats.total,
      icon: '📋',
      color: 'text-[#0088FF] dark:text-[#0091FF]',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      status: null as POStatus | null,
    },
    {
      label: 'Chờ xác nhận',
      value: stats.pending,
      icon: '⏳',
      color: PO_STATUS_CONFIG.pending.color,
      bg: PO_STATUS_CONFIG.pending.bg,
      status: 'pending' as POStatus,
    },
    {
      label: 'Đang giao',
      value: stats.shipping,
      icon: '🚚',
      color: PO_STATUS_CONFIG.shipping.color,
      bg: PO_STATUS_CONFIG.shipping.bg,
      status: 'shipping' as POStatus,
    },
    {
      label: 'Quá hạn',
      value: totalOverdue,
      icon: '⚠️',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10',
      status: 'overdue' as POStatus,
      pulse: totalOverdue > 0,
    },
    {
      label: 'Đã nhận đủ',
      value: stats.received,
      icon: '✅',
      color: PO_STATUS_CONFIG.received.color,
      bg: PO_STATUS_CONFIG.received.bg,
      status: 'received' as POStatus,
    },
    {
      label: 'Sắp giao (7 ngày)',
      value: stats.upcoming_7_days,
      icon: '📅',
      color: 'text-purple-700 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      status: null,
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
      {cards.map((card) => (
        <div key={card.label} className="shrink-0">
          <StatCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            bg={card.bg}
            active={activeStatus === card.status && card.status !== null}
            pulse={(card as any).pulse}
            onClick={
              card.status
                ? () => onStatusFilter(activeStatus === card.status ? null : card.status)
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
};
