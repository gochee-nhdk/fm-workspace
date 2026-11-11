import React from 'react';
import { POTrackerStats, POFilterStatus } from '@/types/po-tracker';
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
  activeStatus: POFilterStatus | null;
  onStatusFilter: (status: POFilterStatus | null) => void;
}

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  bg: string;
  onClick?: () => void;
  active?: boolean;
  pulse?: boolean;
}> = ({ label, value, icon, bg, onClick, active, pulse }) => (
  <button
    onClick={onClick}
    type="button"
    className={cn(
      'group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-200 ease-out cursor-pointer select-none text-left min-w-[150px]',
      active
        ? 'glass-material bg-white/95 dark:bg-[#1f1f26]/95 border-[#0066cc] dark:border-[#2997ff] ring-2 ring-[#0066cc]/30 dark:ring-[#2997ff]/40 ring-offset-1 ring-offset-white dark:ring-offset-[#16161c] shadow-[0_4px_20px_rgba(0,102,204,0.18)]'
        : 'glass-material hover:bg-white/90 dark:hover:bg-white/10 border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-xs',
      !onClick && 'cursor-default pointer-events-none'
    )}
  >
    <div
      className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-2xs',
        bg,
        pulse && 'animate-pulse'
      )}
    >
      {icon}
    </div>
    <div className="min-w-0 pr-1">
      <div
        className={cn(
          'text-[22px] font-bold tracking-tight tabular-nums leading-none',
          active ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-[#1d1d1f] dark:text-white'
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'text-[11.5px] font-medium whitespace-nowrap mt-1.5 transition-colors',
          active ? 'text-[#0066cc] dark:text-[#2997ff] font-semibold' : 'text-[#86868b] dark:text-[#a1a1a6]'
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
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1.5 pt-0.5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[150px] h-[66px] rounded-2xl glass-material border border-black/5 dark:border-white/10 animate-pulse"
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

  // Khắc phục triệt để lỗi đếm quá hạn nhân đôi
  const totalOverdue = s.overdue ?? s.actually_overdue ?? 0;

  const cards: {
    key: string;
    label: string;
    value: number;
    icon: React.ReactNode;
    bg: string;
    status: POFilterStatus | null;
    pulse?: boolean;
  }[] = [
    {
      key: 'all',
      label: 'Tổng đơn PO',
      value: s.total || 0,
      icon: <SFShippingbox size={18} className="text-[#0066cc] dark:text-[#2997ff]" />,
      bg: 'bg-[#0066cc]/10 dark:bg-[#0066cc]/20',
      status: null,
    },
    {
      key: 'pending',
      label: 'Chờ xác nhận',
      value: s.pending || 0,
      icon: <SFClockFill size={18} className="text-amber-500" />,
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      status: 'pending',
    },
    {
      key: 'shipping',
      label: 'Đang giao hàng',
      value: s.shipping || 0,
      icon: <SFTray2Fill size={18} className="text-indigo-500" />,
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      status: 'shipping',
    },
    {
      key: 'overdue',
      label: 'Quá hạn giao',
      value: totalOverdue,
      icon: <SFExclamationmarkTriangleFill size={18} className="text-rose-500" />,
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      status: 'overdue',
      pulse: totalOverdue > 0,
    },
    {
      key: 'received',
      label: 'Đã nhận đủ',
      value: s.received || 0,
      icon: <SFCheckmarkCircleFill size={18} className="text-emerald-500" />,
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      status: 'received',
    },
    {
      key: 'upcoming_7_days',
      label: 'Hạn 7 ngày tới',
      value: s.upcoming_7_days || 0,
      icon: <SFCalendar size={18} className="text-purple-500" />,
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
      status: 'upcoming_7_days',
    },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1.5 pt-0.5">
      {cards.map((card) => {
        const isCurrentActive =
          card.status === null
            ? activeStatus === null
            : activeStatus === card.status;

        return (
          <div key={card.key} className="shrink-0">
            <StatCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              bg={card.bg}
              active={isCurrentActive}
              pulse={card.pulse}
              onClick={() => {
                if (card.status === null) {
                  onStatusFilter(null);
                } else {
                  onStatusFilter(activeStatus === card.status ? null : card.status);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
