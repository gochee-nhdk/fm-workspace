import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-black/[0.04] text-[#6e6e73] dark:bg-white/[0.08] dark:text-[#a1a1a6] border-black/[0.08] dark:border-white/[0.14]',
    success: 'bg-[#34C759]/10 text-[#1a8238] dark:bg-[#30D158]/15 dark:text-[#30D158] border-[#34C759]/25 dark:border-[#30D158]/30',
    warning: 'bg-[#FF8D28]/10 text-[#b45309] dark:bg-[#FF9230]/15 dark:text-[#FF9230] border-[#FF8D28]/25 dark:border-[#FF9230]/30',
    danger: 'bg-[#FF383C]/10 text-[#c1272c] dark:bg-[#FF4245]/15 dark:text-[#FF4245] border-[#FF383C]/25 dark:border-[#FF4245]/30',
    info: 'bg-[#0088FF]/10 text-[#0071e3] dark:bg-[#0091FF]/15 dark:text-[#3898ff] border-[#0088FF]/20 dark:border-[#0091FF]/28',
    purple: 'bg-[#CB30E0]/10 text-[#9c1fb0] dark:bg-[#DB34F2]/15 dark:text-[#e56ef7] border-[#CB30E0]/20 dark:border-[#DB34F2]/28'
  };

  const dotColors = {
    default: 'bg-[#6e6e73] dark:bg-[#a1a1a6]',
    success: 'bg-[#34C759] dark:bg-[#30D158]',
    warning: 'bg-[#FF8D28] dark:bg-[#FF9230]',
    danger: 'bg-[#FF383C] dark:bg-[#FF4245]',
    info: 'bg-[#0088FF] dark:bg-[#0091FF]',
    purple: 'bg-[#CB30E0] dark:bg-[#DB34F2]'
  };

  const sizes = {
    sm: 'text-[11px] px-2.5 py-0.5 font-medium',
    md: 'text-[12px] px-3 py-1 font-medium'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border tracking-wide select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};
