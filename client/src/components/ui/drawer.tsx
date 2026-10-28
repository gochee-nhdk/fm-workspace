import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CloseButton } from '@/components/ui/close-button';
import { motionTokens } from '@/lib/motion';

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
      }, motionTokens.duration.exit);
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
    }, motionTokens.duration.exit);
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
    <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Full-screen Liquid Glass backdrop blur */}
      <div
        className={cn(
          'fixed inset-0 bg-black/45 backdrop-blur-md',
          isClosing ? 'liquid-backdrop-exit' : 'liquid-backdrop-enter'
        )}
        onClick={handleClose}
      />
      {/* Centered Floating Glass Dialog on Desktop / Fluid Bottom Sheet on Mobile */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-[#1c1c22] shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border-t sm:border border-black/10 dark:border-white/15 rounded-t-[28px] sm:rounded-[24px] rounded-b-none sm:rounded-b-[24px] flex flex-col max-h-[88vh] sm:max-h-[90vh] overflow-hidden z-10 pb-[env(safe-area-inset-bottom,0px)]',
          widths[width],
          isClosing ? 'liquid-droplet-exit' : 'liquid-droplet-enter'
        )}
      >
        {/* Mobile Sheet Drag Indicator Handle */}
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20 mx-auto mt-2.5 -mb-1 shrink-0" />
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
          <CloseButton onClick={handleClose} size="md" />
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
