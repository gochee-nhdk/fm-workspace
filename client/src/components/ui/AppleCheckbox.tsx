import React from 'react';
import { cn } from '@/lib/utils';
import { SFCheckmark } from 'sf-symbols-lib';

export interface AppleCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
  name?: string;
  title?: string;
  className?: string;
  boxClassName?: string;
}

export const AppleCheckbox: React.FC<AppleCheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  id,
  name,
  title,
  className,
  boxClassName,
}) => {
  const isSm = size === 'sm';

  return (
    <label
      title={title}
      className={cn(
        'group inline-flex items-center gap-2.5 select-none transition-opacity duration-150',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        description && 'items-start',
        className
      )}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />

      {/* Apple Tactile Checkbox Box */}
      <div
        className={cn(
          'relative flex items-center justify-center shrink-0 transition-all duration-150 ease-spring',
          isSm ? 'w-4 h-4 rounded-[4.5px]' : 'w-[18px] h-[18px] rounded-[5.5px]',
          !disabled && 'active:scale-90 group-active:scale-90',
          checked
            ? 'bg-[#0071e3] dark:bg-[#2997ff] border-[#0071e3] dark:border-[#2997ff] text-white shadow-[0_1px_4px_rgba(0,113,227,0.35)]'
            : 'border-[1.5px] border-black/25 dark:border-white/30 bg-white/70 dark:bg-black/30 group-hover:border-[#0071e3] dark:group-hover:border-[#2997ff] group-hover:bg-white/90 dark:group-hover:bg-black/50',
          boxClassName
        )}
      >
        <SFCheckmark
          size={isSm ? 10 : 12}
          className={cn(
            'stroke-[3] text-white transition-all duration-150 ease-spring drop-shadow-xs',
            checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
        />
      </div>

      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight leading-snug group-hover:text-black dark:group-hover:text-white transition-colors">
              {label}
            </div>
          )}
          {description && (
            <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] leading-tight mt-0.5">
              {description}
            </div>
          )}
        </div>
      )}
    </label>
  );
};

export interface AppleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  activeColor?: 'green' | 'blue';
  id?: string;
  name?: string;
  title?: string;
  className?: string;
}

export const AppleSwitch: React.FC<AppleSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  activeColor = 'green',
  id,
  name,
  title,
  className,
}) => {
  const isSm = size === 'sm';
  const greenClass = 'bg-[#34c759] dark:bg-[#30d158]';
  const blueClass = 'bg-[#0071e3] dark:bg-[#2997ff]';
  const activeBg = activeColor === 'green' ? greenClass : blueClass;

  return (
    <label
      title={title}
      className={cn(
        'group inline-flex items-center justify-between gap-3 select-none transition-opacity duration-150',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />

      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight leading-snug">
              {label}
            </div>
          )}
          {description && (
            <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] leading-tight mt-0.5">
              {description}
            </div>
          )}
        </div>
      )}

      {/* macOS Toggle Switch Track */}
      <div
        className={cn(
          'relative p-0.5 rounded-full transition-colors duration-200 ease-spring shrink-0 shadow-inner',
          isSm ? 'w-9 h-5' : 'w-10 h-6',
          !disabled && 'active:scale-95 group-active:scale-95',
          checked ? activeBg : 'bg-black/20 dark:bg-white/20'
        )}
      >
        {/* Toggle Knob */}
        <div
          className={cn(
            'rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-spring',
            isSm
              ? checked
                ? 'w-4 h-4 translate-x-4'
                : 'w-4 h-4 translate-x-0'
              : checked
              ? 'w-5 h-5 translate-x-4'
              : 'w-5 h-5 translate-x-0'
          )}
        />
      </div>
    </label>
  );
};
