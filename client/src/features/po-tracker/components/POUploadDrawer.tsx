import React, { useState, useRef } from 'react';
import { POFolderItem, POExtractedData, POTrackerPO } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { Button } from '@/components/ui/button';
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
      toast.success('Đã đọc thông tin PO qua AI thành công!');
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
        unit: 'cái',
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
      // Re-sum total value
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
      toast.success('Đã lưu và bắt đầu tracking PO thành công!');
      onSuccess(saved);
      onClose();
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu đơn hàng PO.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm liquid-backdrop-enter"
        onClick={() => {
          if (!saving) {
            onClose();
            resetForm();
          }
        }}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-[201] w-full max-w-[620px] apple-drawer-enter flex flex-col">
        <div className="vision-glass-sidebar h-full flex flex-col shadow-2xl border-l border-black/[0.08] dark:border-white/10 bg-white/95 dark:bg-[#16161a]/95 backdrop-blur-2xl">
          {/* Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#0088FF]/10 text-[#0088FF] dark:text-[#0091FF] flex items-center justify-center font-bold text-sm">
                📄
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-white leading-tight">
                  {step === 'confirm' ? 'Xác nhận thông tin PO' : 'Thêm PO vào hệ thống'}
                </h2>
                <p className="text-[11px] text-[#76767b] dark:text-[#8e8e93]">
                  {step === 'upload' && 'Tải file PDF hóa đơn/PO để AI tự động trích xuất'}
                  {step === 'reading' && 'Trí tuệ nhân tạo Gemini đang quét nội dung...'}
                  {step === 'confirm' && 'Kiểm tra và hiệu chỉnh lại dữ liệu trước khi lưu'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {step === 'upload' && (
              <div className="space-y-4">
                {/* Drag & Drop Box */}
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
                    'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 select-none',
                    isDragging
                      ? 'border-[#0088FF] bg-[#0088FF]/5 scale-[0.99]'
                      : 'border-black/15 dark:border-white/15 hover:border-[#0088FF]/50 hover:bg-black/[0.01] dark:hover:bg-white/[0.02]'
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
                  <div className="w-14 h-14 rounded-2xl bg-[#0088FF]/10 text-[#0088FF] flex items-center justify-center text-2xl mb-3 shadow-xs">
                    📁
                  </div>
                  <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">
                    Kéo & thả file PDF PO vào đây
                  </p>
                  <p className="text-[12px] text-[#76767b] dark:text-[#8e8e93] mt-1 max-w-[280px]">
                    Hoặc bấm để chọn file từ máy tính (hỗ trợ file PDF scan, PO đặt hàng, tối đa 10MB)
                  </p>
                  <div className="mt-4 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 text-[11px] font-medium text-[#0088FF] dark:text-[#0091FF]">
                    ⚡ Tự động đọc: Số PO, Ngày giao, NCC, Hàng hóa, Kho
                  </div>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-black/10 dark:border-white/10" />
                  <span className="flex-shrink mx-4 text-[11px] text-[#999] uppercase font-semibold">Hoặc</span>
                  <div className="flex-grow border-t border-black/10 dark:border-white/10" />
                </div>

                <Button
                  variant="outline"
                  onClick={() => setStep('confirm')}
                  className="w-full h-11 rounded-xl text-[13px] font-medium"
                >
                  ✍️ Nhập thủ công không dùng file PDF
                </Button>
              </div>
            )}

            {step === 'reading' && (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-[#0088FF]/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-[#0088FF] border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-xl">
                    🤖
                  </div>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] dark:text-white">
                    Gemini AI đang đọc tài liệu PO...
                  </h3>
                  <p className="text-[12px] text-[#76767b] dark:text-[#8e8e93] mt-1 max-w-[320px]">
                    Đang bóc tách số PO, đối tác cung cấp, ngày giao hẹn, danh sách mặt hàng & kho nhận...
                  </p>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <form id="po-confirm-form" onSubmit={handleSavePO} className="space-y-4">
                {file && (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 flex items-center justify-between text-[12px]">
                    <span className="truncate text-blue-700 dark:text-blue-300 font-medium">
                      📎 {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      className="text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
                    >
                      Đổi file
                    </button>
                  </div>
                )}

                {/* Chọn Folder / Nhóm */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                    Nhóm lưu trữ (Folder)
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30"
                  >
                    <option value="">(Chưa phân nhóm)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grid Header Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Số PO <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="PO-20261105-01"
                      className="w-full h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Ngày lập PO
                    </label>
                    <input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Ngày giao dự kiến (Hạn giao) 🔔
                    </label>
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 font-semibold text-[#0088FF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Kho nhận hàng
                    </label>
                    <input
                      value={warehouse}
                      onChange={(e) => setWarehouse(e.target.value)}
                      placeholder="Kho Tổng / Kho HCM..."
                      className="w-full h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Tên Nhà cung cấp
                    </label>
                    <input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Công ty Cổ phần..."
                      className="w-full h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Mã NCC
                    </label>
                    <input
                      value={supplierCode}
                      onChange={(e) => setSupplierCode(e.target.value)}
                      placeholder="NCC-01"
                      className="w-full h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30"
                    />
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Danh sách mặt hàng ({items.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[12px] font-medium text-[#0088FF] hover:underline cursor-pointer"
                    >
                      + Thêm dòng
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] space-y-2 text-[12px]"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            value={it.item_name}
                            onChange={(e) => handleUpdateItem(idx, { item_name: e.target.value })}
                            placeholder="Tên sản phẩm..."
                            className="flex-1 h-7 px-2 rounded-lg bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 font-medium"
                          />
                          <input
                            value={it.item_code}
                            onChange={(e) => handleUpdateItem(idx, { item_code: e.target.value })}
                            placeholder="Mã SKU"
                            className="w-24 h-7 px-2 rounded-lg bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[#999] text-[10px]">SL:</span>
                            <input
                              type="number"
                              min="0"
                              value={it.ordered_qty}
                              onChange={(e) => handleUpdateItem(idx, { ordered_qty: Number(e.target.value) })}
                              className="w-full h-7 px-2 rounded-lg bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[#999] text-[10px]">ĐVT:</span>
                            <input
                              value={it.unit}
                              onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                              placeholder="thùng"
                              className="w-full h-7 px-2 rounded-lg bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[#999] text-[10px]">Đơn giá:</span>
                            <input
                              type="number"
                              min="0"
                              value={it.unit_price}
                              onChange={(e) => handleUpdateItem(idx, { unit_price: Number(e.target.value) })}
                              className="w-full h-7 px-2 rounded-lg bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ghi chú */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                    Ghi chú
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú về tiến độ, tài xế, yêu cầu kiểm hàng..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 resize-none"
                  />
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          {step === 'confirm' && (
            <div className="p-4 px-6 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3 shrink-0 bg-white/50 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={saving}
                className="h-10 px-4 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="submit"
                form="po-confirm-form"
                disabled={saving}
                className="flex-1 h-10 rounded-full fm-primary-pill-surface text-[13px] font-semibold text-white shadow-md hover:opacity-90 transition-all cursor-pointer disabled:opacity-40"
              >
                {saving ? 'Đang lưu vào hệ thống...' : 'Hoàn tất & Bắt đầu Tracking PO'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
