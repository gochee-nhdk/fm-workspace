import React, { useState, useEffect } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AccountItem } from '@/types/workspace';
import { Eye, EyeOff, ShieldCheck, Lock, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface AccountDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AccountItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: AccountItem | null;
}

export const AccountDrawerForm: React.FC<AccountDrawerFormProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [software, setSoftware] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [stt, setStt] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ software?: string; username?: string }>({});

  useEffect(() => {
    if (initialData) {
      setSoftware(initialData.software || '');
      setUsername(initialData.username || '');
      setPassword(initialData.password || '');
      setLink(initialData.link || '');
      setNote(initialData.note || '');
      setStt(initialData.stt ?? '');
    } else {
      setSoftware('');
      setUsername('');
      setPassword('');
      setLink('');
      setNote('');
      setStt('');
    }
    setShowPassword(false);
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const errs: { software?: string; username?: string } = {};
    if (!software.trim()) {
      errs.software = 'Vui lòng nhập tên phần mềm / dịch vụ';
    }
    if (!username.trim()) {
      errs.username = 'Vui lòng nhập tên đăng nhập hoặc email';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      await onSave({
        software: software.trim(),
        username: username.trim(),
        password: password.trim(),
        link: link.trim(),
        note: note.trim(),
        stt: stt !== '' ? Number(stt) : null,
      });
      toast.success(initialData ? 'Cập nhật tài khoản thành công!' : 'Thêm tài khoản mới thành công!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu tài khoản');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
      description="Lưu trữ thông tin đăng nhập các phần mềm nội bộ và dịch vụ"
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Subtle security notice */}
        <div className="p-3.5 bg-[#f5f5f7] dark:bg-white/5 rounded-[14px] border border-[#e0e0e0] dark:border-white/10 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            <span className="font-semibold text-[#1d1d1f] dark:text-white">Private Vault:</span> Thông tin được lưu trữ nội bộ trong trình duyệt này. Không gửi ra ngoài hoặc lưu vào máy chủ công cộng.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Phần mềm / Hệ thống <span className="text-rose-500">*</span>
          </label>
          <Input
            placeholder="vd: SAP, POS, DMS, Bravo, Gmail, Nội bộ..."
            value={software}
            onChange={(e) => {
              setSoftware(e.target.value);
              if (errors.software) setErrors((prev) => ({ ...prev, software: undefined }));
            }}
            error={errors.software}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Tên đăng nhập / Email / ID <span className="text-rose-500">*</span>
          </label>
          <Input
            placeholder="user@farmersmarket.vn hoặc username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
            }}
            error={errors.username}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu..."
              className="w-full text-sm rounded-xl border border-[#e0e0e0] dark:border-white/15 bg-white dark:bg-[#1d1d1f] pl-9 pr-10 py-2.5 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] font-mono transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Lock className="w-4 h-4 text-[#86868b] absolute left-3 top-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Đường dẫn đăng nhập (URL)
          </label>
          <Input
            placeholder="https://..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            leftIcon={<Globe className="w-4 h-4 text-[#86868b]" />}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Thứ tự (STT)
          </label>
          <Input
            type="number"
            placeholder="Tự động"
            value={stt}
            onChange={(e) => setStt(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Ghi chú
          </label>
          <textarea
            rows={2}
            className="w-full text-sm rounded-xl border border-[#e0e0e0] dark:border-white/15 bg-white dark:bg-[#1d1d1f] p-3 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] resize-none transition-all placeholder:text-[#86868b]"
            placeholder="Ghi chú phân quyền, tài khoản chung hay cá nhân..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 flex items-center justify-end gap-2.5">
          <Button type="button" variant="glass" size="sm" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="glassProminent" size="sm" loading={saving}>
            {initialData ? 'Lưu thay đổi' : 'Lưu tài khoản'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
