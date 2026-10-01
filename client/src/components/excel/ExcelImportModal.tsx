import React, { useState, useRef } from 'react';
import {
  SFArrowUpDocument,
  SFTablecells,
  SFCheckmarkCircleFill,
  SFExclamationmarkTriangleFill,
  SFSquareStack3dUp,
  SFArrowRight,
  SFArrowClockwise,
  SFDocument,
} from 'sf-symbols-lib';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CloseButton } from '@/components/ui/close-button';
import { AppleLiquidDialog } from '@/components/ui/AppleLiquidDialog';
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

  // Change target dataset for a sheet and dynamically re-analyze all rows
  const handleSheetMappingChange = async (sheetIndex: number, newDataset: 'LINK' | 'ACCOUNT' | 'STORE' | 'IGNORE') => {
    if (!previewData || !selectedFile) return;

    try {
      const sheetName = previewData.sheets[sheetIndex].sheetName;
      const updatedSheet = await excelService.reanalyzeSheet(selectedFile, sheetName, newDataset);

      const updatedSheets = [...previewData.sheets];
      updatedSheets[sheetIndex] = updatedSheet;

      setPreviewData({
        ...previewData,
        sheets: updatedSheets,
      });
      toast.success(`Đã cập nhật phân tích sheet "${sheetName}": ${newDataset} (${updatedSheet.validCount} dòng hợp lệ)`, {
        id: 'sheet-mapping-update',
      });
    } catch (err: any) {
      console.error('Lỗi khi phân tích lại sheet:', err);
      toast.error('Không thể cập nhật phân tích sheet này');
    }
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

  return (
    <AppleLiquidDialog
      isOpen={isOpen}
      onClose={handleClose}
      zIndex={10010}
      title="Import Dữ Liệu Excel"
      overlayClassName="p-4"
      contentClassName="relative bg-white dark:bg-[#1c1c22] rounded-[24px] max-w-2xl w-full p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border border-black/10 dark:border-white/15 flex flex-col max-h-[90vh]"
    >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff] rounded-2xl flex items-center justify-center shrink-0 border border-[#0066cc]/20 dark:border-[#2997ff]/30 shadow-xs">
              <SFTablecells size={20} />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                Import Dữ Liệu Excel
              </h3>
              <p className="text-[13px] text-[#76767b] dark:text-[#a1a1a6]">
                Hỗ trợ file .xlsx, .xls, .csv tự động nhận diện LINK, ACCOUNT, DS CH
              </p>
            </div>
          </div>
          <CloseButton onClick={handleClose} size="md" />
        </div>

        {/* Content Body */}
        <div className="py-4 overflow-y-auto flex-1 space-y-4">
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-[20px] p-8 text-center transition-all ${
                dragActive
                  ? 'border-[#0071e3] bg-[#0071e3]/10 scale-[0.99]'
                  : 'border-black/10 dark:border-white/15 hover:border-[#0071e3] dark:hover:border-[#2997ff] bg-black/[0.02] dark:bg-white/[0.04]'
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

              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-b from-[#2997ff]/20 to-[#0066cc]/20 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 dark:border-[#2997ff]/30 shadow-xs">
                <SFArrowUpDocument size={28} />
              </div>

              <h4 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Kéo thả file Excel vào đây hoặc bấm để chọn
              </h4>
              <p className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] mt-1.5 max-w-sm mx-auto">
                Tự động nhận diện cấu trúc file: <strong className="text-[#0071e3] dark:text-[#2997ff] font-semibold">FM_FOR WORK.xlsx</strong> với các sheet LINK, ACCOUNT, DS CH
              </p>

              <div className="mt-5">
                <Button
                  type="button"
                  variant="glassProminent"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={loading}
                  icon={<SFTablecells size={16} />}
                >
                  Chọn file từ máy tính
                </Button>
              </div>

              <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-center gap-6 text-[12px] text-[#76767b] dark:text-[#a1a1a6]">
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
                  <SFDocument size={16} className="text-[#0066cc] dark:text-[#2997ff] shrink-0" />
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
                        <SFSquareStack3dUp size={16} className="text-[#86868b]" />
                        <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">
                          {sheet.sheetName}
                        </span>
                        <SFArrowRight size={14} className="text-[#86868b]" />
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
                  <SFExclamationmarkTriangleFill size={16} />
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
              <SFArrowClockwise size={32} className="text-[#0066cc] animate-spin mx-auto" />
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
        <div className="pt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0">
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
                icon={<SFCheckmarkCircleFill size={16} />}
              >
                Xác nhận Import vào Workspace
              </Button>
            )}
          </div>
        </div>
    </AppleLiquidDialog>
  );
};
