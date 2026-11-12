import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/lib/motion';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

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
 * AppleLiquidDialog - macOS 27 Apple Liquid Glass Modal Container
 * Driven by `useAnimatedPresence` with physical spring entrance/exit animations
 * (apple-modal-enter / apple-modal-exit) and liquid glass backdrop transitions
 * (liquid-backdrop-enter / liquid-backdrop-exit).
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
  const { shouldRender, isExiting } = useAnimatedPresence(isOpen, motionTokens.duration.exit + 10);
  const lastChildrenRef = useRef<React.ReactNode | null>(null);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    onClose();
  }, [isExiting, onClose]);

  // Keep last non-null children rendered during the exit animation
  if (isOpen && children) {
    lastChildrenRef.current = typeof children === 'function' ? children({ handleClose, isClosing: false }) : children;
  }

  // Lock body scroll while dialog is rendered
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

  // Escape key handler
  useEffect(() => {
    if (!closeOnEsc || !shouldRender || isExiting) return;
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
  }, [shouldRender, isExiting, handleClose, closeOnEsc]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Cửa sổ'}
      onClick={closeOnBackdropClick && !isExiting ? handleClose : undefined}
      style={{ zIndex }}
      className={cn(
        'fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/40 dark:bg-black/60 backdrop-blur-xl sm:backdrop-blur-2xl select-none will-change-[opacity] [transform:translateZ(0)]',
        isExiting ? 'liquid-backdrop-exit pointer-events-none' : 'liquid-backdrop-enter pointer-events-auto',
        backdropClassName,
        overlayClassName
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'will-change-[transform,opacity] [transform:translateZ(0)]',
          isExiting ? 'apple-modal-exit pointer-events-none' : 'apple-modal-enter pointer-events-auto',
          containerClassName,
          contentClassName
        )}
      >
        {isExiting && lastChildrenRef.current
          ? lastChildrenRef.current
          : typeof children === 'function'
            ? children({ handleClose, isClosing: isExiting })
            : children}
      </div>
    </div>,
    document.body
  );
};
