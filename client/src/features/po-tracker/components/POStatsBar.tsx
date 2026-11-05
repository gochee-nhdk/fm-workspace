import React from 'react';
import { POTrackerStats, POStatus } from '@/types/po-tracker';
import { PO_STATUS_CONFIG_MAP } from './POStatusPill';
import {
  SFShippingbox,
  SFClockFill,
  SFCheckmarkCircleFill,
  SFExclamationmarkTriangleFill,
  SFCalendar,
  SFTray2Fill
} from 'sf-symbols-lib';
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
  icon: React.ReactNode;
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
      'group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-200 ease-out cursor-pointer select-none text-left',
      active
        ? 'bg-white dark:bg-[#1f1f26] border-[#0088FF] dark:border-[#0A84FF] shadow-[0_2px_12px_rgba(0,136,255,0.14)] ring-1 ring-[#0088FF]/30 dark:ring-[#0A84FF]/30'
        : 'bg-white/80 dark:bg-[#1a1a20]/80 border-black/[0.08] dark:border-white/10 hover:bg-white dark:hover:bg-[#202028] hover:border-black/15 dark:hover:border-white/15 hover:shadow-2xs active:scale-[0.98]',
      !onClick && 'cursor-default pointer-events-none'
    )}
  >
    <div
      className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-2xs',
        bg,
        pulse && 'animate-pulse'
      )}
    >
      {icon}
    </div>
    <div className="min-w-0 pr-1">
      <div
        className={cn(
          'text-[21px] font-black tracking-tight tabular-nums leading-none',
          active ? 'text-[#0088FF] dark:text-[#0A84FF]' : 'text-[#1d1d1f] dark:text-white'
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'text-[12px] font-bold whitespace-nowrap mt-1 transition-colors',
          active ? 'text-[#0088FF] dark:text-[#0A84FF]' : 'text-[#48484a] dark:text-[#d1d1d6]'
        )}
      >
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
  if (loading && !stats) {
    return (
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[140px] h-[64px] rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const s = stats || {
    total: 0,
    pending: 0,
    confirmed: 0,
    shipping: 0,
    partial_received: 0,
    received: 0,
    cancelled: 0,
    overdue: 0,
    actually_overdue: 0,
    upcoming_7_days: 0,
    total_value: 0,
  };

  const totalOverdue = (s.actually_overdue || 0) + (s.overdue || 0);

  const cards = [
    {
      label: 'Tổng đơn PO',
      value: s.total || 0,
      icon: <SFShippingbox size={18} className="text-[#0088FF]" />,
      color: 'text-[#0088FF] dark:text-[#0091FF]',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      status: null as POStatus | null,
    },
    {
      label: 'Chờ xác nhận',
      value: s.pending || 0,
      icon: <SFClockFill size={18} className="text-amber-500" />,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      status: 'pending' as POStatus,
    },
    {
      label: 'Đang giao hàng',
      value: s.shipping || 0,
      icon: <SFTray2Fill size={18} className="text-indigo-500" />,
      color: 'text-indigo-700 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      status: 'shipping' as POStatus,
    },
    {
      label: 'Quá hạn giao',
      value: totalOverdue,
      icon: <SFExclamationmarkTriangleFill size={18} className="text-red-500" />,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10',
      status: 'overdue' as POStatus,
      pulse: totalOverdue > 0,
    },
    {
      label: 'Đã nhận đủ',
      value: s.received || 0,
      icon: <SFCheckmarkCircleFill size={18} className="text-emerald-500" />,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      status: 'received' as POStatus,
    },
    {
      label: 'Hạn 7 ngày tới',
      value: s.upcoming_7_days || 0,
      icon: <SFCalendar size={18} className="text-purple-500" />,
      color: 'text-purple-700 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      status: null,
    },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
      {cards.map((card) => (
        <div key={card.label} className="shrink-0">
          <StatCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            bg={card.bg}
            active={card.label === 'Tổng đơn PO' ? activeStatus === null : activeStatus === card.status}
            pulse={(card as any).pulse}
            onClick={
              card.label === 'Tổng đơn PO'
                ? () => onStatusFilter(null)
                : card.status
                ? () => onStatusFilter(activeStatus === card.status ? null : card.status)
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
};
