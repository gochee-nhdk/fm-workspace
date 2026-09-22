import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { LiquiGlass, type LiquiGlassProps } from '@liqui-design/glass';
export { LiquiButton, type LiquiButtonProps } from './liqui-button';

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
    | 'liquiGlass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
  glass?: Partial<LiquiGlassProps>;
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
      glass,
      style,
      ...props
    },
    ref
  ) => {
    // If explicitly requested as liquiGlass refraction component from liqui.design
    if (variant === 'liquiGlass') {
      const LIQUI_DEFAULTS: Partial<LiquiGlassProps> = {
        radius: 14,
        blur: 1,
        refraction: 45,
        bezel: 11,
      };

      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          aria-busy={loading ? 'true' : undefined}
          style={style}
          className={cn(
            'group inline-flex cursor-pointer select-none outline-none transition-[transform,box-shadow] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        >
          <LiquiGlass
            {...LIQUI_DEFAULTS}
            {...glass}
            contentClassName={cn(
              'inline-flex items-center justify-center rounded-[inherit] font-medium leading-tight whitespace-nowrap group-hover:bg-[color-mix(in_srgb,var(--lq-highlight)_40%,transparent)]',
              size === 'sm' && 'gap-1.5 px-3 py-1.5 text-xs',
              size === 'md' && 'gap-2 px-4 py-2 text-[13.5px]',
              size === 'lg' && 'gap-2.5 px-6 py-2.5 text-[15px]',
              size === 'icon' && 'p-2 w-9 h-9 justify-center'
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
            ) : icon ? (
              <span className="shrink-0">{icon}</span>
            ) : null}
            {children}
          </LiquiGlass>
        </button>
      );
    }

    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-180 ease-apple-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98] active:translate-y-[0.5px] tracking-tight relative overflow-hidden shrink-0';

    const variants = {
      primary:
        'bg-[#0066cc] text-white hover:bg-[#0071e3] shadow-xs hover:shadow-[0_2px_8px_rgba(0,102,204,0.3)] active:bg-[#0055b3] rounded-full border border-transparent',
      secondary:
        'bg-[#fafafc] dark:bg-[#272729] text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-[#2a2a2c] border border-[#e0e0e0] dark:border-white/10 rounded-full shadow-2xs',
      outline:
        'border border-[#0066cc]/40 dark:border-[#2997ff]/40 bg-transparent text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0066cc]/5 dark:hover:bg-[#2997ff]/10 hover:border-[#0066cc] rounded-full',
      ghost:
        'bg-transparent text-[#1d1d1f] dark:text-[#cccccc] hover:bg-black/5 dark:hover:bg-white/10 rounded-full',
      danger:
        'bg-[#ff3b30] text-white hover:bg-rose-600 active:bg-rose-700 rounded-full border border-transparent shadow-xs',
      success:
        'bg-[#34c759] text-white hover:bg-emerald-600 active:bg-emerald-700 rounded-full border border-transparent shadow-xs',
      glass: 'glass-btn rounded-full',
      glassProminent: 'glass-btn-prominent rounded-full',
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
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
