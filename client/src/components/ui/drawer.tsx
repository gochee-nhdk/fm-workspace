import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CloseButton } from '@/components/ui/close-button';
import { motionTokens } from '@/lib/motion';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  width = 'md'
}) => {
  const { shouldRender, isExiting } = useAnimatedPresence(isOpen, motionTokens.duration.exit + 10);
  const lastChildrenRef = useRef<React.ReactNode | null>(null);

  // Preserve non-null children during the exit animation so forms don't flash blank
  if (isOpen && children) {
    lastChildrenRef.current = children;
  }

  const handleClose = useCallback(() => {
    if (isExiting) return;
    onClose();
  }, [isExiting, onClose]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (shouldRender) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldRender]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && shouldRender && !isExiting) {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    if (shouldRender) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [shouldRender, isExiting, handleClose]);

  if (!shouldRender) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-[540px]',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[94vw]'
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Bảng chức năng'}
      className="fixed inset-0 z-[9999] overflow-hidden flex items-end sm:items-center justify-center p-0 sm:p-6 select-none"
    >
      {/* Full-screen Liquid Glass backdrop blur */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xl sm:backdrop-blur-2xl will-change-[opacity] [transform:translateZ(0)]',
          isExiting ? 'liquid-backdrop-exit pointer-events-none' : 'liquid-backdrop-enter pointer-events-auto'
        )}
        onClick={handleClose}
      />
      {/* Centered Floating Glass Dialog on Desktop / Fluid Bottom Sheet on Mobile */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full bg-white/95 dark:bg-[#1c1c22]/95 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_28px_84px_rgba(0,0,0,0.6),inset_0_1.5px_1px_rgba(255,255,255,0.12)] border-t sm:border border-black/10 dark:border-white/15 rounded-t-[28px] sm:rounded-[24px] rounded-b-none sm:rounded-b-[24px] flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden z-10 pb-[env(safe-area-inset-bottom,0px)] will-change-[transform,opacity] [transform:translateZ(0)]',
          widths[width],
          isExiting ? 'apple-drawer-surface-exit pointer-events-none' : 'apple-drawer-surface-enter pointer-events-auto'
        )}
      >
        {/* Mobile Sheet Drag Indicator Handle */}
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20 mx-auto mt-2.5 -mb-1 shrink-0" />
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-[#fbfbfd]/80 dark:bg-white/[0.03] backdrop-blur-md">
          <div>
            {title && (
              <h3 className="text-[17px] sm:text-[19px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[12.5px] sm:text-[13px] text-[#76767b] dark:text-[#a1a1a6] mt-0.5 leading-normal">
                {description}
              </p>
            )}
          </div>
          <CloseButton onClick={handleClose} size="md" />
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1">
          {isExiting && lastChildrenRef.current ? lastChildrenRef.current : children}
        </div>
      </div>
    </div>,
    document.body
  );
};
