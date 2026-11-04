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
    color: 'text-amber-800 dark:text-amber-300 font-semibold',
    bg: 'bg-amber-100/80 dark:bg-amber-500/15',
    border: 'border-amber-300/80 dark:border-amber-500/30',
    icon: <SFClockFill size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />,
  },
  confirmed: {
    label: 'Đã xác nhận',
    color: 'text-blue-800 dark:text-blue-300 font-semibold',
    bg: 'bg-blue-100/80 dark:bg-blue-500/15',
    border: 'border-blue-300/80 dark:border-blue-500/30',
    icon: <SFCheckmarkCircleFill size={11} className="text-blue-600 dark:text-blue-400 shrink-0" />,
  },
  shipping: {
    label: 'Đang giao hàng',
    color: 'text-indigo-800 dark:text-indigo-300 font-semibold',
    bg: 'bg-indigo-100/80 dark:bg-indigo-500/15',
    border: 'border-indigo-300/80 dark:border-indigo-500/30',
    icon: <SFShippingboxFill size={11} className="text-indigo-600 dark:text-indigo-400 shrink-0" />,
  },
  partial_received: {
    label: 'Nhận một phần',
    color: 'text-purple-800 dark:text-purple-300 font-semibold',
    bg: 'bg-purple-100/80 dark:bg-purple-500/15',
    border: 'border-purple-300/80 dark:border-purple-500/30',
    icon: <SFTray2Fill size={11} className="text-purple-600 dark:text-purple-400 shrink-0" />,
  },
  received: {
    label: 'Đã nhận đủ',
    color: 'text-emerald-800 dark:text-emerald-300 font-semibold',
    bg: 'bg-emerald-100/80 dark:bg-emerald-500/15',
    border: 'border-emerald-300/80 dark:border-emerald-500/30',
    icon: <SFCheckmarkCircleFill size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'text-zinc-700 dark:text-zinc-300 font-medium',
    bg: 'bg-zinc-100 dark:bg-zinc-800/60',
    border: 'border-zinc-300 dark:border-zinc-700',
    icon: <SFXmark size={11} className="text-zinc-500 shrink-0" />,
  },
  overdue: {
    label: 'Quá hạn',
    color: 'text-red-800 dark:text-red-300 font-bold',
    bg: 'bg-red-100/90 dark:bg-red-500/20',
    border: 'border-red-400/80 dark:border-red-500/40',
    icon: <SFExclamationmarkTriangleFill size={11} className="text-red-600 dark:text-red-400 shrink-0 animate-pulse" />,
  },
};

export const POStatusPill: React.FC<POStatusPillProps> = ({
  status,
  size = 'md',
  className,
  showIcon = true,
}) => {
  const cfg = PO_STATUS_CONFIG_MAP[status] || PO_STATUS_CONFIG_MAP.pending;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-[12px] px-2.5 py-1 gap-1.5',
    lg: 'text-[13px] px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border shadow-2xs select-none whitespace-nowrap transition-all duration-150',
        'po-status-enter',
        cfg.color,
        cfg.bg,
        cfg.border,
        sizeClasses[size],
        status === 'overdue' && 'po-overdue-ring',
        className
      )}
    >
      {showIcon && cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
};
