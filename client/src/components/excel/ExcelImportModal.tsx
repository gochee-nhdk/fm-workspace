import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  RefreshCw,
  X,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { excelService, detectDatasetFromSheetName } from '@/services/excelService';
import { ImportPreviewResult, DuplicateStrategy, SheetPreview } from '@/types/workspace';
import toast from 'react-hot-toast';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}


export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [previewData, setPreviewData] = useState<ImportPreviewResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('update');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setPreviewData(null);
    setSelectedFile(null);
    setLoading(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = async (file: File) => {
    const validExts = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      toast.error('Vui lòng chọn file định dạng .xlsx, .xls hoặc .csv');
      return;
    }

    try {
      setLoading(true);
      setSelectedFile(file);
      const preview = await excelService.generateImportPreview(file);
      setPreviewData(preview);
      setStep('preview');
    } catch (err: any) {
      console.error('Error reading excel file:', err);
      toast.error(`Không thể đọc file: ${err.message || 'File không đúng định dạng Excel'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Change target dataset for a sheet
  const handleSheetMappingChange = (sheetIndex: number, newDataset: 'LINK' | 'ACCOUNT' | 'STORE' | 'IGNORE') => {
    if (!previewData || !selectedFile) return;

    const updatedSheets = [...previewData.sheets];
    const sheet = updatedSheets[sheetIndex];
    sheet.targetDataset = newDataset;

    // Re-analyze rows based on newly chosen target
    excelService.readWorkbook(selectedFile).then((wb) => {
      const rawRows: any[] = XLSXUtilsSheetToJson(wb.Sheets[sheet.sheetName]);
      // Note: we can re-evaluate
    });

    setPreviewData({
      ...previewData,
      sheets: updatedSheets,
    });
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    try {
      setStep('importing');
      setLoading(true);

      const result = await excelService.executeImport(previewData.sheets, duplicateStrategy);

      const totalImported =
        result.importedLinks + result.importedAccounts + result.importedStores;

      toast.success(
        `Import thành công! Đã nạp ${totalImported} bản ghi (${result.importedLinks} links, ${result.importedAccounts} tài khoản, ${result.importedStores} cửa hàng).`
      );

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Lỗi khi import: ${err.message || 'Không thể ghi vào cơ sở dữ liệu'}`);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-md transition-opacity duration-200"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white/80 dark:bg-[#141418]/82 backdrop-blur-3xl rounded-[24px] max-w-2xl w-full p-6 shadow-[0_24px_70px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/80 dark:border-white/15 animate-in fade-in zoom-in-95 duration-220 ease-out flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e0e0e0] dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] rounded-full flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
                Import Dữ Liệu Excel
              </h3>
              <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6]">
                Hỗ trợ file .xlsx, .xls, .csv tự động nhận diện LINK, ACCOUNT, DS CH
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-white/10 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 overflow-y-auto flex-1 space-y-4">
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-[18px] p-8 text-center transition-all ${
                dragActive
                  ? 'border-[#0066cc] bg-[#0066cc]/5 scale-[0.99]'
                  : 'border-[#e0e0e0] dark:border-white/15 hover:border-[#0066cc] bg-[#f5f5f7]/60 dark:bg-white/5'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] flex items-center justify-center shadow-xs">
                <UploadCloud className="w-7 h-7" />
              </div>

              <h4 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Kéo thả file Excel vào đây hoặc bấm để chọn
              </h4>
              <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-1 max-w-sm mx-auto">
                Tự động nhận diện cấu trúc file: <strong className="text-[#1d1d1f] dark:text-white">FM_FOR WORK.xlsx</strong> với các sheet LINK, ACCOUNT, DS CH
              </p>

              <div className="mt-5">
                <Button
                  type="button"
                  variant="glassProminent"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={loading}
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                >
                  Chọn file từ máy tính
                </Button>
              </div>

              <div className="mt-6 pt-4 border-t border-[#e0e0e0]/60 dark:border-white/10 flex items-center justify-center gap-6 text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                <span>✓ .xlsx, .xls, .csv</span>
                <span>✓ Kiểm tra trùng lặp</span>
                <span>✓ Preview trước khi lưu</span>
              </div>
            </div>
          )}

          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="glass-material p-3.5 rounded-[16px] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff] shrink-0" />
                  <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                    {previewData.fileName}
                  </span>
                  <span className="text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                    ({formatFileSize(previewData.fileSize)})
                  </span>
                </div>
                <Badge variant="default" size="sm">
                  {previewData.sheets.length} Sheets
                </Badge>
              </div>

              {/* Sheets Breakdown List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider">
                  Kết quả phân tích & Mapping Sheets
                </h4>

                {previewData.sheets.map((sheet, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[14px] border border-[#e0e0e0] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#0066cc]/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#86868b]" />
                        <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">
                          {sheet.sheetName}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#86868b]" />
                        <select
                          className="text-xs font-medium rounded-full border border-[#e0e0e0] dark:border-white/15 bg-[#f5f5f7] dark:bg-white/10 pl-3 pr-8 py-1 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] cursor-pointer"
                          value={sheet.targetDataset}
                          onChange={(e) =>
                            handleSheetMappingChange(
                              idx,
                              e.target.value as 'LINK' | 'ACCOUNT' | 'STORE' | 'IGNORE'
                            )
                          }
                        >
                          <option value="LINK">Dataset: LINK (Liên kết)</option>
                          <option value="ACCOUNT">Dataset: ACCOUNT (Tài khoản)</option>
                          <option value="STORE">Dataset: DS CH (Cửa hàng)</option>
                          <option value="IGNORE">Bỏ qua (Không import)</option>
                        </select>
                      </div>

                      {/* Row counts status */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-white/10 text-[#1d1d1f] dark:text-white font-mono">
                          {sheet.totalRows} dòng
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ {sheet.validCount} hợp lệ
                        </span>
                        {sheet.duplicateCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium">
                            ⚠ {sheet.duplicateCount} trùng
                          </span>
                        )}
                        {sheet.invalidCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium">
                            ✕ {sheet.invalidCount} lỗi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Duplicate Strategy Option */}
              <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-[14px] border border-amber-200/60 dark:border-amber-900/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  Xử lý khi phát hiện bản ghi đã tồn tại (Duplicate Detection):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-full border text-xs cursor-pointer transition-colors active:scale-95 ${
                      duplicateStrategy === 'update'
                        ? 'border-[#0066cc] bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                        : 'border-[#e0e0e0] dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      checked={duplicateStrategy === 'update'}
                      onChange={() => setDuplicateStrategy('update')}
                      className="text-[#0066cc] focus:ring-[#0071e3] w-3.5 h-3.5 ml-1"
                    />
                    <span>Cập nhật bản ghi cũ</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-full border text-xs cursor-pointer transition-colors active:scale-95 ${
                      duplicateStrategy === 'skip'
                        ? 'border-[#0066cc] bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                        : 'border-[#e0e0e0] dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      checked={duplicateStrategy === 'skip'}
                      onChange={() => setDuplicateStrategy('skip')}
                      className="text-[#0066cc] focus:ring-[#0071e3] w-3.5 h-3.5 ml-1"
                    />
                    <span>Bỏ qua (Giữ bản cũ)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-full border text-xs cursor-pointer transition-colors active:scale-95 ${
                      duplicateStrategy === 'duplicate'
                        ? 'border-[#0066cc] bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                        : 'border-[#e0e0e0] dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      checked={duplicateStrategy === 'duplicate'}
                      onChange={() => setDuplicateStrategy('duplicate')}
                      className="text-[#0066cc] focus:ring-[#0071e3] w-3.5 h-3.5 ml-1"
                    />
                    <span>Tạo bản ghi mới</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#0066cc] animate-spin mx-auto" />
              <h4 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Đang nạp dữ liệu vào IndexedDB...
              </h4>
              <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6]">
                Dữ liệu sẽ được lưu an toàn trong trình duyệt của bạn.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 flex items-center justify-between shrink-0">
          {step === 'preview' ? (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={handleReset}
              disabled={loading}
            >
              Chọn file khác
            </Button>
          ) : (
            <span className="text-[12px] text-[#76767b] dark:text-[#a1a1a6]">
              Chưa có file? Bạn có thể thêm thủ công trên từng trang.
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={handleClose}
              disabled={loading}
            >
              Hủy
            </Button>

            {step === 'preview' && (
              <Button
                type="button"
                variant="glassProminent"
                size="sm"
                onClick={handleConfirmImport}
                loading={loading}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Xác nhận Import vào Workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Helper for sheet json convert
function XLSXUtilsSheetToJson(ws: any): any[] {
  if (!ws) return [];
  try {
    const XLSX = (window as any).XLSX;
    return XLSX ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
  } catch (_) {
    return [];
  }
}
