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
    info: 'bg-[#0088FF]/[0.08] dark:bg-[#0091FF]/[0.14] text-[#005bb5] dark:text-[#7ac4ff] border-[#0088FF]/20 dark:border-[#0091FF]/28',
    success: 'bg-[#34C759]/[0.08] dark:bg-[#30D158]/[0.14] text-[#1a8238] dark:text-[#6ee78f] border-[#34C759]/22 dark:border-[#30D158]/28',
    warning: 'bg-[#FF8D28]/[0.09] dark:bg-[#FF9230]/[0.14] text-[#9a4b00] dark:text-[#ffc27a] border-[#FF8D28]/24 dark:border-[#FF9230]/28',
    error: 'bg-[#FF383C]/[0.08] dark:bg-[#FF4245]/[0.14] text-[#b31b20] dark:text-[#ff8a8d] border-[#FF383C]/22 dark:border-[#FF4245]/28'
  };

  const icons = {
    info: <SFInfoCircle size={16} className="text-[#0088FF] dark:text-[#0091FF] shrink-0 mt-0.5" />,
    success: <SFCheckmarkCircleFill size={16} className="text-[#34C759] dark:text-[#30D158] shrink-0 mt-0.5" />,
    warning: <SFExclamationmarkTriangleFill size={16} className="text-[#FF8D28] dark:text-[#FF9230] shrink-0 mt-0.5" />,
    error: <SFExclamationmarkCircle size={16} className="text-[#FF383C] dark:text-[#FF4245] shrink-0 mt-0.5" />
  };

  return (
    <div
      className={cn(
        'p-3.5 rounded-2xl border backdrop-blur-xl flex items-start gap-3 text-xs transition-colors duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
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
