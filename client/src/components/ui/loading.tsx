import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-[#0066cc] dark:text-[#2997ff]', sizes[size])} />
      {label && (
        <span className="text-[12px] text-[#76767b] dark:text-[#a1a1a6] font-medium">
          {label}
        </span>
      )}
    </div>
  );
};

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-[#e0e0e0]/70 dark:bg-white/10', className)}
      {...props}
    />
  );
};

export interface ContextualLoadingProps {
  step: string;
  detail?: string;
  progress?: number;
  className?: string;
}

export const ContextualLoading: React.FC<ContextualLoadingProps> = ({
  step,
  detail,
  progress,
  className
}) => {
  return (
    <div className={cn('p-6 rounded-[18px] border border-[#0066cc]/20 dark:border-[#2997ff]/20 bg-[#0066cc]/5 dark:bg-[#2997ff]/10 text-center space-y-3', className)}>
      <div className="flex justify-center">
        <Loader2 className="w-6 h-6 text-[#0066cc] dark:text-[#2997ff] animate-spin" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">{step}</p>
        {detail && <p className="text-[12px] text-[#76767b] dark:text-[#a1a1a6] mt-1">{detail}</p>}
      </div>
      {progress !== undefined && (
        <div className="w-full max-w-xs mx-auto bg-[#e0e0e0] dark:bg-white/15 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#0066cc] dark:bg-[#2997ff] h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
};
