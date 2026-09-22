import React, { useState, useEffect } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StoreItem } from '@/types/workspace';
import { MapPin, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

interface StoreDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<StoreItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: StoreItem | null;
}

export const StoreDrawerForm: React.FC<StoreDrawerFormProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [storeCode, setStoreCode] = useState('');
  const [address, setAddress] = useState('');
  const [googleMaps, setGoogleMaps] = useState('');
  const [type, setType] = useState('Standard');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ storeCode?: string; address?: string }>({});

  useEffect(() => {
    if (initialData) {
      setStoreCode(initialData.storeCode || '');
      setAddress(initialData.address || '');
      setGoogleMaps(initialData.googleMaps || '');
      setType(initialData.type || 'Standard');
    } else {
      setStoreCode('');
      setAddress('');
      setGoogleMaps('');
      setType('Standard');
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const errs: { storeCode?: string; address?: string } = {};
    if (!storeCode.trim()) {
      errs.storeCode = 'Vui lòng nhập mã cửa hàng (vd: FM09)';
    }
    if (!address.trim()) {
      errs.address = 'Vui lòng nhập địa chỉ cửa hàng';
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
        storeCode: storeCode.trim().toUpperCase(),
        address: address.trim(),
        googleMaps: googleMaps.trim(),
        type: type.trim() || 'Standard',
      });
      toast.success(initialData ? 'Cập nhật cửa hàng thành công!' : 'Thêm cửa hàng mới thành công!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu cửa hàng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Chỉnh sửa cửa hàng' : 'Thêm cửa hàng mới'}
      description="Quản lý mã cửa hàng, địa chỉ và định vị Google Maps"
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Mã Cửa Hàng <span className="text-rose-500">*</span>
          </label>
          <Input
            placeholder="vd: FM01, FM09, FM-DISTRICT7..."
            value={storeCode}
            onChange={(e) => {
              setStoreCode(e.target.value.toUpperCase());
              if (errors.storeCode) setErrors((prev) => ({ ...prev, storeCode: undefined }));
            }}
            error={errors.storeCode}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Địa chỉ chi tiết <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            className="w-full text-sm rounded-xl border border-[#e0e0e0] dark:border-white/15 bg-white dark:bg-[#1d1d1f] p-3 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] resize-none transition-all placeholder:text-[#86868b]"
            placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
            }}
          />
          {errors.address && <p className="mt-1 text-xs text-rose-500">{errors.address}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Link Google Maps
          </label>
          <Input
            placeholder="https://maps.app.goo.gl/... hoặc https://google.com/maps/..."
            value={googleMaps}
            onChange={(e) => setGoogleMaps(e.target.value)}
            leftIcon={<Navigation className="w-4 h-4 text-[#86868b]" />}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider mb-1.5">
            Phân loại Cửa Hàng
          </label>
          <select
            className="w-full text-sm rounded-xl border border-[#e0e0e0] dark:border-white/15 bg-white dark:bg-[#1d1d1f] pl-3.5 pr-9 py-2.5 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] transition-all cursor-pointer"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="Standard">Standard (Cửa hàng tiêu chuẩn)</option>
            <option value="Express">Express (Cửa hàng tiện lợi / quy mô nhỏ)</option>
            <option value="Flagship">Flagship (Cửa hàng trọng điểm)</option>
            <option value="Hub">Hub / Kho trung chuyển (DC)</option>
          </select>
        </div>

        <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 flex items-center justify-end gap-2.5">
          <Button type="button" variant="glass" size="sm" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="glassProminent" size="sm" loading={saving} icon={<MapPin className="w-4 h-4" />}>
            {initialData ? 'Lưu thay đổi' : 'Thêm cửa hàng'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
