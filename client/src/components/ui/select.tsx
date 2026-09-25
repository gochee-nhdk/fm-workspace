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
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-2xs">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'block w-full text-[14px] rounded-xl border border-[#e0e0e0] dark:border-white/12 bg-white dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] transition-all duration-180 py-2.5 pl-3.5 pr-9 appearance-none disabled:opacity-40 disabled:bg-[#f5f5f7] dark:disabled:bg-white/5 cursor-pointer',
              error ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' : '',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#76767b]">
            <SFChevronDown size={14} />
          </div>
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
Select.displayName = 'Select';
