import React, { useState, useEffect } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { StoreItem } from '@/types/workspace';
import { SFMappinAndEllipse, SFLocationFill, SFArrowUpRightSquare } from 'sf-symbols-lib';
import { AppleListbox } from '@/components/ui/AppleListbox';
import { getMapEmbedUrl } from '@/components/ui/MapPreviewModal';
import { dataService } from '@/services/dataService';
import toast from 'react-hot-toast';

interface StoreDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<StoreItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: StoreItem | null;
}

const STORE_TYPE_OPTIONS = [
  { value: 'Standard', label: 'Standard (Cửa hàng tiêu chuẩn)' },
  { value: 'Express', label: 'Express (Cửa hàng tiện lợi / quy mô nhỏ)' },
  { value: 'Flagship', label: 'Flagship (Cửa hàng trọng điểm)' },
  { value: 'Hub', label: 'Hub / Kho trung chuyển (DC)' },
];

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
  const [showMapPreview, setShowMapPreview] = useState(false);
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
      const targetCode = storeCode.trim().toUpperCase();

      // Kiểm tra trùng mã cửa hàng (ngoại trừ chính nó nếu đang chỉnh sửa)
      const existingStores = await dataService.getStores();
      const isDuplicate = existingStores.some(
        (s) => s.id !== initialData?.id && s.storeCode?.trim().toUpperCase() === targetCode
      );

      if (isDuplicate) {
        setErrors((prev) => ({
          ...prev,
          storeCode: `Mã cửa hàng "${targetCode}" đã tồn tại trên hệ thống`,
        }));
        toast.error(`Mã cửa hàng "${targetCode}" đã tồn tại!`);
        setSaving(false);
        return;
      }

      await onSave({
        storeCode: targetCode,
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
          <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight mb-1.5">
            Mã Cửa Hàng <span className="text-[#FF383C] font-bold ml-0.5">*</span>
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
          <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight mb-1.5">
            Địa chỉ chi tiết <span className="text-[#FF383C] font-bold ml-0.5">*</span>
          </label>
          <textarea
            rows={3}
            className={cn(
              'w-full text-[13px] rounded-xl border border-black/10 dark:border-white/12 bg-white/85 dark:bg-[#1c1c22]/85 backdrop-blur-xl p-3 text-[#1d1d1f] dark:text-white hover:border-black/20 dark:hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-[#0088FF]/35 dark:focus:ring-[#0091FF]/45 focus:border-[#0088FF] dark:focus:border-[#0091FF] focus:shadow-[0_0_14px_rgba(0,136,255,0.25)] dark:focus:shadow-[0_0_18px_rgba(0,145,255,0.32)] resize-none transition-all duration-200 ease-spring placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6] shadow-2xs',
              errors.address ? 'border-[#FF383C] dark:border-[#FF4245] focus:ring-[#FF383C]/35 focus:border-[#FF383C] focus:shadow-[0_0_14px_rgba(255,56,60,0.25)]' : ''
            )}
            placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
            }}
          />
          {errors.address && <p className="mt-1 text-[11px] text-[#FF383C] dark:text-[#FF4245] font-medium">{errors.address}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight mb-1.5">
            Link Google Maps
          </label>
          <Input
            placeholder="https://maps.app.goo.gl/... hoặc https://google.com/maps/..."
            value={googleMaps}
            onChange={(e) => setGoogleMaps(e.target.value)}
            leftIcon={<SFLocationFill size={16} />}
          />

          {/* Live Map Preview Toggle */}
          {(address.trim() || googleMaps.trim()) && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setShowMapPreview((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0088FF] dark:text-[#0091FF] hover:underline active:scale-95 transition-all duration-180 ease-spring cursor-pointer"
              >
                <SFMappinAndEllipse size={14} />
                <span>{showMapPreview ? 'Ẩn bản đồ xem trước' : 'Xem trước vị trí trên Google Maps'}</span>
              </button>

              {showMapPreview && (
                <div className="mt-2.5 rounded-2xl overflow-hidden border border-black/10 dark:border-white/15 h-56 bg-black/5 dark:bg-white/5 relative shadow-sm">
                  <iframe
                    title="Xem trước bản đồ cửa hàng"
                    src={getMapEmbedUrl(address, googleMaps, storeCode).url}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <AppleListbox
          label="Phân loại Cửa Hàng"
          headerTitle="Loại hình cơ sở"
          value={type}
          onChange={(newVal) => setType(newVal)}
          options={STORE_TYPE_OPTIONS}
        />

        <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 flex items-center justify-end gap-2.5">
          <Button type="button" variant="glass" size="sm" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="glassProminent" size="sm" loading={saving} icon={<SFMappinAndEllipse size={16} />}>
            {initialData ? 'Lưu thay đổi' : 'Thêm cửa hàng'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
