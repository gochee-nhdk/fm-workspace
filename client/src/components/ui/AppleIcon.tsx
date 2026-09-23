import React from 'react';
import type { SFIconProps, SFIconSize } from 'sf-symbols-lib';

export type AppleIconRenderMode = 'dualtone' | 'monochrome';

export interface AppleIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'size'> {
  symbol: React.ComponentType<SFIconProps>;
  size?: SFIconSize;
  className?: string;
  renderMode?: AppleIconRenderMode;
}

/**
 * AppleIcon - Unified Apple Human Interface Guidelines (HIG) SF Symbol component.
 * Supports standard Apple optical sizing (xs, sm, md, lg, xl or number) and rendering modes.
 */
export const AppleIcon: React.FC<AppleIconProps> = ({
  symbol: SymbolComponent,
  size = 'md',
  className = '',
  ...props
}) => {
  return <SymbolComponent size={size} className={className} {...props} />;
};

// Re-export symbols & types from sf-symbols-lib for direct convenient imports
export * from 'sf-symbols-lib';
