import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './button';

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
        className="relative bg-white/80 dark:bg-[#141418]/82 backdrop-blur-3xl rounded-[22px] max-w-md w-full p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/70 dark:border-white/15 animate-in fade-in zoom-in-95 duration-220 ease-out"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-white/10 flex items-center justify-center transition-all active:scale-95"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
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
            icon={<Trash2 className="w-4 h-4" />}
          >
            Xác nhận xóa
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
