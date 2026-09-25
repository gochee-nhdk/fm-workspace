import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SFArrowUpDocument, SFTablecells, SFXmark } from 'sf-symbols-lib';
import { Button } from './button';

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeBytes?: number;
  label?: string;
  description?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.xlsx,.xls,.csv',
  maxSizeBytes = 100 * 1024 * 1024, // 100MB
  label = 'Tải lên tệp dữ liệu',
  description = 'Kéo thả tệp Excel (.xlsx, .xls) hoặc CSV (.csv) vào đây',
  className
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > maxSizeBytes) {
      setError(`Dung lượng tệp vượt quá giới hạn ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`);
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const acceptedList = accept.split(',').map((s) => s.trim().toLowerCase());
    if (!acceptedList.includes(ext)) {
      setError(`Định dạng tệp không được hỗ trợ. Vui lòng tải lên ${accept}`);
      return;
    }

    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3',
          dragOver
            ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
            : 'border-slate-300 dark:border-slate-700 hover:border-teal-500/60 bg-white/40 dark:bg-slate-900/40'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
          <SFArrowUpDocument size={24} />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>

        <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-900">
          Hỗ trợ: {accept} (Tối đa 25MB)
        </span>
      </div>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium px-1">{error}</p>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <SFTablecells size={20} className="text-teal-600 dark:text-teal-400 shrink-0" />
            <div className="truncate text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {selectedFile.name}
              </p>
              <p className="text-slate-400 text-[10px]">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <SFXmark size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
