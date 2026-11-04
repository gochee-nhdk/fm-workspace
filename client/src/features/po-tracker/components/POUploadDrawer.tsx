import React, { useState, useRef } from 'react';
import { POExtractedData, POTrackerPO } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  SFArrowUpDocumentFill,
  SFFolderFill,
  SFCheckmarkCircleFill,
  SFPencil,
  SFPlus,
  SFTrash,
  SFDocument
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface POUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (po: POTrackerPO) => void;
}

type Step = 'upload' | 'reading' | 'confirm';

interface ItemRow {
  item_code: string;
  item_name: string;
  unit: string;
  ordered_qty: number;
  unit_price: number;
  total_price: number;
  warehouse: string;
}

export const POUploadDrawer: React.FC<POUploadDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { folders, activeFolderId, addPOToList } = usePOTrackerStore();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [folderId, setFolderId] = useState<string>(activeFolderId && activeFolderId !== 'unassigned' ? activeFolderId : '');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [totalValue, setTotalValue] = useState<number>(0);
  const [currency, setCurrency] = useState('VND');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setStep('upload');
    setFile(null);
    setPoNumber('');
    setPoDate('');
    setExpectedDate('');
    setSupplierCode('');
    setSupplierName('');
    setWarehouse('');
    setTotalValue(0);
    setCurrency('VND');
    setNotes('');
    setItems([]);
    setSaving(false);
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Vui lòng chỉ chọn tệp định dạng PDF.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Kích thước file PDF không được vượt quá 10MB.');
      return;
    }

    setFile(selectedFile);
    setStep('reading');

    try {
      const res = await poTrackerService.uploadPdf(selectedFile);
      const data: POExtractedData = res.data.data;

      // Auto-populate form
      setPoNumber(data.po_number || '');
      setPoDate(data.po_date || new Date().toISOString().split('T')[0]);
      setExpectedDate(data.expected_delivery_date || '');
      setSupplierCode(data.supplier_code || '');
      setSupplierName(data.supplier_name || '');
      setWarehouse(data.warehouse || '');
      setTotalValue(data.total_value || 0);
      setCurrency(data.currency || 'VND');
      setNotes(data.notes || '');

      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((it) => ({
            item_code: it.item_code || '',
            item_name: it.item_name || 'Hàng hóa',
            unit: it.unit || 'thùng',
            ordered_qty: Number(it.ordered_qty || 1),
            unit_price: Number(it.unit_price || 0),
            total_price: Number(it.total_price || (Number(it.ordered_qty || 1) * Number(it.unit_price || 0))),
            warehouse: it.warehouse || data.warehouse || '',
          }))
        );
      } else {
        setItems([]);
      }

      setStep('confirm');
      toast.success('Đã đọc thông tin PO thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể trích xuất tự động qua AI. Bạn có thể tự điền thông tin.');
      setStep('confirm');
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        item_code: '',
        item_name: '',
        unit: 'thùng',
        ordered_qty: 1,
        unit_price: 0,
        total_price: 0,
        warehouse: warehouse || '',
      },
    ]);
  };

  const handleUpdateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[index], ...patch };
      if (patch.ordered_qty !== undefined || patch.unit_price !== undefined) {
        current.total_price = Number(current.ordered_qty || 0) * Number(current.unit_price || 0);
      }
      next[index] = current;
      const sum = next.reduce((s, it) => s + (it.total_price || 0), 0);
      if (sum > 0) setTotalValue(sum);
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim() && !supplierName.trim()) {
      toast.error('Vui lòng nhập Số PO hoặc Tên Nhà cung cấp.');
      return;
    }

    setSaving(true);
    try {
      const res = await poTrackerService.createPO({
        folder_id: folderId || null,
        po_number: poNumber.trim() || undefined,
        po_date: poDate || undefined,
        expected_delivery_date: expectedDate || undefined,
        supplier_code: supplierCode.trim() || undefined,
        supplier_name: supplierName.trim() || undefined,
        warehouse: warehouse.trim() || undefined,
        total_value: Number(totalValue) || 0,
        currency,
        notes: notes.trim() || undefined,
        pdf_file_name: file?.name || undefined,
        items: items as any,
      });

      const saved = res.data.data;
      addPOToList(saved);
      toast.success('Đã lưu và bắt đầu theo dõi đơn hàng!');
      onSuccess(saved);
      onClose();
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu đơn hàng PO.');
    } finally {
      setSaving(false);
    }
  };

  const drawerTitle =
    step === 'confirm' ? 'Xác nhận thông tin đơn hàng' : 'Tải lên đơn hàng (PO)';
  const drawerDesc =
    step === 'upload'
      ? 'Chọn file PDF để hệ thống tự động bóc tách số liệu PO'
      : step === 'reading'
      ? 'Trí tuệ nhân tạo đang phân tích tài liệu PDF...'
      : 'Kiểm tra và hiệu chỉnh lại dữ liệu trước khi lưu vào danh mục theo dõi';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => {
        if (!saving) {
          onClose();
          resetForm();
        }
      }}
      title={drawerTitle}
      description={drawerDesc}
      width="lg"
    >
      <div className="space-y-5 font-sans">
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Apple Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileSelected(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 select-none',
                isDragging
                  ? 'border-[#0088FF] bg-[#0088FF]/10 scale-[0.99]'
                  : 'border-black/15 dark:border-white/15 hover:border-[#0088FF] bg-black/[0.01] dark:bg-white/[0.02]'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-[#0088FF]/10 text-[#0088FF] flex items-center justify-center text-2xl mb-3 shadow-xs">
                <SFArrowUpDocumentFill size={28} />
              </div>
              <p className="text-[16px] font-bold text-[#1d1d1f] dark:text-white">
                Kéo thả file PDF PO vào đây
              </p>
              <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] mt-1.5 max-w-sm">
                Hoặc nhấp chuột để chọn file PDF từ thiết bị (Hỗ trợ file PDF đơn hàng, hóa đơn, tối đa 10MB)
              </p>
              <div className="mt-4 px-3.5 py-1.5 rounded-full bg-[#0088FF]/10 text-[#0088FF] dark:text-[#0091FF] text-[12px] font-semibold flex items-center gap-1.5">
                <SFCheckmarkCircleFill size={13} />
                <span>Tự động nhận diện: Số PO, Ngày giao, Nhà cung cấp, Hàng hóa, Kho nhận</span>
              </div>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-black/10 dark:border-white/10" />
              <span className="flex-shrink mx-4 text-[11px] text-[#86868b] uppercase font-bold tracking-wider">
                Hoặc
              </span>
              <div className="flex-grow border-t border-black/10 dark:border-white/10" />
            </div>

            <Button
              variant="outline"
              onClick={() => setStep('confirm')}
              className="w-full h-11 rounded-2xl text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 gap-2"
            >
              <SFPencil size={14} />
              <span>Nhập thông tin thủ công</span>
            </Button>
          </div>
        )}

        {step === 'reading' && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-[#0088FF]/20" />
              <div className="absolute inset-0 rounded-full border-4 border-[#0088FF] border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-[#0088FF]">
                <SFDocument size={24} />
              </div>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1d1d1f] dark:text-white">
                Trí tuệ nhân tạo đang quét nội dung PDF...
              </h3>
              <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] mt-1.5 max-w-sm">
                Đang trích xuất số PO, nhà cung cấp, ngày giao hẹn và danh sách các mặt hàng...
              </p>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <form id="po-confirm-form" onSubmit={handleSavePO} className="space-y-4 text-left">
            {file && (
              <div className="p-3 px-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2 truncate">
                  <SFDocument size={16} className="text-[#0088FF] shrink-0" />
                  <span className="truncate font-semibold text-blue-900 dark:text-blue-300">
                    {file.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-[#0088FF] hover:underline font-semibold text-[12px] shrink-0 ml-3 cursor-pointer"
                >
                  Đổi file khác
                </button>
              </div>
            )}

            {/* Folder select */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Nhóm lưu trữ (Folder)
              </label>
              <div className="relative">
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13.5px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all cursor-pointer"
                >
                  <option value="">(Chưa phân nhóm)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Số PO <span className="text-red-500">*</span>
                </label>
                <input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="VD: PO-20261105-01"
                  className="w-full h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Ngày lập PO
                </label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-between">
                  <span>Hạn giao hàng (Dự kiến)</span>
                  <span className="text-[11px] text-[#0088FF] font-semibold">Nhắc nhở tự động</span>
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[13.5px] font-bold text-[#0088FF] dark:text-[#0091FF] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Kho tiếp nhận
                </label>
                <input
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  placeholder="VD: Kho Tổng Tân Bình, Kho Q7..."
                  className="w-full h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13.5px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Tên Nhà cung cấp
                </label>
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="VD: Công ty Cổ phần Vinamilk..."
                  className="w-full h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13.5px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Mã NCC
                </label>
                <input
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  placeholder="VNM-01"
                  className="w-full h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13.5px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                />
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Danh sách hàng hóa ({items.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[12.5px] font-bold text-[#0088FF] dark:text-[#0091FF] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <SFPlus size={12} />
                  <span>Thêm dòng</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-none">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-2.5 text-[12.5px]"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={it.item_name}
                        onChange={(e) => handleUpdateItem(idx, { item_name: e.target.value })}
                        placeholder="Tên sản phẩm..."
                        className="flex-1 h-8 px-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 font-semibold text-[#1d1d1f] dark:text-white"
                      />
                      <input
                        value={it.item_code}
                        onChange={(e) => handleUpdateItem(idx, { item_code: e.target.value })}
                        placeholder="Mã SKU"
                        className="w-28 h-8 px-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-[#555558] dark:text-[#a1a1a6] font-mono text-[11.5px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                        title="Xóa dòng"
                      >
                        <SFTrash size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#86868b] text-[11px] font-semibold">SL:</span>
                        <input
                          type="number"
                          min="0"
                          value={it.ordered_qty}
                          onChange={(e) => handleUpdateItem(idx, { ordered_qty: Number(e.target.value) })}
                          className="w-full h-8 px-2 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 tabular-nums font-bold text-[#1d1d1f] dark:text-white"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[#86868b] text-[11px] font-semibold">ĐVT:</span>
                        <input
                          value={it.unit}
                          onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                          placeholder="thùng"
                          className="w-full h-8 px-2 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 font-medium text-[#1d1d1f] dark:text-white"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[#86868b] text-[11px] font-semibold">Đơn giá:</span>
                        <input
                          type="number"
                          min="0"
                          value={it.unit_price}
                          onChange={(e) => handleUpdateItem(idx, { unit_price: Number(e.target.value) })}
                          className="w-full h-8 px-2 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 tabular-nums font-medium text-[#1d1d1f] dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ghi chú */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Ghi chú điều phối giao nhận
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú về tiến độ, tài xế, yêu cầu kiểm hàng..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 flex gap-3 border-t border-black/[0.06] dark:border-white/10">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={saving}
                className="h-11 px-5 rounded-full border border-black/15 dark:border-white/15 text-[13px] font-semibold text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-11 rounded-full fm-primary-pill-surface text-[13.5px] font-bold text-white shadow-md hover:opacity-90 transition-all cursor-pointer disabled:opacity-40"
              >
                {saving ? 'Đang lưu vào hệ thống...' : 'Hoàn tất & Bắt đầu theo dõi PO'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Drawer>
  );
};
