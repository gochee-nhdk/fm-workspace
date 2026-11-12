import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SFMagnifyingglass } from 'sf-symbols-lib';
import { CloseButton } from '@/components/ui/close-button';

export interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value: initialValue = '',
  onChange,
  placeholder = 'Tìm kiếm...',
  className,
  debounceMs = 300
}) => {
  const [innerValue, setInnerValue] = useState(initialValue);

  useEffect(() => {
    setInnerValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(innerValue);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [innerValue, onChange, debounceMs]);

  const hasContent = Boolean(innerValue);

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-full w-full max-w-xs transition-all duration-200 ease-spring',
        'bg-white/80 dark:bg-white/[0.08] backdrop-blur-xl',
        'border border-black/10 dark:border-white/12 hover:border-black/20 dark:hover:border-white/20 shadow-2xs',
        'focus-within:border-[#0088FF] dark:focus-within:border-[#0091FF] focus-within:ring-2 focus-within:ring-[#0088FF]/30 dark:focus-within:ring-[#0091FF]/35 focus-within:shadow-[0_0_12px_rgba(0,136,255,0.25)] focus-within:bg-white dark:focus-within:bg-[#1c1c22]',
        className
      )}
    >
      <div className="pl-3.5 pr-1 flex items-center pointer-events-none transition-colors duration-200">
        <SFMagnifyingglass
          size={14}
          className={cn(
            'transition-colors duration-200',
            hasContent ? 'text-[#0088FF] dark:text-[#0091FF]' : 'text-[#86868b] dark:text-[#a1a1a6] group-focus-within:text-[#0088FF] dark:group-focus-within:text-[#0091FF]'
          )}
        />
      </div>
      <input
        type="text"
        value={innerValue}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full text-[13px] bg-transparent text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6] focus:outline-none border-none py-2 pr-8 pl-1 shadow-none ring-0"
        style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
      />
      {hasContent && (
        <CloseButton
          onClick={() => {
            setInnerValue('');
            onChange('');
          }}
          size="xs"
          className="absolute right-2.5"
          label="Xóa"
          title="Xóa"
        />
      )}
    </div>
  );
};
