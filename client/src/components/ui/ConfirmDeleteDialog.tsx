import React, { useState } from 'react';
import { SFExclamationmarkTriangleFill, SFTrash } from 'sf-symbols-lib';
import { Button } from './button';
import { CloseButton } from '@/components/ui/close-button';
import { AppleLiquidDialog } from '@/components/ui/AppleLiquidDialog';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  message?: string;
  itemLabel?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = 'Xóa mục này?',
  description,
  message,
  itemLabel,
  confirmText = 'Xác nhận xóa',
  cancelText = 'Hủy bỏ',
  variant = 'danger',
  isLoading = false,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = isLoading || internalLoading;

  const handleClose = () => {
    if (onClose) onClose();
    if (onCancel) onCancel();
  };

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
      handleClose();
    } catch (err) {
      console.error(err);
    } finally {
      setInternalLoading(false);
    }
  };

  const resolvedDesc = message || description || 'Hành động này không thể hoàn tác. Dữ liệu sẽ bị xóa khỏi bộ nhớ workspace.';

  return (
    <AppleLiquidDialog
      isOpen={isOpen}
      onClose={handleClose}
      zIndex={10030}
      title={title}
      overlayClassName="p-3 sm:p-4"
      contentClassName="relative bg-white/95 dark:bg-[#1c1c22]/95 backdrop-blur-2xl rounded-[24px] max-w-md w-full p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_28px_84px_rgba(0,0,0,0.6),inset_0_1.5px_1px_rgba(255,255,255,0.12)] border border-black/10 dark:border-white/15"
    >
      <CloseButton
        onClick={handleClose}
        size="sm"
        className="absolute top-4 right-4"
      />

      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 ${variant === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/30' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-700/30'} rounded-2xl flex items-center justify-center shrink-0 shadow-xs`}>
          <SFExclamationmarkTriangleFill size={20} />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            {title}
          </h3>
          {itemLabel && (
            <p className="mt-1.5 text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate bg-black/[0.04] dark:bg-white/[0.08] px-3 py-1 rounded-full border border-black/[0.06] dark:border-white/10">
              {itemLabel}
            </p>
          )}
          <p className="mt-2 text-[13px] text-[#76767b] dark:text-[#a1a1a6] leading-relaxed">
            {resolvedDesc}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={handleClose}
          disabled={loading}
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={variant === 'warning' ? 'glassProminent' : 'danger'}
          size="sm"
          onClick={handleConfirm}
          loading={loading}
          icon={variant === 'warning' ? undefined : <SFTrash size={14} />}
        >
          {confirmText}
        </Button>
      </div>
    </AppleLiquidDialog>
  );
};

