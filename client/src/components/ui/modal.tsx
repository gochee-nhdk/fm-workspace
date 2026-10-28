import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CloseButton } from '@/components/ui/close-button';
import { motionTokens } from '@/lib/motion';

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
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChildrenRef = useRef<React.ReactNode | null>(null);

  if (isOpen && children) {
    lastChildrenRef.current = children;
  }

  useLayoutEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (isMounted) {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
        document.body.style.overflow = '';
        closeTimerRef.current = null;
      }, motionTokens.duration.exit + 10);
    }
  }, [isOpen, isMounted]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    onClose();
  }, [isClosing, onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMounted && !isClosing) {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    if (isMounted) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isMounted, isClosing, handleClose]);

  if (!isMounted) return null;

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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden select-none"
    >
      {/* Liquid Backdrop Fade */}
      <div
        className={cn(
          'fixed inset-0 bg-black/45 backdrop-blur-md will-change-[opacity] [transform:translateZ(0)]',
          isClosing ? 'liquid-backdrop-exit pointer-events-none' : 'liquid-backdrop-enter pointer-events-auto'
        )}
        onClick={handleClose}
      />

      {/* Fluid Droplet Modal Surface */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full bg-white dark:bg-[#1c1c22] rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border border-black/10 dark:border-white/15 overflow-hidden z-10 max-h-[90vh] flex flex-col font-sans will-change-[transform,opacity] [transform:translateZ(0)]',
          sizes[size],
          isClosing ? 'liquid-droplet-exit pointer-events-none' : 'liquid-droplet-enter pointer-events-auto'
        )}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4.5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-[#fbfbfd] dark:bg-white/[0.02]">
            <div>
              {title && (
                <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-white tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5 leading-normal">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <CloseButton onClick={handleClose} size="sm" />
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto overscroll-contain flex-1">
          {isClosing && lastChildrenRef.current ? lastChildrenRef.current : children}
        </div>
      </div>
    </div>,
    document.body
  );
};
