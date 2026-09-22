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
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-2xs">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#76767b]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'block w-full text-[14px] rounded-xl border border-[#e0e0e0] dark:border-white/12 bg-white dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] transition-all duration-180 py-2.5 px-3.5 disabled:opacity-40 disabled:bg-[#f5f5f7] dark:disabled:bg-white/5',
              leftIcon ? 'pl-10' : '',
              rightIcon ? 'pr-10' : '',
              error ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' : '',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#76767b]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[12px] text-[#76767b] dark:text-[#a1a1a6]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
