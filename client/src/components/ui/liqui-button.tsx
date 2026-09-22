'use client';

import React from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { LiquiGlass, type LiquiGlassProps } from '@liqui-design/glass';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * liqui Button — one component, two materials, chosen by what the button means.
 * Official component from https://liqui.design/r/button.json
 */
const glassButtonVariants = cva(
  'group inline-flex cursor-default select-none outline-none transition-[transform,box-shadow] duration-150 data-[pressed]:scale-[0.97] active:scale-[0.97] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lq-accent)_40%,transparent)]',
);

const glassButtonContentVariants = cva(
  'inline-flex items-center justify-center rounded-[inherit] font-semibold leading-tight whitespace-nowrap group-hover:bg-[color-mix(in_srgb,var(--lq-highlight)_40%,transparent)] group-data-[disabled]:bg-transparent',
  {
    variants: {
      size: {
        sm: 'gap-1.5 px-3 py-1.5 text-xs',
        md: 'gap-[7px] px-4 py-[9px] text-[13.5px]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

const solidButtonVariants = cva(
  cn(
    'inline-flex cursor-default select-none items-center justify-center',
    'border-none font-semibold whitespace-nowrap text-white',
    'outline-none transition-[background-color,transform] duration-150',
    'data-[pressed]:scale-[0.97] active:scale-[0.97]',
    'focus-visible:outline-2 focus-visible:outline-offset-[3px]',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  ),
  {
    variants: {
      variant: {
        glass: '',
        accent: cn(
          'bg-[var(--lq-accent)]',
          'hover:not-data-disabled:bg-[color-mix(in_srgb,white_14%,var(--lq-accent))]',
          'focus-visible:outline-[color-mix(in_srgb,var(--lq-accent)_70%,transparent)]',
        ),
        danger: cn(
          'bg-[var(--lq-danger)]',
          'hover:not-data-disabled:bg-[color-mix(in_srgb,white_14%,var(--lq-danger))]',
          'focus-visible:outline-[color-mix(in_srgb,var(--lq-danger)_70%,transparent)]',
        ),
      },
      size: {
        sm: 'gap-1.5 px-3 py-1.5 text-xs leading-tight',
        md: 'gap-[7px] px-4 py-[9px] text-[13.5px] leading-tight',
      },
    },
    defaultVariants: { variant: 'accent', size: 'md' },
  },
);

const BUTTON_GLASS = {
  radius: 12,
  blur: 1,
  refraction: 45,
  bezel: 11,
} satisfies Partial<LiquiGlassProps>;

export interface LiquiButtonProps
  extends BaseButton.Props,
    VariantProps<typeof solidButtonVariants> {
  glass?: Partial<LiquiGlassProps>;
  icon?: React.ReactNode;
}

export function LiquiButton({
  variant = 'glass',
  size = 'md',
  glass,
  className,
  style,
  icon,
  children,
  ...props
}: LiquiButtonProps) {
  const content = (
    <>
      {icon && <span className="shrink-0 mr-1.5">{icon}</span>}
      {children}
    </>
  );

  if (variant !== 'glass') {
    return (
      <BaseButton
        {...props}
        style={{ borderRadius: glass?.radius ?? BUTTON_GLASS.radius, ...style }}
        className={cn(solidButtonVariants({ variant, size }), className)}
      >
        {content}
      </BaseButton>
    );
  }

  return (
    <BaseButton
      {...props}
      style={style}
      nativeButton={false}
      className={cn(glassButtonVariants(), className)}
      render={
        <LiquiGlass
          {...BUTTON_GLASS}
          {...glass}
          contentClassName={glassButtonContentVariants({ size })}
        >
          {content}
        </LiquiGlass>
      }
    />
  );
}

export { solidButtonVariants as liquiButtonVariants };
export default LiquiButton;
