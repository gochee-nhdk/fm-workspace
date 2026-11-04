import React, { useState, useRef } from 'react';
import { POFolderItem, FolderColor, FOLDER_COLOR_CONFIG } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const COLOR_OPTIONS: FolderColor[] = ['blue', 'amber', 'emerald', 'rose', 'purple', 'gray', 'orange', 'cyan'];
const COLOR_LABELS: Record<FolderColor, string> = {
  blue: 'Xanh dương', amber: 'Vàng', emerald: 'Xanh lá', rose: 'Hồng',
  purple: 'Tím', gray: 'Xám', orange: 'Cam', cyan: 'Xanh lơ',
};

interface POFolderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingFolder?: POFolderItem | null;
}

export const POFolderDrawer: React.FC<POFolderDrawerProps> = ({
  isOpen,
  onClose,
  editingFolder,
}) => {
  const { addFolderToList, updateFolderInList } = usePOTrackerStore();

  const [name, setName] = useState(editingFolder?.name || '');
  const [description, setDescription] = useState(editingFolder?.description || '');
  const [color, setColor] = useState<FolderColor>(editingFolder?.color || 'blue');
  const [loading, setLoading] = useState(false);

  // Reset when editingFolder changes or drawer opens
  React.useEffect(() => {
    if (isOpen) {
      setName(editingFolder?.name || '');
      setDescription(editingFolder?.description || '');
      setColor(editingFolder?.color || 'blue');
    }
  }, [isOpen, editingFolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editingFolder) {
        const res = await poTrackerService.updateFolder(editingFolder.id, { name: name.trim(), description: description || null, color });
        updateFolderInList(editingFolder.id, res.data.data);
        toast.success('Đã cập nhật nhóm.');
      } else {
        const res = await poTrackerService.createFolder({ name: name.trim(), description: description || null, color });
        addFolderToList(res.data.data);
        toast.success('Đã tạo nhóm mới.');
      }
      onClose();
    } catch {
      toast.error('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm liquid-backdrop-enter"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[201] w-full max-w-[420px] apple-drawer-enter flex flex-col">
        <div className="vision-glass-sidebar h-full flex flex-col shadow-2xl border-l border-black/[0.08] dark:border-white/10">
          {/* Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <h2 className="text-[16px] font-bold text-[#1d1d1f] dark:text-white">
              {editingFolder ? 'Chỉnh sửa Nhóm' : 'Tạo Nhóm mới'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#555558] dark:text-[#a1a1a6] uppercase tracking-wide">
                Tên nhóm <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Hàng kinh doanh, Hàng kho VP..."
                maxLength={80}
                required
                className="w-full h-10 px-3.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-[14px] text-[#1d1d1f] dark:text-white placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 focus:border-[#0088FF]/50 transition-all"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#555558] dark:text-[#a1a1a6] uppercase tracking-wide">
                Mô tả (tùy chọn)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục đích của nhóm này..."
                rows={2}
                maxLength={200}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-[14px] text-[#1d1d1f] dark:text-white placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 focus:border-[#0088FF]/50 transition-all resize-none"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[#555558] dark:text-[#a1a1a6] uppercase tracking-wide">
                Màu nhóm
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_OPTIONS.map((c) => {
                  const cfg = FOLDER_COLOR_CONFIG[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'h-10 rounded-xl flex items-center justify-center gap-2 text-[12px] font-medium border-2 transition-all duration-150 cursor-pointer active:scale-95',
                        color === c
                          ? `${cfg.bg} ${cfg.text} border-current shadow-sm`
                          : 'bg-white/40 dark:bg-white/[0.04] border-transparent text-[#555558] dark:text-[#a1a1a6] hover:bg-white/80 dark:hover:bg-white/[0.08]'
                      )}
                      title={COLOR_LABELS[c]}
                    >
                      <span className={cn('w-3 h-3 rounded-full shrink-0', cfg.dot)} />
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#999] dark:text-[#666]">
                Màu đang chọn: <span className="font-semibold">{COLOR_LABELS[color]}</span>
              </p>
            </div>
          </form>

          {/* Footer */}
          <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-full border border-black/[0.1] dark:border-white/[0.12] text-[13px] font-medium text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit as any}
              disabled={!name.trim() || loading}
              className="flex-1 h-10 rounded-full fm-primary-pill-surface text-[13px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all cursor-pointer active:scale-[0.98]"
            >
              {loading ? 'Đang lưu...' : editingFolder ? 'Lưu thay đổi' : 'Tạo nhóm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
