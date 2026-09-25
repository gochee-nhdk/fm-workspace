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

// Authentic Apple Notes Notepad Badge with macOS Yellow Header & Ruled Lines
export const AppleNotesBadge: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
  className = '',
}) => (
  <div
    className={`inline-flex items-center justify-center shrink-0 rounded-[6px] overflow-hidden shadow-2xs border border-black/10 dark:border-white/20 ${className}`}
    style={{ width: size, height: size }}
  >
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect width="20" height="20" rx="5" fill="#FFFFFF" />
      <path d="M0 0H20V6H0V0Z" fill="url(#notes-badge-yellow)" />
      <line x1="4" y1="9.5" x2="16" y2="9.5" stroke="#E5E5EA" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="12.5" x2="16" y2="12.5" stroke="#E5E5EA" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="15.5" x2="12" y2="15.5" stroke="#E5E5EA" strokeWidth="1.2" strokeLinecap="round" />
      <defs>
        <linearGradient id="notes-badge-yellow" x1="0" y1="0" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD60A" />
          <stop offset="1" stopColor="#FF9F0A" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);
