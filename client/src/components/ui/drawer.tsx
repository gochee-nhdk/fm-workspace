import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { SFXmark } from 'sf-symbols-lib';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  width = 'md'
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

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-[540px]',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl'
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 sm:p-6">
      {/* Full-screen Liquid Glass backdrop blur */}
      <div
        className={cn(
          'fixed inset-0 bg-black/45 backdrop-blur-md',
          isClosing ? 'liquid-backdrop-exit' : 'liquid-backdrop-enter'
        )}
        onClick={handleClose}
      />
      {/* Centered Floating Glass Dialog with Fluid Droplet Motion */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-[#1c1c22] shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border border-black/10 dark:border-white/15 rounded-[24px] flex flex-col max-h-[90vh] overflow-hidden z-10',
          widths[width],
          isClosing ? 'liquid-droplet-exit' : 'liquid-droplet-enter'
        )}
      >
        <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-[#fbfbfd] dark:bg-white/[0.02]">
          <div>
            {title && (
              <h3 className="text-[18px] sm:text-[19px] font-bold text-[#1d1d1f] dark:text-white tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] mt-0.5 leading-normal">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Đóng (Esc)"
          >
            <SFXmark size={14} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
