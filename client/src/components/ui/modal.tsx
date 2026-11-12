import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CloseButton } from '@/components/ui/close-button';
import { motionTokens } from '@/lib/motion';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true
}) => {
  const { shouldRender, isExiting } = useAnimatedPresence(isOpen, motionTokens.duration.exit + 10);
  const lastChildrenRef = useRef<React.ReactNode | null>(null);

  if (isOpen && children) {
    lastChildrenRef.current = children;
  }

  const handleClose = useCallback(() => {
    if (isExiting) return;
    onClose();
  }, [isExiting, onClose]);

  // Lock body scroll while modal is active
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

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl'
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Cửa sổ thông tin'}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-hidden select-none"
    >
      {/* Liquid Backdrop with macOS 27 deep blur */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xl sm:backdrop-blur-2xl will-change-[opacity] [transform:translateZ(0)]',
          isExiting ? 'liquid-backdrop-exit pointer-events-none' : 'liquid-backdrop-enter pointer-events-auto'
        )}
        onClick={handleClose}
      />

      {/* Fluid Droplet Modal Surface */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full bg-white/95 dark:bg-[#1c1c22]/95 backdrop-blur-2xl rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_28px_84px_rgba(0,0,0,0.6),inset_0_1.5px_1px_rgba(255,255,255,0.12)] border border-black/10 dark:border-white/15 overflow-hidden z-10 max-h-[90vh] flex flex-col font-sans will-change-[transform,opacity] [transform:translateZ(0)]',
          sizes[size],
          isExiting ? 'liquid-droplet-exit pointer-events-none' : 'liquid-droplet-enter pointer-events-auto'
        )}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4.5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-[#fbfbfd]/80 dark:bg-white/[0.03] backdrop-blur-md">
            <div>
              {title && (
                <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[12.5px] text-[#76767b] dark:text-[#a1a1a6] mt-0.5 leading-normal">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <CloseButton onClick={handleClose} size="sm" />
            )}
          </div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1">
          {isExiting && lastChildrenRef.current ? lastChildrenRef.current : children}
        </div>
      </div>
    </div>,
    document.body
  );
};
