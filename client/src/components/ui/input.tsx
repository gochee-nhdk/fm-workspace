import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-2xs">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868b]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'block w-full text-[13px] rounded-xl border border-black/10 dark:border-white/12 bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-md text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/25 dark:focus:ring-[#0091FF]/30 focus:border-[#0088FF] dark:focus:border-[#0091FF] transition-all duration-180 py-2.5 px-3.5 disabled:opacity-40 disabled:bg-[#f5f5f7] dark:disabled:bg-white/5',
              leftIcon ? 'pl-10' : '',
              rightIcon ? 'pr-10' : '',
              error ? 'border-[#FF383C] dark:border-[#FF4245] focus:ring-[#FF383C]/20 focus:border-[#FF383C]' : '',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#86868b]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-[#FF383C] dark:text-[#FF4245] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
