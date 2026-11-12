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
        <div className="group relative rounded-xl shadow-2xs">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868b] dark:text-[#a1a1a6] group-focus-within:text-[#0088FF] dark:group-focus-within:text-[#0091FF] transition-colors duration-200 z-10">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'block w-full text-[13px] rounded-xl border border-black/10 dark:border-white/12 bg-white/85 dark:bg-[#1c1c22]/85 backdrop-blur-xl text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6] hover:border-black/20 dark:hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-[#0088FF]/35 dark:focus:ring-[#0091FF]/45 focus:border-[#0088FF] dark:focus:border-[#0091FF] focus:shadow-[0_0_14px_rgba(0,136,255,0.25)] dark:focus:shadow-[0_0_18px_rgba(0,145,255,0.32)] transition-all duration-200 ease-spring py-2.5 px-3.5 disabled:opacity-40 disabled:bg-[#f5f5f7] dark:disabled:bg-white/5',
              leftIcon ? 'pl-10' : '',
              rightIcon ? 'pr-10' : '',
              error ? 'border-[#FF383C] dark:border-[#FF4245] focus:ring-[#FF383C]/35 focus:border-[#FF383C] focus:shadow-[0_0_14px_rgba(255,56,60,0.25)]' : '',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#86868b] dark:text-[#a1a1a6] group-focus-within:text-[#0088FF] dark:group-focus-within:text-[#0091FF] transition-colors duration-200 z-10">
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
