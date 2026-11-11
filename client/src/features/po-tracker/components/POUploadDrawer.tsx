import React, { useState, useRef, useMemo, useEffect } from 'react';
import { POExtractedData, POTrackerPO } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService, extractMetadataFromFileName } from '@/services/poTrackerService';
import { dataService } from '@/services/dataService';
import { useNoteStore } from '@/stores/note-store';
import { StoreItem } from '@/types/workspace';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import {
  SFArrowUpDocumentFill,
  SFFolderFill,
  SFCheckmarkCircleFill,
  SFPencil,
  SFPlus,
  SFTrash,
  SFDocument,
  SFEye,
  SFDocumentOnDocument,
  SFXmark,
  SFCalendar,
  SFExclamationmarkTriangleFill,
  SFEnvelope,
  SFShippingbox
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

const formatVND = (num: number) => {
  if (isNaN(num) || num === null || num === undefined) return '0 ₫';
  return Math.round(num || 0).toLocaleString('vi-VN') + ' ₫';
};

const getRelativeDateStr = (daysAhead: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

export const POUploadDrawer: React.FC<POUploadDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { folders, activeFolderId, addPOToList, pos, updatePOInList } = usePOTrackerStore();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [splitView, setSplitView] = useState(true);
  const [showMailModal, setShowMailModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<POTrackerPO | null>(null);
  const [stores, setStores] = useState<StoreItem[]>([]);
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
  const savingRef = useRef(false);
  const [readingStatus, setReadingStatus] = useState('Đang khởi động phân tích chứng từ...');
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);

  // Quick text/Excel bulk import modal
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Fetch 13 stores for warehouse combobox
  useEffect(() => {
    if (isOpen) {
      dataService.getStores().then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setStores(res);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  // Manage file preview URL
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setFilePreviewUrl(null);
    }
  }, [file]);

  // Sync folderId when drawer opens
  useEffect(() => {
    if (isOpen && activeFolderId && activeFolderId !== 'unassigned') {
      setFolderId(activeFolderId);
    }
  }, [isOpen, activeFolderId]);

  // Calculated totals for summary bar
  const totalItemCount = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.ordered_qty) || 0), 0);
  }, [items]);

  const calculatedTotalAmount = useMemo(() => {
    return items.reduce((acc, it) => {
      const line = Number(it.total_price) || (Number(it.ordered_qty || 0) * Number(it.unit_price || 0));
      return acc + line;
    }, 0);
  }, [items]);

  const resetForm = () => {
    setStep('upload');
    setFile(null);
    setShowDocPreview(false);
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
    const name = selectedFile.name.toLowerCase();
    const isPdf = name.endsWith('.pdf');
    const isImage = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');

    if (!isPdf && !isImage) {
      toast.error('Vui lòng chọn tệp định dạng PDF hoặc hình ảnh (PNG, JPG, WEBP).', { id: 'save-po-toast' });
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('Kích thước tệp không được vượt quá 15MB.', { id: 'save-po-toast' });
      return;
    }

    setFile(selectedFile);
    setStep('reading');
    setReadingStatus(isPdf ? 'Đang trích xuất văn bản số và chuẩn bị hình ảnh PDF...' : 'Đang xử lý hình ảnh chứng từ...');

    try {
      setTimeout(() => {
        setReadingStatus('Mô hình Gemini AI đang quét số PO, nhà cung cấp, kho và bảng hàng hóa...');
      }, 700);

      const res = await poTrackerService.uploadPOFile(selectedFile);
      setReadingStatus('Đang chuẩn hóa dữ liệu và hoàn tất biểu mẫu...');
      const data: POExtractedData = res.data || ({} as any);
      const fileHints = extractMetadataFromFileName(selectedFile.name);

      const finalPoNumber = data.po_number || fileHints.po_number || '';
      const finalWarehouse = data.warehouse || fileHints.warehouse || '';
      const finalSupplierName = data.supplier_name || fileHints.supplier_name || '';

      setPoNumber(finalPoNumber);
      setPoDate(data.po_date || new Date().toISOString().split('T')[0]);
      setExpectedDate(data.expected_delivery_date || '');
      setSupplierCode(data.supplier_code || '');
      setSupplierName(finalSupplierName);
      setWarehouse(finalWarehouse);
      setCurrency(data.currency || 'VND');
      setNotes(data.notes || '');

      if (Array.isArray(data.items) && data.items.length > 0) {
        const mappedItems: ItemRow[] = data.items.map((it) => {
          const qty = Number(it.ordered_qty || 1);
          const price = Number(it.unit_price || 0);
          const lineTotal = Number(it.total_price) || (qty * price);
          return {
            item_code: it.item_code || '',
            item_name: it.item_name || 'Hàng hóa',
            unit: it.unit || 'Gói',
            ordered_qty: qty,
            unit_price: price,
            total_price: lineTotal,
            warehouse: it.warehouse || finalWarehouse || '',
          };
        });

        setItems(mappedItems);
        const sum = mappedItems.reduce((s, it) => s + it.total_price, 0);
        setTotalValue(sum > 0 ? sum : Number(data.total_value || 0));
        toast.success(`Đã nhận diện thành công ${mappedItems.length} mặt hàng từ đơn PO!`, { id: 'save-po-toast' });
      } else {
        setItems([]);
        setTotalValue(Number(data.total_value || 0));
        if (finalPoNumber) {
          toast.success(`Đã nhận diện: ${finalPoNumber}${finalSupplierName ? ` — NCC: ${finalSupplierName}` : ''}`, { id: 'save-po-toast' });
        } else {
          toast('Đã nạp file PO. Bạn có thể kiểm tra và hoàn tất thông tin.', { icon: 'ℹ️', id: 'save-po-toast' });
        }
      }

      setStep('confirm');
    } catch (err: any) {
      console.error(err);
      const fileHints = extractMetadataFromFileName(selectedFile.name);
      if (fileHints.po_number) setPoNumber(fileHints.po_number);
      if (fileHints.warehouse) setWarehouse(fileHints.warehouse);
      if (fileHints.supplier_name) setSupplierName(fileHints.supplier_name);
      setPoDate(new Date().toISOString().split('T')[0]);
      toast.error(err.message || 'Không thể trích xuất tự động qua AI. Bạn có thể kiểm tra và tự điền thông tin.', { id: 'save-po-toast' });
      setStep('confirm');
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_code: '',
        item_name: '',
        unit: 'Gói',
        ordered_qty: 1,
        unit_price: 0,
        total_price: 0,
        warehouse: warehouse || '',
      },
    ]);
  };

  const handleDuplicateItem = (index: number) => {
    setItems((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const copy = { ...target };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    toast.success('Đã nhân bản dòng mặt hàng.');
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
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const sum = next.reduce((s, it) => s + (it.total_price || 0), 0);
      setTotalValue(sum);
      return next;
    });
  };

  // Parse bulk text / Excel copied columns
  const handleProcessBulkPaste = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.trim().split(/\r?\n/);
    const newItems: ItemRow[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      // Split by tab or pipe or comma
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes('|')) cols = line.split('|');
      if (cols.length === 1 && line.includes(';')) cols = line.split(';');

      const name = cols[0]?.trim() || 'Hàng hóa';
      const qty = Number(cols[1]?.replace(/[^\d.]/g, '')) || 1;
      const unit = cols[2]?.trim() || 'Gói';
      const price = Number(cols[3]?.replace(/[^\d.]/g, '')) || 0;
      const sku = cols[4]?.trim() || '';

      newItems.push({
        item_name: name,
        ordered_qty: qty,
        unit: unit,
        unit_price: price,
        total_price: qty * price,
        item_code: sku,
        warehouse: warehouse || '',
      });
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setShowBulkPasteModal(false);
      setBulkText('');
      toast.success(`Đã thêm ${newItems.length} mặt hàng từ văn bản!`);
    } else {
      toast.error('Không tìm thấy dữ liệu hợp lệ để nhập.');
    }
  };

  const handleSavePO = async (e?: React.FormEvent, forceUpdateExistingId?: string) => {
    if (e) e.preventDefault();
    if (savingRef.current || saving) return;

    if (!poNumber.trim() && !supplierName.trim()) {
      toast.error('Vui lòng nhập Số PO hoặc Tên Nhà cung cấp.', { id: 'save-po-toast' });
      return;
    }

    // BUG-015: Validate expectedDate >= poDate
    if (poDate && expectedDate && expectedDate < poDate) {
      toast.error('Ngày giao hàng dự kiến không được trước ngày lập PO.', { id: 'save-po-toast' });
      return;
    }

    // BUG-016: Validate SL > 0 and Đơn giá >= 0
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (Number(it.ordered_qty || 0) <= 0) {
          toast.error(`Số lượng đặt hàng cho "${it.item_name || `Mặt hàng ${i + 1}`}" phải lớn hơn 0.`, { id: 'save-po-toast' });
          return;
        }
        if (Number(it.unit_price || 0) < 0) {
          toast.error(`Đơn giá cho "${it.item_name || `Mặt hàng ${i + 1}`}" không được là số âm.`, { id: 'save-po-toast' });
          return;
        }
      }
    }

    // BUG-007: Check for duplicate po_number
    if (!forceUpdateExistingId && poNumber.trim()) {
      const trimmed = poNumber.trim().toLowerCase();
      const existing = pos.find((p) => p.po_number && p.po_number.trim().toLowerCase() === trimmed);
      if (existing) {
        setDuplicateWarning(existing);
        return;
      }
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const finalTotal = calculatedTotalAmount > 0 ? calculatedTotalAmount : Number(totalValue || 0);
      const payload = {
        folder_id: folderId || null,
        po_number: poNumber.trim() || undefined,
        po_date: poDate || undefined,
        expected_delivery_date: expectedDate || undefined,
        supplier_code: supplierCode.trim() || undefined,
        supplier_name: supplierName.trim() || undefined,
        warehouse: warehouse.trim() || undefined,
        total_value: finalTotal,
        currency,
        notes: notes.trim() || undefined,
        pdf_file_name: file?.name || undefined,
        items: items as any,
      };

      let saved: POTrackerPO;
      if (forceUpdateExistingId) {
        const res = await poTrackerService.updatePO(forceUpdateExistingId, payload);
        saved = (res as any)?.data?.data || (res as any)?.data || res;
        updatePOInList(forceUpdateExistingId, saved);
        toast.success(`Đã cập nhật đè đơn hàng [${poNumber.trim()}] thành công!`, { id: 'save-po-toast' });
      } else {
        const res = await poTrackerService.createPO(payload);
        saved = (res as any)?.data?.data || (res as any)?.data || res;
        if (saved) {
          addPOToList(saved);
        }
        toast.success('Đã lưu và bắt đầu theo dõi đơn hàng PO thành công!', { id: 'save-po-toast' });
      }

      setDuplicateWarning(null);
      onSuccess(saved);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Save PO error:', err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi lưu đơn hàng PO.', { id: 'save-po-toast' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const generateMailDraft = () => {
    const finalPoNum = poNumber.trim() || 'PO-CHUA-CO-MA';
    const finalSupplier = supplierName.trim() || 'Quý Nhà cung cấp';
    const finalTotal = calculatedTotalAmount > 0 ? calculatedTotalAmount : Number(totalValue || 0);

    const subject = `[Xác nhận đơn hàng PO] ${finalPoNum} - Farmers Market gửi ${finalSupplier}`;

    const itemsText = items.length > 0
      ? items.map((it, idx) => `  ${idx + 1}. ${it.item_name} (Mã: ${it.item_code || 'N/A'}) - SL đặt: ${it.ordered_qty} ${it.unit} - Đơn giá: ${formatVND(it.unit_price)} - Thành tiền: ${formatVND(it.total_price)}`).join('\n')
      : '  (Chưa có danh mục mặt hàng chi tiết)';

    const bodyText = `Kính gửi Quý Nhà cung cấp ${finalSupplier},

Công ty TNHH Thương mại Laria (Farmers Market) xin gửi thông tin xác nhận đơn đặt hàng PO:

1. THÔNG TIN CHỨNG TỪ:
- Số hiệu chứng từ PO: ${finalPoNum}
- Ngày lập đơn hàng: ${poDate || 'Chưa cập nhật'}
- Hạn giao hàng dự kiến: ${expectedDate || 'Theo thỏa thuận'}
- Kho tiếp nhận hàng: ${warehouse || 'Kho Farmers Market'}
- Tổng giá trị đơn hàng: ${formatVND(finalTotal)}

2. CHI TIẾT DANH MỤC HÀNG HÓA ĐẶT MUA:
${itemsText}

${notes ? `3. GHI CHÚ ĐIỀU PHỐI:\n${notes}\n\n` : ''}
Kính đề nghị Quý NCC kiểm tra số lượng, phản hồi email này để xác nhận thời gian giao hàng chính xác.

Trân trọng cảm ơn sự hợp tác của Quý đối tác!
Phòng Thu mua / Supply Chain - Farmers Market`;

    const htmlBody = `<h3>[Xác nhận đơn hàng PO] ${finalPoNum} - Farmers Market gửi ${finalSupplier}</h3>
<p>Kính gửi Quý Nhà cung cấp <b>${finalSupplier}</b>,</p>
<p>Farmers Market xin gửi thông tin xác nhận đơn đặt hàng PO chi tiết:</p>
<ul>
  <li><b>Số PO:</b> ${finalPoNum}</li>
  <li><b>Ngày lập đơn:</b> ${poDate || 'Chưa cập nhật'}</li>
  <li><b>Hạn giao hàng dự kiến:</b> ${expectedDate || 'Theo thỏa thuận'}</li>
  <li><b>Kho tiếp nhận hàng:</b> ${warehouse || 'Kho Farmers Market'}</li>
  <li><b>Tổng giá trị đơn:</b> ${formatVND(finalTotal)}</li>
</ul>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%; margin: 12px 0;">
  <thead>
    <tr style="background-color: #f5f5f7;">
      <th>STT</th>
      <th>Mã hàng</th>
      <th>Tên mặt hàng</th>
      <th>ĐVT</th>
      <th>SL đặt</th>
      <th>Đơn giá</th>
      <th>Thành tiền</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((it, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${it.item_code || ''}</td>
        <td><b>${it.item_name}</b></td>
        <td style="text-align: center;">${it.unit}</td>
        <td style="text-align: right;">${it.ordered_qty}</td>
        <td style="text-align: right;">${formatVND(it.unit_price)}</td>
        <td style="text-align: right;"><b>${formatVND(it.total_price)}</b></td>
      </tr>
    `).join('')}
  </tbody>
</table>
${notes ? `<p><b>Ghi chú điều phối:</b> ${notes}</p>` : ''}
<p>Trân trọng cảm ơn sự hợp tác của Quý đối tác!<br/><b>Farmers Market Procurement Team</b></p>`;

    return { subject, bodyText, htmlBody };
  };

  const isPdf = file?.name?.toLowerCase().endsWith('.pdf');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => {
        if (!saving) {
          onClose();
          resetForm();
        }
      }}
      title={step === 'confirm' ? 'Xác nhận thông tin đơn hàng' : 'Thêm PO vào hệ thống'}
      description={
        step === 'upload'
          ? 'Tải file PDF hóa đơn/PO để AI tự động trích xuất thông tin'
          : step === 'reading'
          ? 'Trí tuệ nhân tạo Gemini đang phân tích tài liệu PO...'
          : 'Kiểm tra và hoàn tất dữ liệu trước khi lưu vào danh mục theo dõi'
      }
      width={step === 'confirm' && filePreviewUrl && splitView ? '2xl' : 'lg'}
    >
      <div className="space-y-4 font-sans relative pb-6 text-left">
        {/* ============================================================== */}
        {/* STEP 1: UPLOAD */}
        {/* ============================================================== */}
        {step === 'upload' && (
          <div className="space-y-4">
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
                accept="application/pdf,image/png,image/jpeg,image/webp"
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
                Kéo & thả file PDF PO vào đây
              </p>
              <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] mt-1.5 max-w-sm">
                Hoặc bấm để chọn file từ máy tính (hỗ trợ PDF đơn đặt hàng, ảnh chụp/scan phiếu PO, tối đa 15MB)
              </p>
              <div className="mt-4 px-3.5 py-1.5 rounded-full bg-[#0088FF]/10 text-[#0088FF] dark:text-[#0091FF] text-[12px] font-semibold flex items-center gap-1.5">
                <SFCheckmarkCircleFill size={13} />
                <span>Tự động nhận diện: Số PO, Ngày giao, NCC, Hàng hóa, Kho</span>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
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
              <span>Nhập thủ công không dùng file PDF</span>
            </Button>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: READING */}
        {/* ============================================================== */}
        {step === 'reading' && (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-300">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-[#0088FF]/15 dark:border-[#0088FF]/20" />
              <div className="absolute inset-0 rounded-full border-4 border-[#0088FF] border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-[#0088FF] scale-110">
                <SFDocument size={28} />
              </div>
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-white tracking-tight">
                AI đang quét và bóc tách dữ liệu PO...
              </h3>
              <p className="text-[13px] font-medium text-[#0088FF] dark:text-[#0A84FF] transition-all duration-300">
                {readingStatus}
              </p>
              <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] mt-1">
                Tự động nhận diện số PO, đối tác nhà cung cấp, hạn giao và từng mặt hàng chi tiết
              </p>
            </div>
            {file && (
              <div className="px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-[12px] font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2 max-w-xs truncate shadow-2xs">
                <SFDocument size={13} className="text-[#0088FF] shrink-0" />
                <span className="truncate">{file.name}</span>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: CONFIRM & EDIT */}
        {/* ============================================================== */}
        {step === 'confirm' && (
          <form id="po-confirm-form" onSubmit={handleSavePO} className="space-y-4 text-left">
            {/* File info bar + Split-View & Document Preview Toggle */}
            {file && (
              <div className="space-y-2">
                <div className="p-3 px-4 rounded-2xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/20 flex items-center justify-between text-[13px] shadow-2xs flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#0088FF]/10 text-[#0088FF] flex items-center justify-center shrink-0">
                      <SFDocument size={16} />
                    </div>
                    <span className="truncate font-bold text-blue-950 dark:text-blue-200">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {filePreviewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setSplitView((prev) => !prev);
                          if (!splitView) setShowDocPreview(true);
                        }}
                        className={cn(
                          'px-2.5 py-1 rounded-lg font-bold text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors',
                          splitView
                            ? 'bg-[#0088FF] text-white shadow-2xs'
                            : 'bg-blue-100/70 hover:bg-blue-100 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-[#0088FF] dark:text-[#0A84FF]'
                        )}
                        title="Bật/Tắt chế độ Split-View chia đôi màn hình xem tài liệu PDF và biểu mẫu"
                      >
                        <SFEye size={12} />
                        <span>{splitView ? 'Tắt Split-View' : 'Split-View PDF'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMailModal(true)}
                      className="text-[#0088FF] hover:bg-blue-100/60 dark:hover:bg-blue-500/20 px-2.5 py-1 rounded-lg font-bold text-[12px] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Soạn mail gửi NCC theo mẫu MAIL PO"
                    >
                      <SFEnvelope size={12} />
                      <span>Soạn Mail NCC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      className="text-[#86868b] hover:text-[#1d1d1f] hover:underline font-medium text-[12px] cursor-pointer"
                    >
                      Đổi file
                    </button>
                  </div>
                </div>

                {/* Collapsible Document Viewer (used when not in splitView) */}
                {!splitView && showDocPreview && filePreviewUrl && (
                  <div className="p-3 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[12px] font-bold text-[#48484a]">
                      <span>Bản xem trước chứng từ (Đối chiếu số liệu)</span>
                      <button
                        type="button"
                        onClick={() => setShowDocPreview(false)}
                        className="text-[#86868b] hover:text-black cursor-pointer"
                      >
                        <SFXmark size={12} />
                      </button>
                    </div>
                    {isPdf ? (
                      <iframe
                        src={filePreviewUrl}
                        className="w-full h-72 rounded-xl border border-black/10 dark:border-white/10 bg-white"
                        title="Xem trước PDF"
                      />
                    ) : (
                      <div className="flex justify-center max-h-72 overflow-hidden rounded-xl bg-white/60 p-2 border border-black/10">
                        <img
                          src={filePreviewUrl}
                          alt="Xem trước PO"
                          className="max-h-68 object-contain rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Main Form Fields — Wrapped in Responsive Split-view if enabled */}
            <div className={cn(filePreviewUrl && splitView ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'space-y-4')}>
              {/* Left Column: PDF / Image Viewer in Split Mode */}
              {filePreviewUrl && splitView && (
                <div className="lg:col-span-5 sticky top-0 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3 space-y-2 h-[75vh] flex flex-col shadow-2xs">
                  <div className="flex items-center justify-between text-[12px] font-bold text-[#48484a] dark:text-[#a1a1a6]">
                    <span>Chứng từ gốc (Đối chiếu số liệu)</span>
                    <button
                      type="button"
                      onClick={() => setSplitView(false)}
                      className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white text-[11px] underline cursor-pointer"
                    >
                      Ẩn cột xem
                    </button>
                  </div>
                  {isPdf ? (
                    <iframe
                      src={filePreviewUrl}
                      className="w-full flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white"
                      title="Xem trước PDF"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center overflow-auto rounded-xl bg-white/60 p-2 border border-black/10">
                      <img
                        src={filePreviewUrl}
                        alt="Xem trước PO"
                        className="max-h-full object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Right Column: All Form Controls */}
              <div className={cn(filePreviewUrl && splitView ? 'lg:col-span-7 space-y-4' : 'space-y-4')}>

            {/* Folder Select */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Nhóm lưu trữ (Folder)
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[13px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all cursor-pointer shadow-2xs"
              >
                <option value="">(Chưa phân nhóm)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Header fields: Số PO & Ngày lập */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Số PO <span className="text-red-500">*</span>
                </label>
                <input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="VD: PO-118891"
                  className="w-full h-9 px-3.5 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[13px] font-bold text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Ngày lập PO
                </label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full h-9 px-3.5 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Hạn giao hàng (with Quick Chips) & Kho */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Hạn giao dự kiến
                  </label>
                  {/* Quick lead-time shortcut chips */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpectedDate(getRelativeDateStr(0))}
                      className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-black/5 hover:bg-black/10 text-[#48484a] cursor-pointer"
                      title="Giao hôm nay"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpectedDate(getRelativeDateStr(3))}
                      className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-blue-50 hover:bg-blue-100 text-[#0088FF] cursor-pointer"
                      title="Giao sau 3 ngày"
                    >
                      +3n
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpectedDate(getRelativeDateStr(7))}
                      className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-blue-50 hover:bg-blue-100 text-[#0088FF] cursor-pointer"
                      title="Giao sau 7 ngày"
                    >
                      +7n
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full h-9 px-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-500/15 border border-blue-300 dark:border-blue-500/30 text-[13px] font-bold text-[#0088FF] dark:text-[#0091FF] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Kho tiếp nhận {stores.length > 0 && <span className="text-[#86868b] font-normal text-[11px]">({stores.length} kho/cửa hàng)</span>}
                  </label>
                </div>
                <div className="relative">
                  <input
                    list="stores-po-datalist"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    placeholder="VD: DC01 - 180 Nơ Trang Long..."
                    className="w-full h-9 px-3.5 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[13px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                  />
                  <datalist id="stores-po-datalist">
                    {stores.map((s) => (
                      <option key={s.id} value={`${s.storeCode} - ${(s as any).storeName || s.address}`}>
                        {s.storeCode} ({s.address || (s as any).storeName})
                      </option>
                    ))}
                  </datalist>
                </div>
                {stores.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {stores.slice(0, 6).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setWarehouse(`${s.storeCode} - ${(s as any).storeName || s.address}`)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer',
                          warehouse.includes(s.storeCode)
                            ? 'bg-[#0088FF] text-white shadow-2xs'
                            : 'bg-black/5 dark:bg-white/5 text-[#555558] hover:bg-black/10 dark:hover:bg-white/10'
                        )}
                      >
                        {s.storeCode}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* NCC name & NCC code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Tên Nhà cung cấp
                </label>
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="VD: CÔNG TY TNHH ABC..."
                  className="w-full h-9 px-3.5 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[13px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Mã NCC
                </label>
                <input
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  placeholder="VD: V0001834"
                  className="w-full h-9 px-3.5 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[13px] font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs font-mono"
                />
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Danh sách hàng hóa ({items.length})
                  </label>
                  {items.length > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      Tổng {totalItemCount} sản phẩm
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkPasteModal(true)}
                    className="text-[12px] font-bold text-[#555558] hover:text-[#0088FF] cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-black/5"
                    title="Dán nhanh nhiều dòng từ Excel hoặc bảng tính"
                  >
                    <SFDocumentOnDocument size={11} />
                    <span>Dán từ Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[12px] font-bold text-[#0088FF] dark:text-[#0091FF] hover:underline cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  >
                    <SFPlus size={11} />
                    <span>Thêm dòng</span>
                  </button>
                </div>
              </div>

              {/* Bulk paste modal */}
              {showBulkPasteModal && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-[#0088FF]/30 space-y-2.5 shadow-md animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-white">
                      Nhập nhanh mặt hàng từ văn bản / Excel
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBulkPasteModal(false)}
                      className="text-[#86868b] hover:text-black cursor-pointer"
                    >
                      <SFXmark size={12} />
                    </button>
                  </div>
                  <p className="text-[11.5px] text-[#6e6e73]">
                    Mỗi dòng một sản phẩm. Định dạng: <code>Tên sản phẩm [Tab] Số lượng [Tab] ĐVT [Tab] Đơn giá</code>
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="VD:&#10;Táo Gala Thùng	10	Thùng	450000&#10;Nho đen không hạt	25	Kg	120000"
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkPasteModal(false)}
                      className="px-3 py-1 rounded-lg text-[12px] text-[#6e6e73] hover:bg-black/5"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleProcessBulkPaste}
                      className="px-3.5 py-1 rounded-lg bg-[#0088FF] text-white text-[12px] font-bold hover:bg-blue-600 shadow-2xs"
                    >
                      Nạp dữ liệu
                    </button>
                  </div>
                </div>
              )}

              {/* Scrollable list of items */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {items.length === 0 ? (
                  <div className="py-6 px-4 rounded-2xl border border-dashed border-black/15 dark:border-white/15 text-center bg-black/[0.01]">
                    <p className="text-[12.5px] font-medium text-slate-600 dark:text-zinc-400">
                      Chưa có mặt hàng nào. Bấm <b className="text-[#0088FF]">+ Thêm dòng</b> hoặc chọn file PO có bảng mặt hàng để hệ thống tự động nhận diện.
                    </p>
                  </div>
                ) : (
                  items.map((it, idx) => {
                    const rowTotal = Number(it.ordered_qty || 0) * Number(it.unit_price || 0);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.07] dark:border-white/10 space-y-2 text-[12.5px] shadow-2xs hover:border-black/20 transition-all"
                      >
                        {/* Top: Name + SKU + Duplicate + Delete */}
                        <div className="flex items-center gap-1.5">
                          <input
                            value={it.item_name}
                            onChange={(e) => handleUpdateItem(idx, { item_name: e.target.value })}
                            placeholder="Tên sản phẩm..."
                            className="flex-1 h-8 px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 font-bold text-[#1d1d1f] dark:text-white placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-[#0088FF]"
                          />
                          <input
                            value={it.item_code}
                            onChange={(e) => handleUpdateItem(idx, { item_code: e.target.value })}
                            placeholder="SKU"
                            className="w-24 h-8 px-2 rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#555558] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#0088FF]"
                          />
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(idx)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6e6e73] hover:text-[#0088FF] hover:bg-blue-50 cursor-pointer shrink-0 transition-colors"
                            title="Nhân bản dòng này"
                          >
                            <SFDocumentOnDocument size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDeleteIndex(idx)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 cursor-pointer shrink-0 transition-colors"
                            title="Xóa dòng mặt hàng"
                          >
                            <SFTrash size={12} />
                          </button>
                        </div>

                        {/* Bottom: SL, ĐVT, Đơn giá, Thành tiền */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-black/15 rounded-xl px-2 h-8">
                            <span className="text-[#6e6e73] text-[11px] font-bold shrink-0">SL:</span>
                            <input
                              type="number"
                              min="0"
                              value={it.ordered_qty}
                              onChange={(e) => handleUpdateItem(idx, { ordered_qty: Number(e.target.value) })}
                              className="w-full bg-transparent tabular-nums font-bold text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 text-[12.5px]"
                            />
                          </div>

                          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-black/15 rounded-xl px-2 h-8">
                            <span className="text-[#6e6e73] text-[11px] font-bold shrink-0">ĐVT:</span>
                            <input
                              value={it.unit}
                              onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                              placeholder="Gói"
                              className="w-full bg-transparent font-medium text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 text-[12.5px]"
                            />
                          </div>

                          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-black/15 rounded-xl px-2 h-8">
                            <span className="text-[#6e6e73] text-[11px] font-bold shrink-0">Giá:</span>
                            <input
                              type="number"
                              min="0"
                              value={it.unit_price}
                              onChange={(e) => handleUpdateItem(idx, { unit_price: Number(e.target.value) })}
                              className="w-full bg-transparent tabular-nums font-medium text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 text-[12.5px]"
                            />
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-1 px-2.5 h-8 bg-blue-50/80 dark:bg-blue-500/15 rounded-xl border border-blue-200/60 dark:border-blue-500/30">
                            <span className="text-[12px] font-extrabold text-[#0088FF] dark:text-[#0091FF] tabular-nums truncate">
                              {formatVND(rowTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Items Summary Footer */}
              {items.length > 0 && (
                <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">
                    Tổng cộng: <strong className="text-[#1d1d1f] dark:text-white font-bold">{items.length} mặt hàng</strong> ({totalItemCount} sp)
                  </span>
                  <div className="text-right">
                    <span className="text-[#6e6e73] text-[11px] mr-1">Tổng tiền:</span>
                    <span className="text-[14.5px] font-black text-[#0088FF] dark:text-[#0091FF] tabular-nums">
                      {formatVND(calculatedTotalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Ghi chú */}
            <div className="space-y-1">
              <label className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Ghi chú điều phối giao nhận
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú về tiến độ, tài xế, yêu cầu kiểm hàng..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1c1c20] border border-black/15 dark:border-white/15 text-[12.5px] font-medium text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 resize-none shadow-2xs"
              />
            </div>

              </div> {/* End Right Column */}
            </div> {/* End Split Container */}

            {/* Sticky Action Footer */}
            <div className="sticky -bottom-4 sm:-bottom-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 dark:bg-[#1c1c22]/95 backdrop-blur-md border-t border-black/[0.08] dark:border-white/10 flex items-center gap-3 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={saving}
                className="h-10 px-4 rounded-full border border-black/15 dark:border-white/15 text-[12.5px] font-bold text-[#555558] hover:bg-black/5 transition-colors cursor-pointer disabled:opacity-40"
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={() => setShowMailModal(true)}
                className="h-10 px-3.5 rounded-full border border-blue-300 dark:border-blue-500/30 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-[#0088FF] dark:text-[#0A84FF] text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                title="Tạo / Gửi Mail xác nhận NCC theo mẫu MAIL PO"
              >
                <SFEnvelope size={14} />
                <span className="hidden sm:inline">Mail NCC</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 rounded-full fm-primary-pill-surface text-[13px] font-bold text-white shadow-md hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Đang lưu đơn hàng PO...</span>
                  </>
                ) : (
                  <span>Hoàn tất & Bắt đầu theo dõi PO</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* BUG-007: Duplicate PO Number Warning Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1e1e24] rounded-3xl p-6 max-w-md w-full shadow-2xl border border-black/10 dark:border-white/10 space-y-4 text-left">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <SFExclamationmarkTriangleFill size={26} className="shrink-0" />
              <h3 className="text-[17px] font-black text-[#1d1d1f] dark:text-white">
                Cảnh báo trùng mã đơn hàng
              </h3>
            </div>
            <p className="text-[14px] text-[#48484a] dark:text-[#a1a1a6] leading-relaxed">
              Đơn hàng <b>[{duplicateWarning.po_number || poNumber}]</b> đã tồn tại trên hệ thống (NCC: {duplicateWarning.supplier_name || 'Chưa rõ'}).
              <br /><br />
              Bạn muốn <b>Cập nhật đè lên</b> hay <b>Xem đơn cũ</b>?
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const oldPo = duplicateWarning;
                  setDuplicateWarning(null);
                  onClose();
                  onSuccess(oldPo);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-black/15 dark:border-white/15 text-[13px] font-bold text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer text-center"
              >
                Xem đơn cũ
              </button>
              <button
                type="button"
                onClick={() => handleSavePO(undefined, duplicateWarning.id)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#0088FF] text-white text-[13px] font-bold hover:bg-[#0077EE] transition-all cursor-pointer shadow-sm text-center"
              >
                Cập nhật đè lên
              </button>
            </div>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="text-[12px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white underline cursor-pointer"
              >
                Hủy bỏ (Đổi mã PO khác)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUG-018: Supplier Mail Preview & Creation Modal */}
      {showMailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1e1e24] rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-black/10 dark:border-white/10 space-y-4 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2 text-[#0088FF] dark:text-[#0A84FF]">
                <SFEnvelope size={20} />
                <h3 className="text-[17px] font-black text-[#1d1d1f] dark:text-white">
                  Soạn Mail xác nhận Nhà cung cấp (MAIL PO)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMailModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 cursor-pointer"
              >
                <SFXmark size={14} />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="text-[12px] font-bold text-[#86868b]">Tiêu đề thư:</label>
                <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-[13px] font-bold text-[#1d1d1f] dark:text-white">
                  {generateMailDraft().subject}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-[#86868b]">Nội dung gửi đối tác:</label>
                <pre className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-[12.5px] font-mono whitespace-pre-wrap text-[#1d1d1f] dark:text-white max-h-[300px] overflow-y-auto leading-relaxed">
                  {generateMailDraft().bodyText}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/10 dark:border-white/10 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  const draft = generateMailDraft();
                  const newNote = await useNoteStore.getState().createNote('note', draft.htmlBody);
                  await useNoteStore.getState().updateNote(newNote.id, {
                    title: `[MAIL PO] ${poNumber || 'PO'} - ${supplierName || 'NCC'}`,
                    tags: ['MAIL PO', 'Đơn hàng'],
                  });
                  useNoteStore.getState().openNote();
                  setShowMailModal(false);
                  toast.success('Đã tạo ghi chú mẫu MAIL PO trong Quick Note!');
                }}
                className="h-9 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 text-[12px] font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <SFDocumentOnDocument size={13} />
                <span>Lưu vào Quick Note (MAIL PO)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const draft = generateMailDraft();
                    navigator.clipboard.writeText(draft.bodyText);
                    toast.success('Đã sao chép nội dung email vào clipboard!');
                  }}
                  className="h-9 px-3.5 rounded-xl border border-black/15 dark:border-white/15 text-[12.5px] font-bold text-[#1d1d1f] dark:text-white hover:bg-black/5 cursor-pointer transition-all"
                >
                  Sao chép Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const draft = generateMailDraft();
                    window.open(`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.bodyText)}`);
                  }}
                  className="h-9 px-4 rounded-xl fm-primary-pill-surface text-white text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <SFEnvelope size={13} />
                  <span>Mở ứng dụng Mail</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Item Dialog */}
      <ConfirmDeleteDialog
        isOpen={itemToDeleteIndex !== null}
        title="Xóa mặt hàng khỏi PO?"
        itemLabel={itemToDeleteIndex !== null ? items[itemToDeleteIndex]?.item_name || 'Mặt hàng' : undefined}
        message="Bạn có chắc chắn muốn xóa mặt hàng này khỏi danh sách đơn hàng PO?"
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        onConfirm={() => {
          if (itemToDeleteIndex !== null) {
            handleRemoveItem(itemToDeleteIndex);
            setItemToDeleteIndex(null);
          }
        }}
        onClose={() => setItemToDeleteIndex(null)}
      />
    </Drawer>
  );
};
