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
          ? 'border-b border-[#e0e0e0] dark:border-white/10'
          : 'bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-full inline-flex border border-black/[0.05] dark:border-white/10 backdrop-blur-md',
        className
      )}
    >
      {/* Liquid Droplet Sliding Indicator Pill */}
      {indicatorStyle.ready && indicatorStyle.width > 0 && (
        <div
          className={cn(
            'absolute transition-[transform,width] duration-260 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none will-change-[transform,width]',
            variant === 'underline'
              ? 'bottom-0 h-0.5 bg-[#0066cc] dark:bg-[#2997ff] rounded-full'
              : 'top-1 bottom-1 rounded-full bg-white dark:bg-[#1d1d1f] shadow-xs border border-black/[0.04] dark:border-white/10'
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
              data-tab-id={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 py-1.5 px-3.5 text-[13px] rounded-full transition-colors duration-160 select-none active:scale-[0.975] cursor-pointer',
                variant === 'underline'
                  ? isActive
                    ? 'text-[#0066cc] dark:text-[#2997ff] font-semibold'
                    : 'text-[#76767b] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-white'
                  : isActive
                  ? 'text-[#1d1d1f] dark:text-white font-semibold'
                  : 'text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-normal'
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors',
                    isActive
                      ? 'bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]'
                      : 'bg-black/5 text-[#76767b] dark:bg-white/10 dark:text-[#a1a1a6]'
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
