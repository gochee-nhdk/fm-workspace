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
  activeBorderColor: string;
  activeTextColor: string;
  activeGlow: string;
  onClick?: () => void;
  active?: boolean;
  pulse?: boolean;
}> = ({ label, value, icon, bg, activeBorderColor, activeTextColor, activeGlow, onClick, active, pulse }) => (
  <button
    onClick={onClick}
    type="button"
    className={cn(
      'group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 transition-all duration-200 ease-out cursor-pointer select-none text-left min-w-[145px]',
      active
        ? cn('bg-white dark:bg-[#1f1f26]', activeBorderColor, activeGlow)
        : 'bg-white/80 dark:bg-[#1a1a20]/80 border-black/[0.08] dark:border-white/10 hover:bg-white dark:hover:bg-[#202028] hover:border-black/20 dark:hover:border-white/20 active:scale-[0.98]',
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
          active ? activeTextColor : 'text-[#1d1d1f] dark:text-white'
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'text-[12px] font-bold whitespace-nowrap mt-1 transition-colors',
          active ? activeTextColor : 'text-[#555558] dark:text-[#a1a1a6]'
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
            className="shrink-0 w-[145px] h-[64px] rounded-2xl bg-white/40 dark:bg-white/[0.04] border-2 border-black/[0.06] dark:border-white/[0.07] animate-pulse"
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
    activeBorderColor: string;
    activeTextColor: string;
    activeGlow: string;
    status: POFilterStatus | null;
    pulse?: boolean;
  }[] = [
    {
      key: 'all',
      label: 'Tổng đơn PO',
      value: s.total || 0,
      icon: <SFShippingbox size={18} className="text-[#0088FF]" />,
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      activeBorderColor: 'border-[#0088FF] dark:border-[#0A84FF]',
      activeTextColor: 'text-[#0088FF] dark:text-[#0A84FF]',
      activeGlow: 'shadow-[0_0_12px_rgba(0,136,255,0.18)]',
      status: null,
    },
    {
      key: 'pending',
      label: 'Chờ xác nhận',
      value: s.pending || 0,
      icon: <SFClockFill size={18} className="text-amber-500" />,
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      activeBorderColor: 'border-amber-500 dark:border-amber-400',
      activeTextColor: 'text-amber-700 dark:text-amber-400',
      activeGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.18)]',
      status: 'pending',
    },
    {
      key: 'shipping',
      label: 'Đang giao hàng',
      value: s.shipping || 0,
      icon: <SFTray2Fill size={18} className="text-indigo-500" />,
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      activeBorderColor: 'border-indigo-500 dark:border-indigo-400',
      activeTextColor: 'text-indigo-700 dark:text-indigo-400',
      activeGlow: 'shadow-[0_0_12px_rgba(99,102,241,0.18)]',
      status: 'shipping',
    },
    {
      key: 'overdue',
      label: 'Quá hạn giao',
      value: totalOverdue,
      icon: <SFExclamationmarkTriangleFill size={18} className="text-rose-500" />,
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      activeBorderColor: 'border-rose-500 dark:border-rose-400',
      activeTextColor: 'text-rose-600 dark:text-rose-400',
      activeGlow: 'shadow-[0_0_12px_rgba(244,63,94,0.18)]',
      status: 'overdue',
      pulse: totalOverdue > 0,
    },
    {
      key: 'received',
      label: 'Đã nhận đủ',
      value: s.received || 0,
      icon: <SFCheckmarkCircleFill size={18} className="text-emerald-500" />,
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      activeBorderColor: 'border-emerald-500 dark:border-emerald-400',
      activeTextColor: 'text-emerald-700 dark:text-emerald-400',
      activeGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.18)]',
      status: 'received',
    },
    {
      key: 'upcoming_7_days',
      label: 'Hạn 7 ngày tới',
      value: s.upcoming_7_days || 0,
      icon: <SFCalendar size={18} className="text-purple-500" />,
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      activeBorderColor: 'border-purple-500 dark:border-purple-400',
      activeTextColor: 'text-purple-700 dark:text-purple-400',
      activeGlow: 'shadow-[0_0_12px_rgba(168,85,247,0.18)]',
      status: 'upcoming_7_days',
    },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
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
              activeBorderColor={card.activeBorderColor}
              activeTextColor={card.activeTextColor}
              activeGlow={card.activeGlow}
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
