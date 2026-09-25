import React from 'react';
import { cn } from '@/lib/utils';
import {
  SFExclamationmarkCircle,
  SFCheckmarkCircleFill,
  SFExclamationmarkTriangleFill,
  SFInfoCircle,
  SFXmark,
} from 'sf-symbols-lib';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  children,
  action,
  onDismiss,
  className
}) => {
  const styles = {
    info: 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800/80',
    success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/80',
    warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/80',
    error: 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/80'
  };

  const icons = {
    info: <SFInfoCircle size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />,
    success: <SFCheckmarkCircleFill size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    warning: <SFExclamationmarkTriangleFill size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    error: <SFExclamationmarkCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
  };

  return (
    <div
      className={cn(
        'p-3.5 rounded-xl border flex items-start gap-3 text-xs transition-all duration-150',
        styles[type],
        className
      )}
    >
      {icons[type]}
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold">{title}</h5>}
        {message && <p className="opacity-90 leading-relaxed">{message}</p>}
        {children}
        {action && <div className="pt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
        >
          <SFXmark size={14} />
        </button>
      )}
    </div>
  );
};
