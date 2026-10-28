import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAppleTabSpring } from '@/lib/motion';

export interface SegmentedNavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SegmentedNavigationProps {
  items: readonly SegmentedNavigationItem[];
  activeId: string;
  label: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Shared segmented navigation used by workspace sheets and settings sections. */
export const SegmentedNavigation: React.FC<SegmentedNavigationProps> = ({
  items,
  activeId,
  label,
  onChange,
  className,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useAppleTabSpring(trackRef, indicatorRef, activeId, {
    stiffness: 400,
    damping: 25,
    mass: 0.72,
    allowDeformation: true,
    orientation: 'horizontal',
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = items.findIndex((item) => item.id === activeId);
    if (currentIndex < 0 || items.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextItem = items[nextIndex];
    trackRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${nextItem.id}"]`)
      ?.focus();
    onChange(nextItem.id);
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        'liquid-glass-segmented-track p-1 inline-flex items-center self-start shrink-0 relative select-none',
        className
      )}
    >
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className="absolute inset-y-1 left-0 rounded-full pointer-events-none z-0 liquid-lens-pill-active will-change-[transform,width] origin-center opacity-0 transition-opacity duration-100"
      />
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            data-tab-id={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              'group relative z-10 inline-flex h-[32px] min-w-0 sm:min-w-[100px] items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full px-2.5 sm:px-3.5 text-[12px] sm:text-[13px] leading-none select-none cursor-pointer active:scale-[0.975] transition-[color,transform] duration-[var(--motion-duration-tab)] ease-[var(--motion-ease-spring)]',
              isActive
                ? 'font-semibold text-[#0071e3] dark:text-[#3898ff]'
                : 'font-medium text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-white'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'shrink-0 transition-colors duration-[var(--motion-duration-tab)]',
                isActive
                  ? 'text-[#0071e3] dark:text-[#3898ff]'
                  : 'text-[#8e8e93] group-hover:text-[#555558] dark:group-hover:text-[#d1d1d6]'
              )}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
