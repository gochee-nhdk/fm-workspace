import React from 'react';
import { POStatus } from '@/types/po-tracker';
import {
  SFClockFill,
  SFCheckmarkCircleFill,
  SFShippingboxFill,
  SFExclamationmarkTriangleFill,
  SFXmark,
  SFTray2Fill
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';

interface POStatusPillProps {
  status: POStatus;
  expectedDate?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export const PO_STATUS_CONFIG_MAP: Record<POStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: 'Chờ xác nhận',
    color: 'text-amber-800 dark:text-amber-300 font-medium',
    bg: 'bg-amber-500/10 dark:bg-amber-400/15',
    border: 'border-amber-500/25 dark:border-amber-400/30',
    icon: <SFClockFill size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />,
  },
  confirmed: {
    label: 'Đã xác nhận',
    color: 'text-sky-800 dark:text-sky-300 font-medium',
    bg: 'bg-sky-500/10 dark:bg-sky-400/15',
    border: 'border-sky-500/25 dark:border-sky-400/30',
    icon: <SFCheckmarkCircleFill size={11} className="text-sky-600 dark:text-sky-400 shrink-0" />,
  },
  shipping: {
    label: 'Đang giao hàng',
    color: 'text-blue-800 dark:text-blue-300 font-medium',
    bg: 'bg-blue-500/10 dark:bg-blue-400/15',
    border: 'border-blue-500/25 dark:border-blue-400/30',
    icon: <SFShippingboxFill size={11} className="text-blue-600 dark:text-blue-400 shrink-0" />,
  },
  partial_received: {
    label: 'Nhận một phần',
    color: 'text-purple-800 dark:text-purple-300 font-medium',
    bg: 'bg-purple-500/10 dark:bg-purple-400/15',
    border: 'border-purple-500/25 dark:border-purple-400/30',
    icon: <SFTray2Fill size={11} className="text-purple-600 dark:text-purple-400 shrink-0" />,
  },
  received: {
    label: 'Đã nhận đủ',
    color: 'text-emerald-800 dark:text-emerald-300 font-medium',
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    border: 'border-emerald-500/25 dark:border-emerald-400/30',
    icon: <SFCheckmarkCircleFill size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'text-zinc-600 dark:text-zinc-400 font-medium',
    bg: 'bg-zinc-500/10 dark:bg-zinc-400/15',
    border: 'border-zinc-400/25 dark:border-zinc-500/30',
    icon: <SFXmark size={11} className="text-zinc-500 dark:text-zinc-400 shrink-0" />,
  },
  overdue: {
    label: 'Quá hạn',
    color: 'text-rose-800 dark:text-rose-300 font-medium',
    bg: 'bg-rose-500/10 dark:bg-rose-400/15',
    border: 'border-rose-500/25 dark:border-rose-400/30',
    icon: <SFExclamationmarkTriangleFill size={11} className="text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />,
  },
};

export const POStatusPill: React.FC<POStatusPillProps> = ({
  status,
  expectedDate,
  size = 'md',
  className,
  showIcon = true,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue =
    status === 'overdue' ||
    (status !== 'received' && status !== 'cancelled' && Boolean(expectedDate && expectedDate < today));

  let overdueDays = 0;
  if (isOverdue && expectedDate) {
    const exp = new Date(expectedDate + 'T00:00:00').getTime();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - exp) / (1000 * 60 * 60 * 24));
    overdueDays = Math.max(1, diff);
  }

  const effectiveStatus: POStatus = isOverdue ? 'overdue' : status;
  const cfg = PO_STATUS_CONFIG_MAP[effectiveStatus] || PO_STATUS_CONFIG_MAP.pending;
  const displayLabel = isOverdue
    ? (overdueDays > 0 ? `Quá hạn (Trễ ${overdueDays} ngày)` : 'Quá hạn')
    : cfg.label;

  const sizeClasses = {
    sm: 'text-[11.5px] px-2.5 py-0.5 gap-1.5',
    md: 'text-[12px] px-3 py-1 gap-1.5',
    lg: 'text-[13px] px-3.5 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border backdrop-blur-md shadow-xs select-none whitespace-nowrap transition-all duration-200 font-medium',
        'po-status-enter',
        cfg.color,
        cfg.bg,
        cfg.border,
        sizeClasses[size],
        isOverdue && 'ring-2 ring-rose-500/20 dark:ring-rose-400/25',
        className
      )}
    >
      {showIcon && cfg.icon}
      <span>{displayLabel}</span>
    </span>
  );
};
