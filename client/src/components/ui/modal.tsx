import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CloseButton } from '@/components/ui/close-button';

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

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setIsMounted(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (isMounted && !isClosing) {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 160);
    }

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
      setIsMounted(false);
      document.body.style.overflow = '';
    }, 160);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMounted && !isClosing) {
        handleClose();
      }
    };
    if (isMounted) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, isClosing]);

  if (!isMounted) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl'
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* MacBook Liquid Backdrop Fade */}
      <div
        className={cn(
          'fixed inset-0 bg-black/45 backdrop-blur-md',
          isClosing ? 'liquid-backdrop-exit' : 'liquid-backdrop-enter'
        )}
        onClick={handleClose}
      />

      {/* Fluid Droplet Modal Surface - Apple macOS 27 Window Modal Overlay */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-[#1c1c22] rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border border-black/10 dark:border-white/15 overflow-hidden z-10 max-h-[90vh] flex flex-col font-sans',
          sizes[size],
          isClosing ? 'liquid-droplet-exit' : 'liquid-droplet-enter'
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

        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
