import React, { useState } from 'react';
import { POFolderItem, FolderColor, FOLDER_COLOR_CONFIG } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { Drawer } from '@/components/ui/drawer';
import { SFCheckmark } from 'sf-symbols-lib';
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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingFolder ? 'Chỉnh sửa Nhóm PO' : 'Tạo Nhóm PO mới'}
      description="Phân loại các đơn hàng theo mục đích sử dụng hoặc ngành hàng"
      width="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-left">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Tên nhóm <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Hàng kinh doanh, Hàng kho VP..."
            maxLength={80}
            required
            className="w-full h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13.5px] font-medium text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Mô tả mục đích
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả mục đích của nhóm này..."
            rows={2}
            maxLength={200}
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] font-medium text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all resize-none"
          />
        </div>

        {/* Color */}
        <div className="space-y-2 pt-1">
          <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Màu sắc nhận diện
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {COLOR_OPTIONS.map((c) => {
              const cfg = FOLDER_COLOR_CONFIG[c];
              const isSelected = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-10 px-2 rounded-2xl flex items-center justify-center gap-2 text-[12px] font-semibold transition-all duration-200 cursor-pointer select-none active:scale-95',
                    isSelected
                      ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-2 ring-black/20 dark:ring-white/30 dark:ring-offset-[#1c1c22] shadow-xs scale-[1.02]`
                      : 'bg-black/[0.03] dark:bg-white/[0.04] text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08]'
                  )}
                >
                  <span className={cn('w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center transition-transform', cfg.dot, isSelected && 'scale-110 shadow-xs')}>
                    {isSelected && <SFCheckmark size={9} className="text-white stroke-[2.5]" />}
                  </span>
                  <span className="text-[11.5px] font-medium truncate">{COLOR_LABELS[c]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex gap-3 border-t border-black/[0.06] dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-full border border-black/15 dark:border-white/15 text-[13px] font-semibold text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="flex-1 h-10 rounded-full fm-primary-pill-surface text-[13.5px] font-bold text-white disabled:opacity-40 hover:opacity-90 transition-all cursor-pointer shadow-xs"
          >
            {loading ? 'Đang lưu...' : editingFolder ? 'Lưu thay đổi' : 'Tạo nhóm'}
          </button>
        </div>
      </form>
    </Drawer>
  );
};
