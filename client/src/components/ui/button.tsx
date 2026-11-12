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
      'inline-flex items-center justify-center font-medium transition-[transform,box-shadow,background-color,border-color,opacity,filter] duration-200 ease-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088FF]/50 dark:focus-visible:ring-[#0091FF]/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1c1c21] focus-visible:shadow-[0_0_12px_rgba(0,136,255,0.35)] disabled:opacity-40 disabled:cursor-not-allowed select-none hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:hover:translate-y-0 disabled:active:scale-100 tracking-tight relative overflow-hidden shrink-0 font-sans cursor-pointer';

    const variants = {
      primary:
        'fm-primary-pill-surface text-white hover:brightness-105 active:scale-95 rounded-full shadow-[0_2px_8px_rgba(0,136,255,0.28)] hover:shadow-[0_4px_14px_rgba(0,136,255,0.38)]',
      secondary:
        'bg-white/90 dark:bg-[#272729]/90 backdrop-blur-md text-[#1d1d1f] dark:text-white hover:bg-white dark:hover:bg-[#303036] border border-black/10 dark:border-white/12 rounded-full shadow-2xs hover:shadow-xs active:scale-95',
      outline:
        'border border-[#0088FF]/40 dark:border-[#0091FF]/40 bg-transparent text-[#0088FF] dark:text-[#0091FF] hover:bg-[#0088FF]/10 dark:hover:bg-[#0091FF]/15 hover:border-[#0088FF] dark:hover:border-[#0091FF] active:scale-95 rounded-full',
      ghost:
        'bg-transparent text-[#1d1d1f] dark:text-[#cccccc] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 rounded-full',
      danger:
        'bg-[#FF383C] dark:bg-[#FF4245] text-white hover:brightness-105 active:scale-95 rounded-full border border-white/20 shadow-[0_2px_8px_rgba(255,56,60,0.3)]',
      success:
        'bg-[#34C759] dark:bg-[#30D158] text-white hover:brightness-105 active:scale-95 rounded-full border border-white/20 shadow-[0_2px_8px_rgba(52,199,89,0.3)]',
      glass: 'glass-btn rounded-full active:scale-95',
      glassProminent: 'glass-btn-prominent rounded-full active:scale-95',
      liquiGlass:
        'liquid-lens-pill text-[#1d1d1f] dark:text-white hover:scale-[1.02] active:scale-95 border border-white/60 dark:border-white/15',
      // macOS 27 Official Layer Styles
      macosProminent: 'macos-btn-prominent active:scale-95',
      macosBordered: 'macos-btn-bordered active:scale-95',
      macosBorderedTinted: 'macos-btn-bordered-tinted active:scale-95',
      macosBorderedDestructive: 'macos-btn-bordered-destructive active:scale-95',
      macosProminentDestructive: 'macos-btn-prominent-destructive active:scale-95',
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
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {loading ? (
            <SFArrowClockwise size={15} className="animate-spin text-current shrink-0" />
          ) : icon ? (
            <span className="shrink-0">{icon}</span>
          ) : null}
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
