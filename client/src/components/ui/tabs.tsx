import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        ready: true,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative select-none',
        variant === 'underline'
          ? 'border-b border-black/[0.08] dark:border-white/[0.12]'
          : 'liquid-glass-segmented-track p-1 inline-flex items-center',
        className
      )}
    >
      {/* Liquid Droplet Sliding Indicator Pill */}
      {indicatorStyle.ready && indicatorStyle.width > 0 && (
        <div
          className={cn(
            'absolute transition-[transform,width] duration-sidebar ease-motion-spring pointer-events-none will-change-[transform,width]',
            variant === 'underline'
              ? 'bottom-0 h-0.5 bg-[#0088FF] dark:bg-[#0091FF] rounded-full'
              : 'top-1 bottom-1 rounded-full liquid-lens-pill-active'
          )}
          style={{
            transform: `translate3d(${indicatorStyle.left}px, 0, 0)`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      )}

      <nav className={cn('flex space-x-1 relative z-10', variant === 'underline' && '-mb-px')}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              data-tab-id={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 py-1.5 px-3.5 text-[13px] rounded-full transition-colors duration-tab select-none active:scale-[0.975] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088FF]/50 dark:focus-visible:ring-[#0091FF]/60',
                variant === 'underline'
                  ? isActive
                    ? 'text-[#0088FF] dark:text-[#0091FF] font-semibold'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-white'
                  : isActive
                  ? 'text-[#0088FF] dark:text-[#0091FF] font-semibold'
                  : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium'
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors',
                    isActive
                      ? 'bg-[#0088FF]/12 text-[#0088FF] dark:bg-[#0091FF]/20 dark:text-[#0091FF]'
                      : 'bg-black/[0.05] text-[#6e6e73] dark:bg-white/[0.1] dark:text-[#a1a1a6]'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
