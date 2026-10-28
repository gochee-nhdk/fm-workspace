import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { SFChevronDown, SFPlus } from 'sf-symbols-lib';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

export interface AppleListboxOption {
  value: string;
  label: string;
  count?: number;
}

export interface AppleListboxProps {
  label?: string;
  headerTitle?: string;
  headerCountLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: (AppleListboxOption | string)[];
  customOptionLabel?: string;
  isCustomSelected?: boolean;
  onSelectCustom?: () => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  compact?: boolean;
  disabled?: boolean;
  error?: string;
  usePortal?: boolean;
}

export const AppleListbox: React.FC<AppleListboxProps> = ({
  label,
  headerTitle = 'Phân loại danh mục',
  headerCountLabel = 'NHÓM',
  value,
  onChange,
  options,
  customOptionLabel,
  isCustomSelected = false,
  onSelectCustom,
  placeholder = 'Chọn phân nhóm...',
  className,
  triggerClassName,
  compact = false,
  disabled = false,
  error,
  usePortal = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { shouldRender, isExiting } = useAnimatedPresence(isOpen, 140);

  // Floating coordinates for portaled popover
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  // Normalize options into AppleListboxOption[]
  const normalizedOptions: AppleListboxOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const estimatedH = 240;

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;

    let placement: 'bottom' | 'top' = 'bottom';

    // If space below is not enough for the listbox and space above is larger, place on top
    if (spaceBelow < estimatedH && spaceAbove > spaceBelow) {
      placement = 'top';
    }

    setCoords({
      top: placement === 'bottom' ? rect.bottom + 6 : undefined,
      bottom: placement === 'top' ? viewportH - rect.top + 6 : undefined,
      left: Math.max(8, Math.min(viewportW - rect.width - 8, rect.left)),
      width: Math.max(compact ? 180 : 0, rect.width),
      placement,
    });
  }, [compact]);

  useLayoutEffect(() => {
    if (isOpen) {
      updateCoords();
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      updateCoords();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateCoords]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = isCustomSelected
    ? (customOptionLabel || '+ Nhập nhóm mới...')
    : (selectedOption ? selectedOption.label : value || placeholder);

  const handleSelectOption = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  const handleSelectCustom = () => {
    if (onSelectCustom) {
      onSelectCustom();
    }
    setIsOpen(false);
  };

  const popoverContent = shouldRender ? (
    <div
      ref={popoverRef}
      role="listbox"
      style={
        usePortal && coords
          ? {
              position: 'fixed',
              top: coords.placement === 'bottom' ? `${coords.top}px` : 'auto',
              bottom: coords.placement === 'top' ? `${coords.bottom}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 10050,
              transformOrigin: coords.placement === 'top' ? 'bottom center' : 'top center',
            }
          : undefined
      }
      className={cn(
        !usePortal && 'absolute left-0 right-0 top-full mt-1.5 z-50',
        'rounded-2xl bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-3xl border border-black/10 dark:border-white/15 p-1.5 shadow-[0_20px_48px_-6px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.08)] select-none text-left',
        isExiting
          ? coords?.placement === 'top'
            ? 'apple-picker-close-up pointer-events-none'
            : 'apple-picker-close pointer-events-none'
          : coords?.placement === 'top'
          ? 'apple-picker-open-up pointer-events-auto'
          : 'apple-picker-open pointer-events-auto'
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
        <span>{headerTitle}</span>
        <span className="font-mono text-[10px] font-normal text-[#86868b] dark:text-[#a1a1a6]">
          {normalizedOptions.length} {headerCountLabel}
        </span>
      </div>

      {/* Scrollable Items List */}
      <div className="max-h-56 overflow-y-auto space-y-0.5 py-1 pr-0.5 scrollbar-thin">
        {normalizedOptions.map((opt) => {
          const isSelected = !isCustomSelected && opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelectOption(opt.value)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer text-left',
                isSelected
                  ? 'bg-[#0071e3]/10 dark:bg-[#2997ff]/20 text-[#0071e3] dark:text-[#2997ff] font-semibold'
                  : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-normal'
              )}
            >
              <span className="flex items-center gap-2.5 truncate">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    isSelected
                      ? 'bg-[#0071e3] dark:bg-[#2997ff]'
                      : 'bg-[#8e8e93]/50 dark:bg-[#8e8e93]/40'
                  )}
                />
                <span className="truncate">{opt.label}</span>
              </span>

              {typeof opt.count === 'number' && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ml-2 shrink-0',
                    isSelected
                      ? 'bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] font-bold'
                      : 'bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]'
                  )}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Option: "+ Nhập nhóm mới..." */}
      {customOptionLabel && (
        <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-1 mt-0.5">
          <button
            type="button"
            onClick={handleSelectCustom}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer text-left',
              isCustomSelected
                ? 'bg-[#0071e3]/10 dark:bg-[#2997ff]/20 text-[#0071e3] dark:text-[#2997ff] font-semibold'
                : 'text-[#0071e3] dark:text-[#2997ff] hover:bg-[#0071e3]/8 font-medium'
            )}
          >
            <SFPlus size={13} className="shrink-0" />
            <span>{customOptionLabel}</span>
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={cn('relative w-full select-none font-sans', compact && 'w-auto inline-block', className)}>
      {label && (
        <label className="block text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Capsule Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between text-sm font-medium transition-all duration-150 text-left',
          compact ? 'px-3 py-1.5 rounded-xl text-[12.5px]' : 'px-3.5 py-2.5 rounded-xl',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-black/[0.02] dark:bg-white/[0.03] border-black/10 dark:border-white/10 text-[#86868b]'
            : 'cursor-pointer border bg-white dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white shadow-2xs',
          !disabled && isOpen
            ? 'border-[#0071e3] ring-2 ring-[#0071e3]/20 dark:border-[#2997ff]'
            : !disabled && 'border-[#e0e0e0] dark:border-white/15 hover:border-black/25 dark:hover:border-white/30',
          error ? 'border-rose-500 focus:ring-rose-500/20' : '',
          triggerClassName
        )}
      >
        <span className={cn('truncate', !value && !isCustomSelected && 'text-[#86868b] dark:text-[#a1a1a6]')}>
          {displayLabel}
        </span>

        <div className="flex items-center gap-1.5 ml-2 text-[#86868b] dark:text-[#a1a1a6] shrink-0">
          <SFChevronDown
            size={compact ? 12 : 14}
            className={cn(
              'transition-transform duration-200',
              isOpen && 'rotate-180 text-[#0071e3] dark:text-[#2997ff]'
            )}
          />
        </div>
      </button>

      {/* Popover rendering (Portaled or inline) */}
      {usePortal && typeof document !== 'undefined'
        ? createPortal(popoverContent, document.body)
        : popoverContent}

      {error && (
        <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium mt-1">
          {error}
        </p>
      )}
    </div>
  );
};
