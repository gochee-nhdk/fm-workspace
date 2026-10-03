import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface AppleLiquidDialogProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  backdropClassName?: string;
  overlayClassName?: string;
  containerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode | ((props: { handleClose: () => void; isClosing: boolean }) => React.ReactNode);
  title?: string;
  ariaLabel?: string;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
}

/**
 * AppleLiquidDialog - 120 FPS Apple Liquid Glass Modal Container
 * Handles entrance & exit physical spring animations (apple-modal-enter / apple-modal-exit)
 * and deep liquid glass backdrop transitions (liquid-backdrop-enter / liquid-backdrop-exit)
 */
export const AppleLiquidDialog: React.FC<AppleLiquidDialogProps> = ({
  isOpen,
  onClose,
  zIndex = 10005,
  backdropClassName,
  overlayClassName,
  containerClassName,
  contentClassName,
  children,
  title,
  ariaLabel,
  closeOnEsc = true,
  closeOnBackdropClick = true,
}) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChildrenRef = useRef<React.ReactNode | null>(null);

  // Synchronize mount and closing states strictly when isOpen changes
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
    } else if (isMounted) {
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
        timerRef.current = null;
      }, 160);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    onClose();
  }, [isClosing, onClose]);

  // Keep last non-null children rendered during the 160ms exit animation
  if (isOpen && children) {
    lastChildrenRef.current = typeof children === 'function' ? children({ handleClose, isClosing: false }) : children;
  }

  // Clean up timer when the whole component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!closeOnEsc || !isMounted || isClosing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isMounted, isClosing, handleClose, closeOnEsc]);

  if (!isMounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Cửa sổ'}
      onClick={closeOnBackdropClick && !isClosing ? handleClose : undefined}
      style={{ zIndex }}
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4 bg-black/30 dark:bg-black/55 backdrop-blur-md select-none will-change-[backdrop-filter,opacity]',
        isClosing ? 'liquid-backdrop-exit pointer-events-none' : 'liquid-backdrop-enter pointer-events-auto',
        backdropClassName,
        overlayClassName
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'will-change-[transform,opacity]',
          isClosing ? 'apple-modal-exit pointer-events-none' : 'apple-modal-enter pointer-events-auto',
          containerClassName,
          contentClassName
        )}
      >
        {isClosing && lastChildrenRef.current
          ? lastChildrenRef.current
          : typeof children === 'function'
            ? children({ handleClose, isClosing })
            : children}
      </div>
    </div>,
    document.body
  );
};
