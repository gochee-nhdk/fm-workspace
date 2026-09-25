import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SFMagnifyingglass, SFXmark } from 'sf-symbols-lib';

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
        'group relative flex items-center rounded-full w-full max-w-xs transition-all duration-180',
        'bg-white/75 dark:bg-white/[0.07] backdrop-blur-xl',
        'border border-black/[0.08] dark:border-white/12 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.02)]',
        'focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/20 focus-within:bg-white dark:focus-within:bg-[#1d1d1f]',
        className
      )}
    >
      <div className="pl-3.5 pr-1 flex items-center pointer-events-none transition-colors">
        <SFMagnifyingglass
          size={14}
          className={cn(
            'transition-colors',
            hasContent ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-[#76767b] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff]'
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
        <button
          type="button"
          onClick={() => {
            setInnerValue('');
            onChange('');
          }}
          className="absolute right-2.5 p-1 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90"
          title="Xoá"
        >
          <SFXmark size={12} />
        </button>
      )}
    </div>
  );
};
