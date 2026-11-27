import React from 'react';
import { cn } from '@/lib/utils';
import { useLiquidTilt } from '@/hooks/useLiquidTilt';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glass?: boolean;
  tilt?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable, glass, tilt = false, children, ...props }) => {
  const tiltRef = useLiquidTilt<HTMLDivElement>({ disabled: !tilt && !hoverable });

  return (
    <div
      ref={tiltRef}
      className={cn(
        'rounded-[20px] overflow-hidden transition-[transform,box-shadow,border-color] duration-200',
        glass
          ? 'liquid-glass'
          : 'bg-white/75 dark:bg-[#1c1c22]/75 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-glass dark:shadow-glass-dark',
        (hoverable || tilt) && 'liquid-tilt-card hover:shadow-glass-hover dark:hover:shadow-glass-dark-hover hover:border-[#0088FF]/40 dark:hover:border-[#0091FF]/40 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('px-6 py-4.5 border-b border-black/[0.06] dark:border-white/[0.10] flex items-center justify-between', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => (
  <h3 className={cn('text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => (
  <p className={cn('text-[13px] text-[#76767b] dark:text-[#a1a1a6] mt-0.5 leading-normal', className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('p-6', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('px-6 py-3.5 bg-[#fbfbfd]/80 dark:bg-white/[0.03] border-t border-black/[0.06] dark:border-white/[0.10] flex items-center justify-end gap-2.5', className)} {...props}>
    {children}
  </div>
);
