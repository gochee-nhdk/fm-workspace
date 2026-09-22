import React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  children
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-[18px] border border-dashed border-[#e0e0e0] dark:border-white/12 bg-[#fafafc]/50 dark:bg-white/5',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] flex items-center justify-center mb-3.5 shadow-2xs">
        {icon || <Inbox className="w-5 h-5" />}
      </div>
      <h4 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight mb-1">
        {title}
      </h4>
      <p className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] max-w-sm mb-5 leading-normal">
        {description}
      </p>

      {children}

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2.5">
          {actionLabel && (
            <Button variant="glassProminent" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && (
            <Button variant="glass" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
