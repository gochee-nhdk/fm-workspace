import React, { useState, useEffect, useMemo } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LinkItem } from '@/types/workspace';
import { SFStar, SFStarFill, SFLink, SFExclamationmarkCircle, SFChevronDown } from 'sf-symbols-lib';
import toast from 'react-hot-toast';

interface LinkDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<LinkItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: LinkItem | null;
}

const DEFAULT_CATEGORIES = [
  'Hệ thống',
  'Báo cáo',
  'Vận hành',
  'Tra cứu',
  'Tài liệu',
  'Form mẫu',
  'Khác',
];

export const LinkDrawerForm: React.FC<LinkDrawerFormProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [hangMuc, setHangMuc] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState('Hệ thống');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [stt, setStt] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ hangMuc?: string; link?: string }>({});

  const availableCategories = useMemo(() => {
    const list = [...DEFAULT_CATEGORIES];
    if (initialData?.category && !list.includes(initialData.category)) {
      list.splice(list.length - 1, 0, initialData.category);
    }
    return list;
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      setHangMuc(initialData.hangMuc || '');
      setLink(initialData.link || '');
      const initCat = initialData.category || 'Hệ thống';
      setCategory(initCat);
      const isCustom = !DEFAULT_CATEGORIES.includes(initCat);
      setIsCustomCategory(isCustom);
      setCustomCategory(isCustom ? initCat : '');
      setNote(initialData.note || '');
      setFavorite(!!initialData.favorite);
      setStt(initialData.stt ?? '');
    } else {
      setHangMuc('');
      setLink('');
      setCategory('Hệ thống');
      setIsCustomCategory(false);
      setCustomCategory('');
      setNote('');
      setFavorite(false);
      setStt('');
    }
    setErrors({});
  }, [initialData, isOpen]);

  const formatUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const validate = () => {
    const errs: { hangMuc?: string; link?: string } = {};
    if (!hangMuc.trim()) {
      errs.hangMuc = 'Vui lòng nhập tên hạng mục / hệ thống';
    }
    const formattedUrl = formatUrl(link);
    if (formattedUrl) {
      try {
        const parsed = new URL(formattedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase()) || !parsed.hostname.includes('.')) {
          errs.link = 'Đường dẫn không hợp lệ. Vui lòng nhập định dạng tên miền (vd: domain.com hoặc https://domain.com)';
        }
      } catch (_) {
        errs.link = 'Đường dẫn không hợp lệ. Vui lòng kiểm tra lại';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      const formattedLink = formatUrl(link);
      await onSave({
        hangMuc: hangMuc.trim(),
        link: formattedLink,
        category: category.trim() || 'Chung',
        note: note.trim(),
        favorite,
        stt: stt !== '' ? Number(stt) : null,
      });
      toast.success(initialData ? 'Cập nhật liên kết thành công!' : 'Thêm liên kết mới thành công!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu liên kết');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Chỉnh sửa liên kết' : 'Thêm liên kết làm việc'}
      description="Lưu trữ shortcut các hệ thống, tài liệu hoặc sheet làm việc thường dùng"
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
            Tên Hạng mục / Công cụ <span className="text-[#ff3b30] font-bold ml-0.5">*</span>
          </label>
          <Input
            placeholder="vd: SAP, POS Bán Hàng, Báo Date Thiên Lương..."
            value={hangMuc}
            onChange={(e) => {
              setHangMuc(e.target.value);
              if (errors.hangMuc) setErrors((prev) => ({ ...prev, hangMuc: undefined }));
            }}
            error={errors.hangMuc}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
            Đường dẫn (URL)
          </label>
          <div className="relative">
            <Input
              placeholder="https://... hoặc tên miền (vd: google.com)"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                if (errors.link) setErrors((prev) => ({ ...prev, link: undefined }));
              }}
              onBlur={() => {
                if (link.trim()) {
                  setLink(formatUrl(link));
                }
              }}
              error={errors.link}
              leftIcon={<SFLink size={16} className="text-slate-400" />}
            />
          </div>
          {!link.trim() && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <SFExclamationmarkCircle size={14} className="inline" /> Để trống sẽ hiển thị trạng thái "Missing link"
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
              Phân nhóm
            </label>
            <div className="relative">
              <select
                className="w-full text-sm rounded-xl border border-[#e0e0e0] dark:border-white/15 bg-white dark:bg-[#1d1d1f] px-3.5 py-2.5 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] transition-all cursor-pointer font-medium appearance-none pr-9"
                value={isCustomCategory ? '__CUSTOM__' : category}
                onChange={(e) => {
                  if (e.target.value === '__CUSTOM__') {
                    setIsCustomCategory(true);
                    setCategory(customCategory || '');
                  } else {
                    setIsCustomCategory(false);
                    setCategory(e.target.value);
                  }
                }}
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Nhập nhóm mới...</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868b]">
                <SFChevronDown size={14} />
              </div>
            </div>

            {isCustomCategory && (
              <input
                type="text"
                autoFocus
                placeholder="Nhập tên phân nhóm mới..."
                className="mt-2 w-full text-sm rounded-xl border border-[#0071e3] bg-white dark:bg-[#1d1d1f] px-3.5 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 transition-all font-medium"
                value={customCategory}
                onChange={(e) => {
                  setCustomCategory(e.target.value);
                  setCategory(e.target.value);
                }}
              />
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
              Thứ tự (STT)
            </label>
            <Input
              type="number"
              placeholder="Tự động"
              value={stt}
              onChange={(e) => setStt(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
            Ghi chú / Hướng dẫn
          </label>
          <textarea
            rows={3}
            className="w-full text-sm rounded-xl border border-[#e0e0e0] dark:border-white/15 bg-white dark:bg-[#1d1d1f] p-3 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] resize-none transition-all placeholder:text-[#86868b]"
            placeholder="Ghi chú về cách dùng, chu kỳ báo cáo, hoặc người phụ trách..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-[#f5f5f7] dark:bg-white/5 cursor-pointer hover:bg-[#e8e8ed] dark:hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
              className="rounded accent-[#0071e3] text-[#0071e3] w-4 h-4 cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:ring-offset-0 ring-0 shadow-none"
            />
            <div className="flex items-center gap-2">
              {favorite ? <SFStarFill size={16} className="text-amber-500" /> : <SFStar size={16} className="text-[#86868b]" />}
              <span className="text-xs font-medium text-[#1d1d1f] dark:text-white">
                Đánh dấu liên kết yêu thích (Ghim lên đầu Dashboard)
              </span>
            </div>
          </label>
        </div>

        <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 flex items-center justify-end gap-2.5">
          <Button type="button" variant="glass" size="sm" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="glassProminent" size="sm" loading={saving}>
            {initialData ? 'Lưu thay đổi' : 'Tạo liên kết'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
