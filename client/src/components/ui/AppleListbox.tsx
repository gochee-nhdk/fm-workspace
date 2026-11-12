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
  /** @deprecated Header in popover removed per macOS HIG */
  headerTitle?: string;
  /** @deprecated Header in popover removed per macOS HIG */
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
  headerTitle: _headerTitle,
  headerCountLabel: _headerCountLabel,
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
  const { shouldRender, isExiting } = useAnimatedPresence(isOpen, 180);

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
        'rounded-2xl bg-white/92 dark:bg-[#1c1c24]/92 backdrop-blur-3xl border border-black/10 dark:border-white/15 p-1.5 shadow-[0_24px_60px_-10px_rgba(0,0,0,0.28),0_6px_20px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[0_28px_70px_-10px_rgba(0,0,0,0.7),0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.14)] select-none text-left',
        isExiting
          ? coords?.placement === 'top'
            ? 'apple-picker-close-up pointer-events-none'
            : 'apple-picker-close pointer-events-none'
          : coords?.placement === 'top'
          ? 'apple-picker-open-up pointer-events-auto'
          : 'apple-picker-open pointer-events-auto'
      )}
    >
      {/* Scrollable Items List */}
      <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5 pr-0.5 scrollbar-thin">
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
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] active:scale-[0.98] transition-all duration-150 ease-spring cursor-pointer text-left',
                isSelected
                  ? 'bg-[#0088FF]/12 dark:bg-[#0091FF]/20 text-[#0088FF] dark:text-[#0091FF] font-semibold'
                  : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] font-normal'
              )}
            >
              <span className="flex items-center gap-2.5 truncate">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    isSelected
                      ? 'bg-[#0088FF] dark:bg-[#0091FF]'
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
                      ? 'bg-[#0088FF]/20 text-[#0088FF] dark:text-[#0091FF] font-bold'
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
              'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] active:scale-[0.98] transition-all duration-150 ease-spring cursor-pointer text-left',
              isCustomSelected
                ? 'bg-[#0088FF]/12 dark:bg-[#0091FF]/20 text-[#0088FF] dark:text-[#0091FF] font-semibold'
                : 'text-[#0088FF] dark:text-[#0091FF] hover:bg-[#0088FF]/10 font-medium'
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
        <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight mb-1.5">
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
          'w-full flex items-center justify-between text-sm font-medium active:scale-95 transition-all duration-200 ease-spring text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088FF]/50 dark:focus-visible:ring-[#0091FF]/60 focus-visible:shadow-[0_0_12px_rgba(0,136,255,0.3)]',
          compact ? 'px-3 py-1.5 rounded-xl text-[12.5px]' : 'px-3.5 py-2.5 rounded-xl',
          disabled
            ? 'opacity-40 cursor-not-allowed bg-[#f5f5f7] dark:bg-white/5 border-black/10 dark:border-white/10 text-[#86868b]'
            : 'cursor-pointer border bg-white/85 dark:bg-[#1c1c22]/85 backdrop-blur-xl text-[#1d1d1f] dark:text-white shadow-2xs',
          !disabled && isOpen
            ? 'border-[#0088FF] dark:border-[#0091FF] ring-2 ring-[#0088FF]/30 dark:ring-[#0091FF]/30 shadow-[0_0_14px_rgba(0,136,255,0.25)]'
            : !disabled && 'border-black/10 dark:border-white/12 hover:border-black/20 dark:hover:border-white/25',
          error ? 'border-[#FF383C] dark:border-[#FF4245] focus-visible:ring-[#FF383C]/30 focus-visible:shadow-[0_0_12px_rgba(255,56,60,0.25)]' : '',
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
              'transition-transform duration-260 ease-spring',
              isOpen && 'rotate-180 text-[#0088FF] dark:text-[#0091FF]'
            )}
          />
        </div>
      </button>

      {/* Popover rendering (Portaled or inline) */}
      {usePortal && typeof document !== 'undefined'
        ? createPortal(popoverContent, document.body)
        : popoverContent}

      {error && (
        <p className="text-[11px] text-[#FF383C] dark:text-[#FF4245] font-medium mt-1">
          {error}
        </p>
      )}
    </div>
  );
};
