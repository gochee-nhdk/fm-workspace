import React from 'react';
import { cn } from '@/lib/utils';

export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
}

/**
 * Pixel-perfect Apple macOS/iOS standard circular close button.
 * Uses a mathematically balanced, centered Xmark with rounded line caps
 * and liquid glass hover/active micro-interactions.
 */
export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  (
    {
      size = 'sm',
      className,
      label = 'Đóng',
      title = 'Đóng (Esc)',
      onClick,
      ...props
    },
    ref
  ) => {
    // Exact Apple HIG sizing dimensions:
    // xs: 20x20px, icon 10px (for compact inputs)
    // sm: 26x26px, icon 12px (for standard modals/drawers)
    // md: 30x30px, icon 13px (for dialogs/popovers)
    // lg: 34x34px, icon 15px (for preview modals)
    const sizeConfig = {
      xs: {
        btn: 'w-5 h-5 min-w-[20px] min-h-[20px]',
        icon: 'w-2.5 h-2.5',
        stroke: '2.4',
      },
      sm: {
        btn: 'w-6.5 h-6.5 min-w-[26px] min-h-[26px]',
        icon: 'w-3 h-3',
        stroke: '2.2',
      },
      md: {
        btn: 'w-7.5 h-7.5 min-w-[30px] min-h-[30px]',
        icon: 'w-3.5 h-3.5',
        stroke: '2.2',
      },
      lg: {
        btn: 'w-8.5 h-8.5 min-w-[34px] min-h-[34px]',
        icon: 'w-4 h-4',
        stroke: '2.2',
      },
    }[size];

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={label}
        title={title}
        className={cn(
          'group relative inline-flex items-center justify-center rounded-full shrink-0 select-none cursor-pointer',
          'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:bg-black/15 dark:active:bg-white/25',
          'text-[#76767b] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-white',
          'transition-all duration-150 ease-out active:scale-90',
          sizeConfig.btn,
          className
        )}
        {...props}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={sizeConfig.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'pointer-events-none transition-transform duration-150 group-active:scale-95',
            sizeConfig.icon
          )}
        >
          <path d="M3.75 3.75L12.25 12.25M12.25 3.75L3.75 12.25" />
        </svg>
      </button>
    );
  }
);

CloseButton.displayName = 'CloseButton';
export default CloseButton;
