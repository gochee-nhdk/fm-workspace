import React from 'react';
import { cn } from '@/lib/utils';
import { SFChevronDown } from 'sf-symbols-lib';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, placeholder, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label htmlFor={selectId} className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            {label}
          </label>
        )}
        <div className="group relative rounded-xl shadow-2xs">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'block w-full text-[13px] rounded-xl border border-black/10 dark:border-white/12 bg-white/85 dark:bg-[#1c1c22]/85 backdrop-blur-xl text-[#1d1d1f] dark:text-white hover:border-black/20 dark:hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-[#0088FF]/35 dark:focus:ring-[#0091FF]/45 focus:border-[#0088FF] dark:focus:border-[#0091FF] focus:shadow-[0_0_14px_rgba(0,136,255,0.25)] dark:focus:shadow-[0_0_18px_rgba(0,145,255,0.32)] active:scale-[0.99] transition-all duration-200 ease-spring py-2.5 pl-3.5 pr-9 appearance-none disabled:opacity-40 disabled:bg-[#f5f5f7] dark:disabled:bg-white/5 cursor-pointer',
              error ? 'border-[#FF383C] dark:border-[#FF4245] focus:ring-[#FF383C]/35 focus:border-[#FF383C] focus:shadow-[0_0_14px_rgba(255,56,60,0.25)]' : '',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-white dark:bg-[#1c1c22] text-[#86868b] dark:text-[#a1a1a6]">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-white dark:bg-[#1c1c22] text-[#1d1d1f] dark:text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#86868b] dark:text-[#a1a1a6] group-focus-within:text-[#0088FF] dark:group-focus-within:text-[#0091FF] transition-colors duration-200">
            <SFChevronDown size={14} />
          </div>
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
Select.displayName = 'Select';
