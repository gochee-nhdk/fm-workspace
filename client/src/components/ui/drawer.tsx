import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

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
          'relative w-full bg-white/95 dark:bg-[#16161c]/95 backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-1px_1.5px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.18)] border border-white/80 dark:border-white/15 rounded-[24px] flex flex-col max-h-[90vh] overflow-hidden z-10',
          widths[width],
          isClosing ? 'liquid-droplet-exit' : 'liquid-droplet-enter'
        )}
      >
        <div className="px-6 py-5 border-b border-[#e0e0e0]/70 dark:border-white/10 flex items-center justify-between shrink-0">
          <div>
            {title && (
              <h3 className="text-[18px] sm:text-[19px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
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
            className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
