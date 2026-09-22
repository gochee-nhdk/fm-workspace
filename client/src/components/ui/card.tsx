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
        'rounded-[18px] border border-[#e0e0e0] dark:border-white/10 overflow-hidden transition-all duration-200 ease-apple-spring',
        glass
          ? 'bg-white/80 dark:bg-[#1d1d1f]/80 backdrop-blur-xl shadow-xs'
          : 'bg-white dark:bg-[#1d1d1f] shadow-xs',
        (hoverable || tilt) && 'liquid-tilt-card hover:shadow-md hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/40 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('px-6 py-4.5 border-b border-[#e0e0e0]/70 dark:border-white/10 flex items-center justify-between', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => (
  <h3 className={cn('text-[16px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight', className)} {...props}>
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
  <div className={cn('px-6 py-3.5 bg-[#fafafc] dark:bg-[#272729]/60 border-t border-[#e0e0e0]/70 dark:border-white/10 flex items-center justify-end gap-2.5', className)} {...props}>
    {children}
  </div>
);
