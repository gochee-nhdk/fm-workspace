import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (isMounted && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setIsMounted(false);
      document.body.style.overflow = '';
    }, 180);
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

      {/* Fluid Droplet Modal Surface */}
      <div
        className={cn(
          'relative w-full bg-white/95 dark:bg-[#16161c]/95 backdrop-blur-3xl rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.2),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-1px_1.5px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.18)] border border-white/80 dark:border-white/15 overflow-hidden z-10 max-h-[90vh] flex flex-col',
          sizes[size],
          isClosing ? 'liquid-droplet-exit' : 'liquid-droplet-enter'
        )}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4.5 border-b border-[#e0e0e0]/70 dark:border-white/10 flex items-center justify-between shrink-0">
            <div>
              {title && (
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] mt-0.5 leading-normal">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-white/10 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
