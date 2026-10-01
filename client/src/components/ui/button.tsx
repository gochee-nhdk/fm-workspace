import React from 'react';
import { cn } from '@/lib/utils';
import { SFArrowClockwise } from 'sf-symbols-lib';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'success'
    | 'glass'
    | 'glassProminent'
    | 'liquiGlass'
    | 'macosProminent'
    | 'macosBordered'
    | 'macosBorderedTinted'
    | 'macosBorderedDestructive'
    | 'macosProminentDestructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      icon,
      children,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-[transform,box-shadow,background-color,border-color,opacity] duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088FF]/50 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed select-none hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.95] disabled:hover:translate-y-0 disabled:active:scale-100 tracking-tight relative overflow-hidden shrink-0 font-sans cursor-pointer will-change-transform';

    const variants = {
      primary:
        'bg-[#0088FF] dark:bg-[#0091FF] text-white hover:brightness-105 shadow-xs hover:shadow-[0_2px_8px_rgba(0,136,255,0.35)] rounded-full border border-white/20',
      secondary:
        'bg-white/80 dark:bg-[#272729]/80 text-[#1d1d1f] dark:text-white hover:bg-white dark:hover:bg-[#2a2a2c] border border-black/10 dark:border-white/10 rounded-full shadow-2xs backdrop-blur-md',
      outline:
        'border border-[#0088FF]/40 dark:border-[#0091FF]/40 bg-transparent text-[#0088FF] dark:text-[#0091FF] hover:bg-[#0088FF]/10 dark:hover:bg-[#0091FF]/15 hover:border-[#0088FF] rounded-full',
      ghost:
        'bg-transparent text-[#1d1d1f] dark:text-[#cccccc] hover:bg-black/5 dark:hover:bg-white/10 rounded-full',
      danger:
        'bg-[#FF383C] dark:bg-[#FF4245] text-white hover:brightness-105 rounded-full border border-white/20 shadow-xs',
      success:
        'bg-[#34C759] dark:bg-[#30D158] text-white hover:brightness-105 rounded-full border border-white/20 shadow-xs',
      glass: 'glass-btn rounded-full',
      glassProminent: 'glass-btn-prominent rounded-full',
      liquiGlass:
        'liquid-lens-pill text-[#1d1d1f] dark:text-white hover:scale-[1.02] border border-white/60 dark:border-white/15',
      // macOS 27 Official Layer Styles
      macosProminent: 'macos-btn-prominent',
      macosBordered: 'macos-btn-bordered',
      macosBorderedTinted: 'macos-btn-bordered-tinted',
      macosBorderedDestructive: 'macos-btn-bordered-destructive',
      macosProminentDestructive: 'macos-btn-prominent-destructive',
    };

    const sizes = {
      sm: 'text-[13px] px-3.5 py-1.5 h-8 gap-1.5',
      md: 'text-[14px] px-4.5 py-2 h-9.5 gap-2',
      lg: 'text-[16px] px-6 py-2.5 h-11 gap-2.5',
      icon: 'w-9 h-9 p-0 rounded-full',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading ? 'true' : undefined}
        style={style}
        className={cn(baseStyles, variants[variant as keyof typeof variants] || variants.primary, sizes[size], className)}
        {...props}
      >
        {loading ? (
          <SFArrowClockwise size={15} className="animate-spin text-current shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
