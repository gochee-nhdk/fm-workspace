import React from 'react';
import { POStatus, PO_STATUS_CONFIG } from '@/types/po-tracker';
import { cn } from '@/lib/utils';

interface POStatusPillProps {
  status: POStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export const POStatusPill: React.FC<POStatusPillProps> = ({
  status,
  size = 'md',
  className,
  showIcon = true,
}) => {
  const cfg = PO_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-[11px] px-2.5 py-1 gap-1.5',
    lg: 'text-[12px] px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border select-none whitespace-nowrap',
        'po-status-enter',
        cfg.color,
        cfg.bg,
        cfg.border,
        sizeClasses[size],
        status === 'overdue' && 'po-overdue-ring',
        className
      )}
    >
      {showIcon && (
        <span className="text-[9px] leading-none" aria-hidden>
          {cfg.icon}
        </span>
      )}
      {cfg.label}
    </span>
  );
};
