import React from 'react';
import { cn } from '@/lib/utils';
import { SFChartLineUptrendXyaxis, SFChartLineDowntrendXyaxis, SFMinus } from 'sf-symbols-lib';
import { useLiquidTilt } from '@/hooks/useLiquidTilt';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  type?: 'actual' | 'calculated' | 'recommendation';
  severity?: 'normal' | 'warning' | 'critical';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  trend,
  type = 'actual',
  severity = 'normal',
  onClick,
  className
}) => {
  const tiltRef = useLiquidTilt<HTMLDivElement>({ maxTilt: 2.2 });

  const typeLabels = {
    actual: 'Thực tế',
    calculated: 'Tính toán',
    recommendation: 'Gợi ý AI'
  };

  const typeStyles = {
    actual: 'bg-[#f5f5f7] text-[#1d1d1f] dark:bg-white/10 dark:text-white',
    calculated: 'bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]',
    recommendation: 'bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]'
  };

  const severityBorders = {
    normal: 'border-[#e0e0e0] dark:border-white/10',
    warning: 'border-amber-300 dark:border-amber-700/60 bg-amber-50/20',
    critical: 'border-rose-300 dark:border-rose-700/60 bg-rose-50/20'
  };

  return (
    <div
      ref={tiltRef}
      onClick={onClick}
      className={cn(
        'p-5.5 rounded-[20px] border border-white/60 dark:border-white/12 liquid-glass-3d liquid-tilt-card transition-all duration-260 ease-spring relative overflow-hidden',
        'animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-[0.98] duration-350 ease-spring group',
        severityBorders[severity],
        onClick && 'cursor-pointer active:scale-[0.98] active:translate-y-[1px] hover:shadow-ios-liquid-hover',
        className
      )}
    >
      {/* Subtle liquid shimmer specular highlight */}
      <div
        className="pointer-events-none absolute -inset-full bg-gradient-to-r from-transparent via-white/12 dark:via-white/[0.06] to-transparent rotate-12 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        aria-hidden="true"
      />
      {/* Specular edge reflection */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent z-10"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold text-[#76767b] dark:text-[#a1a1a6] tracking-wide uppercase">{title}</p>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', typeStyles[type])}>
              {typeLabels[type]}
            </span>
          </div>
          <p className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white tabular-nums">{value}</p>
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-full bg-[#f5f5f7] dark:bg-white/5 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0 shadow-2xs">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || change !== undefined) && (
        <div className="mt-3.5 pt-3 border-t border-[#e0e0e0]/70 dark:border-white/10 flex items-center justify-between text-[12px]">
          {subtitle && (
            <span className="text-[#76767b] dark:text-[#a1a1a6] truncate">{subtitle}</span>
          )}
          {change !== undefined && (
            <div className="flex items-center gap-1 font-semibold ml-auto">
              {trend === 'up' || change > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <SFChartLineUptrendXyaxis size={14} />
                  +{change}%
                </span>
              ) : trend === 'down' || change < 0 ? (
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                  <SFChartLineDowntrendXyaxis size={14} />
                  {change}%
                </span>
              ) : (
                <span className="text-[#76767b] flex items-center gap-0.5">
                  <SFMinus size={14} />
                  {change}%
                </span>
              )}
              {changeLabel && <span className="text-[#76767b] font-normal ml-1">{changeLabel}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
