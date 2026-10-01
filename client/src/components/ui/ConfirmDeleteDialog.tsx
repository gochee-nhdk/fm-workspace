import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { SFExclamationmarkTriangleFill, SFTrash } from 'sf-symbols-lib';
import { Button } from './button';
import { CloseButton } from '@/components/ui/close-button';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemLabel?: string;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Xóa mục này?',
  description = 'Hành động này không thể hoàn tác. Dữ liệu sẽ bị xóa khỏi bộ nhớ workspace.',
  itemLabel,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-white dark:bg-[#1c1c22] rounded-[24px] max-w-md w-full p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border border-black/10 dark:border-white/15 apple-modal-enter"
      >
        <CloseButton
          onClick={onClose}
          size="sm"
          className="absolute top-4 right-4"
        />

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center shrink-0">
            <SFExclamationmarkTriangleFill size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
              {title}
            </h3>
            {itemLabel && (
              <p className="mt-1.5 text-[13px] font-medium text-[#1d1d1f] dark:text-[#a1a1a6] truncate bg-[#f5f5f7] dark:bg-white/5 px-3 py-1 rounded-full border border-[#e0e0e0]/60 dark:border-white/5">
                {itemLabel}
              </p>
            )}
            <p className="mt-2 text-[13px] text-[#76767b] dark:text-[#a1a1a6] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            loading={loading}
            icon={<SFTrash size={14} />}
          >
            Xác nhận xóa
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
