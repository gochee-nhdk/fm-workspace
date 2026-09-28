import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import {
  SFDocument,
  SFPlus,
  SFPin,
  SFPinSlash,
  SFMinus,
  SFXmark,
  SFTrash,
  SFSquareOnSquare,
  SFCheckmark,
  SFSidebarLeft,
  SFMagnifyingglass,
  SFCheckmarkSquare,
  SFSquareAndPencil,
  SFClock,
  SFBell,
  SFBellBadge,
  SFCamera,
  SFPhoto,
  SFPhotoBadgePlus,
  SFArrowDownToLine,
  SFChevronLeft,
  SFChevronRight,
  SFWandAndSparkles,
  SFKey,
  SFKeyFill,
  SFChecklist,
  SFListBullet,
  SFTextQuote,
  SFCheckmarkCircle,
  SFBriefcase,
  AppleNotesBadge,
} from '@/components/ui/AppleIcon';
import {
  Scissors,
  Calculator,
  Tag,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading,
  Settings,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  ChevronDown,
  Mail,
  Send,
  Check,
  Loader2,
  Lock,
  Unlock,
  Shield,
  Globe,
  Paperclip,
} from 'lucide-react';
import { useNoteStore } from '@/stores/note-store';
import { QuickNoteColor, QuickNoteItem, TaskReminder, NoteImageAttachment } from '@/types/workspace';
import { reminderService, playAppleChime } from '@/services/reminderService';
import {
  compressImageFile,
  captureScreenViaMedia,
  captureScreenSnapshot,
  downloadImage,
  copyImageToClipboard,
  formatFileSize,
} from '@/services/noteImageService';
import { SnippingToolOverlay } from '@/components/notes/SnippingToolOverlay';
import { tryCalculateInlineMath } from '@/services/mathNotesService';
import {
  runWritingTool,
  WritingToolAction,
  getStoredGeminiKey,
  setStoredGeminiKey,
} from '@/services/writingToolsService';
import toast from 'react-hot-toast';

const COLOR_MAP: Record<
  QuickNoteColor,
  {
    bg: string;
    dot: string;
    border: string;
    glow: string;
    selectedBorder: string;
    selectedBg: string;
    selectedTitle: string;
    hoverBorder: string;
    hoverBg: string;
    iconColor: string;
  }
> = {
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-400/15',
    dot: 'bg-amber-500',
    border: 'border-amber-500/30',
    glow: 'rgba(245,158,11,0.25)',
    selectedBorder: 'border-amber-500/50 dark:border-amber-400/55 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]',
    selectedBg: 'bg-amber-500/12 dark:bg-amber-400/18',
    selectedTitle: 'text-amber-950 dark:text-amber-200',
    hoverBorder: 'hover:border-amber-500/40',
    hoverBg: 'hover:bg-amber-500/6 dark:hover:bg-amber-400/10',
    iconColor: 'text-amber-500',
  },
  blue: {
    bg: 'bg-[#0071e3]/10 dark:bg-[#2997ff]/15',
    dot: 'bg-[#0071e3]',
    border: 'border-[#0071e3]/30',
    glow: 'rgba(0,113,227,0.25)',
    selectedBorder: 'border-[#0071e3]/50 dark:border-[#2997ff]/55 shadow-[0_0_0_1px_rgba(0,113,227,0.35)]',
    selectedBg: 'bg-[#0071e3]/12 dark:bg-[#2997ff]/18',
    selectedTitle: 'text-[#004f9e] dark:text-[#70b5ff]',
    hoverBorder: 'hover:border-[#0071e3]/40',
    hoverBg: 'hover:bg-[#0071e3]/6 dark:hover:bg-[#2997ff]/10',
    iconColor: 'text-[#0071e3] dark:text-[#2997ff]',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/30',
    glow: 'rgba(16,185,129,0.25)',
    selectedBorder: 'border-emerald-500/50 dark:border-emerald-400/55 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]',
    selectedBg: 'bg-emerald-500/12 dark:bg-emerald-400/18',
    selectedTitle: 'text-emerald-950 dark:text-emerald-200',
    hoverBorder: 'hover:border-emerald-500/40',
    hoverBg: 'hover:bg-emerald-500/6 dark:hover:bg-emerald-400/10',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-400/15',
    dot: 'bg-purple-500',
    border: 'border-purple-500/30',
    glow: 'rgba(139,92,246,0.25)',
    selectedBorder: 'border-purple-500/50 dark:border-purple-400/55 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]',
    selectedBg: 'bg-purple-500/12 dark:bg-purple-400/18',
    selectedTitle: 'text-purple-950 dark:text-purple-200',
    hoverBorder: 'hover:border-purple-500/40',
    hoverBg: 'hover:bg-purple-500/6 dark:hover:bg-purple-400/10',
    iconColor: 'text-purple-500 dark:text-purple-400',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-400/15',
    dot: 'bg-rose-500',
    border: 'border-rose-500/30',
    glow: 'rgba(244,63,94,0.25)',
    selectedBorder: 'border-rose-500/50 dark:border-rose-400/55 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]',
    selectedBg: 'bg-rose-500/12 dark:bg-rose-400/18',
    selectedTitle: 'text-rose-950 dark:text-rose-200',
    hoverBorder: 'hover:border-rose-500/40',
    hoverBg: 'hover:bg-rose-500/6 dark:hover:bg-rose-400/10',
    iconColor: 'text-rose-500 dark:text-rose-400',
  },
};

/**
 * Format date to YYYY-MM-DDTHH:mm for datetime-local input
 */
const toDatetimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Format badge text for task reminder chip
 */
const formatReminderBadge = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `${timeStr} Hôm nay`;
    return `${timeStr} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  } catch (_) {
    return '';
  }
};

/**
 * Subtle tactile pop sound when clicking checkbox
 */
const playPopSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (_) {}
};

interface ChecklistRow {
  lineIndex: number;
  taskId: string;
  completed: boolean;
  text: string;
  reminderAt?: string | null;
}

/**
 * Ensure note content is well-formed HTML for rich text editing
 */
const ensureHtml = (content: string): string => {
  if (!content) return '<p><br></p>';
  // Clean up any accidentally escaped or nested <p> tags
  let cleaned = content
    .replace(/&lt;p&gt;/gi, '')
    .replace(/&lt;\/p&gt;/gi, '')
    .replace(/<p>\s*<p>/gi, '<p>')
    .replace(/<\/p>\s*<\/p>/gi, '</p>');

  // Dọn dẹp thanh 3 nút cũ nếu có trong các ghi chú trước đó, chuyển sang nút xóa Apple Liquid Glass tròn tinh tế
  if (cleaned.includes('apple-img-action-bar')) {
    cleaned = cleaned.replace(/<span class=["']apple-img-action-bar["'][^>]*>[\s\S]*?<\/span>/gi, '');
  }

  // Tự động chuẩn hóa tất cả các hình ảnh chưa có nút xóa Apple thành thẻ chuẩn gọn gàng khít 100% với ảnh
  if (typeof document !== 'undefined' && cleaned.includes('<img')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleaned, 'text/html');
      let modified = false;
      const imgs = Array.from(doc.querySelectorAll('img'));
      imgs.forEach((img) => {
        if (!img.closest('.apple-img-wrapper')) {
          modified = true;
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || 'Hình ảnh';
          const span = document.createElement('span');
          span.className = 'apple-img-wrapper';
          span.setAttribute('contenteditable', 'false');
          span.setAttribute('data-media-type', 'image');
          span.setAttribute('style', 'position: relative; display: inline-flex; line-height: 0; font-size: 0; padding: 0; margin: 6px 0; max-width: 100%; vertical-align: middle; border-radius: 14px; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08); background: transparent;');
          span.innerHTML = `<img src="${src}" alt="${alt}" class="apple-note-inline-img" style="max-width: 320px; max-height: 220px; width: auto; height: auto; object-fit: contain; border-radius: 13px; display: block; margin: 0; padding: 0; border: none; box-shadow: none; vertical-align: top; line-height: 0; cursor: zoom-in;" title="Nhấp để xem ảnh đầy đủ" /><button type="button" class="apple-img-delete-btn" style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: rgba(22,22,26,0.52); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 0.5px solid rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; outline: none; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Xóa hình ảnh này"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></button>`;
          img.replaceWith(span);
        } else {
          const wrapper = img.closest('.apple-img-wrapper');
          if (wrapper && !wrapper.querySelector('.apple-img-delete-btn')) {
            modified = true;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'apple-img-delete-btn';
            btn.setAttribute('style', 'position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: rgba(22,22,26,0.52); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 0.5px solid rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; outline: none; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.25);');
            btn.setAttribute('title', 'Xóa hình ảnh này');
            btn.innerHTML = `<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>`;
            wrapper.appendChild(btn);
          }
        }
      });
      if (modified) {
        cleaned = doc.body.innerHTML;
      }
    } catch (_) {}
  }

  // If already contains HTML tags
  if (/<(p|div|h[1-6]|ul|ol|li|b|strong|i|em|u|s|strike|br|span|img)\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/^#\s+(.*?)$/gm, '<h2>$1</h2>');
  }
  return cleaned
    .split('\n')
    .map((line) => {
      const l = line.trim();
      if (!l) return '<p><br></p>';
      if (l.startsWith('# ')) return `<h2>${l.substring(2)}</h2>`;
      // Preserve checklist lines without converting to bullet list or stripping '- '
      if (/^(?:-\s*)?\[([ xX])\]/.test(l)) {
        return `<p>${l}</p>`;
      }
      if (l.startsWith('- ')) return `<ul><li>${l.substring(2)}</li></ul>`;
      const numMatch = l.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) return `<ol><li>${numMatch[2]}</li></ol>`;
      return `<p>${l}</p>`;
    })
    .join('');
};

/**
 * Extract plain text from HTML string with newline separation between block elements
 */
const extractPlainText = (html: string): string => {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html;
  }
  const formatted = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n');
  const tmp = document.createElement('div');
  tmp.innerHTML = formatted;
  const raw = tmp.innerText || tmp.textContent || '';
  return raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Format note preview snippet for the left sidebar list
 */
const formatNotePreview = (content: string): string => {
  if (!content || !content.trim()) return 'Trống...';
  const plain = extractPlainText(content);
  if (!plain.trim()) return 'Trống...';
  const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'Trống...';
  return lines[0].replace(/^(?:-\s*)?\[([ xX])\]\s*/, (_, check) =>
    check.toLowerCase() === 'x' ? '☑ ' : '☐ '
  );
};

/**
 * Render Apple-styled document vector badge icon by file extension
 */
const getAppleDocSvg = (ext: string): string => {
  const e = ext.toLowerCase();
  if (e === 'pdf') {
    return `<svg width="26" height="32" viewBox="0 0 28 34" fill="none" style="flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(224,62,45,0.25));"><path d="M4 2C2.89543 2 2 2.89543 2 4V30C2 31.1046 2.89543 32 4 32H24C25.1046 32 26 31.1046 26 30V10L18 2H4Z" fill="#ff4d4f"/><path d="M18 2V8C18 9.10457 18.8954 10 20 10H26L18 2Z" fill="#d9363e" opacity="0.85"/><rect x="5" y="16" width="18" height="9" rx="2.5" fill="white"/><text x="14" y="23" font-size="7.5" font-weight="900" font-family="system-ui,-apple-system,sans-serif" fill="#d9363e" text-anchor="middle">PDF</text></svg>`;
  }
  if (['doc', 'docx'].includes(e)) {
    return `<svg width="26" height="32" viewBox="0 0 28 34" fill="none" style="flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(43,87,154,0.25));"><path d="M4 2C2.89543 2 2 2.89543 2 4V30C2 31.1046 2.89543 32 4 32H24C25.1046 32 26 31.1046 26 30V10L18 2H4Z" fill="#2b579a"/><path d="M18 2V8C18 9.10457 18.8954 10 20 10H26L18 2Z" fill="#1e3e6e" opacity="0.85"/><rect x="5" y="16" width="18" height="9" rx="2.5" fill="white"/><text x="14" y="23" font-size="7" font-weight="900" font-family="system-ui,-apple-system,sans-serif" fill="#2b579a" text-anchor="middle">DOC</text></svg>`;
  }
  if (['xls', 'xlsx', 'csv'].includes(e)) {
    return `<svg width="26" height="32" viewBox="0 0 28 34" fill="none" style="flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(33,115,70,0.25));"><path d="M4 2C2.89543 2 2 2.89543 2 4V30C2 31.1046 2.89543 32 4 32H24C25.1046 32 26 31.1046 26 30V10L18 2H4Z" fill="#217346"/><path d="M18 2V8C18 9.10457 18.8954 10 20 10H26L18 2Z" fill="#165130" opacity="0.85"/><rect x="5" y="16" width="18" height="9" rx="2.5" fill="white"/><text x="14" y="23" font-size="7" font-weight="900" font-family="system-ui,-apple-system,sans-serif" fill="#217346" text-anchor="middle">XLS</text></svg>`;
  }
  if (['ppt', 'pptx'].includes(e)) {
    return `<svg width="26" height="32" viewBox="0 0 28 34" fill="none" style="flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(210,71,38,0.25));"><path d="M4 2C2.89543 2 2 2.89543 2 4V30C2 31.1046 2.89543 32 4 32H24C25.1046 32 26 31.1046 26 30V10L18 2H4Z" fill="#d24726"/><path d="M18 2V8C18 9.10457 18.8954 10 20 10H26L18 2Z" fill="#993219" opacity="0.85"/><rect x="5" y="16" width="18" height="9" rx="2.5" fill="white"/><text x="14" y="23" font-size="7" font-weight="900" font-family="system-ui,-apple-system,sans-serif" fill="#d24726" text-anchor="middle">PPT</text></svg>`;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) {
    return `<svg width="26" height="32" viewBox="0 0 28 34" fill="none" style="flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(128,90,213,0.25));"><path d="M4 2C2.89543 2 2 2.89543 2 4V30C2 31.1046 2.89543 32 4 32H24C25.1046 32 26 31.1046 26 30V10L18 2H4Z" fill="#805ad5"/><path d="M18 2V8C18 9.10457 18.8954 10 20 10H26L18 2Z" fill="#5e3ca8" opacity="0.85"/><rect x="5" y="16" width="18" height="9" rx="2.5" fill="white"/><text x="14" y="23" font-size="7" font-weight="900" font-family="system-ui,-apple-system,sans-serif" fill="#805ad5" text-anchor="middle">ZIP</text></svg>`;
  }
  const label = (e.slice(0, 4) || 'FILE').toUpperCase();
  return `<svg width="26" height="32" viewBox="0 0 28 34" fill="none" style="flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(113,128,150,0.25));"><path d="M4 2C2.89543 2 2 2.89543 2 4V30C2 31.1046 2.89543 32 4 32H24C25.1046 32 26 31.1046 26 30V10L18 2H4Z" fill="#718096"/><path d="M18 2V8C18 9.10457 18.8954 10 20 10H26L18 2Z" fill="#4a5568" opacity="0.85"/><rect x="5" y="16" width="18" height="9" rx="2.5" fill="white"/><text x="14" y="23" font-size="6.5" font-weight="900" font-family="system-ui,-apple-system,sans-serif" fill="#718096" text-anchor="middle">${label}</text></svg>`;
};

/**
 * Decode base64 data URL to text
 */
const decodeDataUrlText = (dataUrl: string): string => {
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch {
    return 'Không thể giải mã văn bản.';
  }
};

/**
 * Convert base64 data URL to native Blob for reliable browser rendering (PDF, Audio, Video)
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const base64 = parts[1] || parts[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

interface ExcelSheetPreview {
  name: string;
  rows: any[][];
  totalRows: number;
  totalCols: number;
}

const parseExcelFromDataUrl = (dataUrl: string): { sheets: ExcelSheetPreview[]; activeSheetIndex: number } | null => {
  try {
    const parts = dataUrl.split(',');
    const base64 = parts[1] || parts[0];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheets: ExcelSheetPreview[] = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      let maxCols = 0;
      rawData.forEach((row) => {
        if (Array.isArray(row) && row.length > maxCols) maxCols = row.length;
      });
      return {
        name,
        rows: rawData.slice(0, 300), // First 300 rows for high performance
        totalRows: rawData.length,
        totalCols: maxCols,
      };
    });
    return { sheets, activeSheetIndex: 0 };
  } catch (err) {
    console.error('Lỗi khi đọc bảng tính Excel:', err);
    return null;
  }
};

interface DocxBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table';
  text?: string;
  tableRows?: string[][];
}

const parseDocxFromDataUrl = async (dataUrl: string): Promise<DocxBlock[] | null> => {
  try {
    const parts = dataUrl.split(',');
    const base64 = parts[1] || parts[0];
    const binary = atob(base64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buf[i] = binary.charCodeAt(i);
    }

    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let offset = 0;
    let docXmlText: string | null = null;
    while (offset < buf.byteLength - 4) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(buf.subarray(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);

      if (name === 'word/document.xml') {
        if (compMethod === 0) {
          docXmlText = new TextDecoder().decode(compData);
        } else if (compMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData);
          writer.close();
          const res = new Response(ds.readable);
          docXmlText = await res.text();
        }
        break;
      }
      offset = dataStart + compSize;
    }

    if (!docXmlText) return null;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlText, 'application/xml');
    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (!body) return null;

    const blocks: DocxBlock[] = [];
    const children = Array.from(body.children);

    for (const child of children) {
      if (child.nodeName === 'w:p') {
        const textNodes = child.getElementsByTagName('w:t');
        let fullText = '';
        for (let i = 0; i < textNodes.length; i++) {
          fullText += textNodes[i].textContent || '';
        }
        if (!fullText.trim()) continue;

        const pStyle = child.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
        const numPr = child.getElementsByTagName('w:numPr')[0];
        if (pStyle.toLowerCase().includes('heading1') || pStyle === '1') {
          blocks.push({ type: 'h1', text: fullText });
        } else if (pStyle.toLowerCase().includes('heading2') || pStyle === '2') {
          blocks.push({ type: 'h2', text: fullText });
        } else if (pStyle.toLowerCase().includes('heading3') || pStyle === '3') {
          blocks.push({ type: 'h3', text: fullText });
        } else if (numPr) {
          blocks.push({ type: 'li', text: fullText });
        } else {
          blocks.push({ type: 'p', text: fullText });
        }
      } else if (child.nodeName === 'w:tbl') {
        const trList = child.getElementsByTagName('w:tr');
        const tableRows: string[][] = [];
        for (let r = 0; r < trList.length; r++) {
          const tcList = trList[r].getElementsByTagName('w:tc');
          const rowCells: string[] = [];
          for (let c = 0; c < tcList.length; c++) {
            const tNodes = tcList[c].getElementsByTagName('w:t');
            let cellText = '';
            for (let k = 0; k < tNodes.length; k++) {
              cellText += tNodes[k].textContent || '';
            }
            rowCells.push(cellText);
          }
          if (rowCells.length > 0) tableRows.push(rowCells);
        }
        if (tableRows.length > 0) {
          blocks.push({ type: 'table', tableRows });
        }
      }
    }

    return blocks.length > 0 ? blocks : null;
  } catch (e) {
    console.error('Lỗi khi đọc file docx:', e);
    return null;
  }
};

interface PptxSlide {
  slideNum: number;
  texts: string[];
}

const parsePptxFromDataUrl = async (dataUrl: string): Promise<PptxSlide[] | null> => {
  try {
    const parts = dataUrl.split(',');
    const base64 = parts[1] || parts[0];
    const binary = atob(base64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buf[i] = binary.charCodeAt(i);
    }

    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let offset = 0;
    const slideXmlMap: Record<number, string> = {};

    while (offset < buf.byteLength - 4) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(buf.subarray(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);

      const slideMatch = name.match(/ppt\/slides\/slide(\d+)\.xml/);
      if (slideMatch) {
        const slideNum = parseInt(slideMatch[1], 10);
        if (compMethod === 0) {
          slideXmlMap[slideNum] = new TextDecoder().decode(compData);
        } else if (compMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData);
          writer.close();
          const res = new Response(ds.readable);
          slideXmlMap[slideNum] = await res.text();
        }
      }
      offset = dataStart + compSize;
    }

    const parser = new DOMParser();
    const slides: PptxSlide[] = [];
    const slideNumbers = Object.keys(slideXmlMap).map(Number).sort((a, b) => a - b);

    for (const num of slideNumbers) {
      const xmlStr = slideXmlMap[num];
      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
      const tNodes = xmlDoc.getElementsByTagName('a:t');
      const texts: string[] = [];
      for (let i = 0; i < tNodes.length; i++) {
        const txt = (tNodes[i].textContent || '').trim();
        if (txt) texts.push(txt);
      }
      if (texts.length > 0) {
        slides.push({ slideNum: num, texts });
      }
    }

    return slides.length > 0 ? slides : null;
  } catch (e) {
    console.error('Lỗi khi đọc file pptx:', e);
    return null;
  }
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const generateInlineImageHtml = (dataUrl: string, name: string): string => {
  return `<p><span class="apple-img-wrapper" contenteditable="false" data-media-type="image" style="position: relative; display: inline-flex; line-height: 0; font-size: 0; padding: 0; margin: 6px 0; max-width: 100%; vertical-align: middle; border-radius: 14px; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08); background: transparent;">
    <img src="${dataUrl}" alt="${name}" class="apple-note-inline-img" style="max-width: 320px; max-height: 220px; width: auto; height: auto; object-fit: contain; border-radius: 13px; display: block; margin: 0; padding: 0; border: none; box-shadow: none; vertical-align: top; line-height: 0; cursor: zoom-in;" title="Nhấp để xem ảnh đầy đủ" />
    <button type="button" class="apple-img-delete-btn" style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: rgba(22,22,26,0.52); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 0.5px solid rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; outline: none; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Xóa hình ảnh này"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></button>
  </span></p><p><br></p>`;
};

const generateFileCardHtml = (fileDataUrl: string, fileName: string, ext: string, sizeStr: string): string => {
  const docSvg = getAppleDocSvg(ext);
  let badgeColor = '#0071e3';
  if (ext === 'pdf') { badgeColor = '#e03e2d'; }
  else if (['doc', 'docx'].includes(ext)) { badgeColor = '#2b579a'; }
  else if (['xls', 'xlsx', 'csv'].includes(ext)) { badgeColor = '#217346'; }
  else if (['ppt', 'pptx'].includes(ext)) { badgeColor = '#d24726'; }
  else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) { badgeColor = '#805ad5'; }
  else if (['txt', 'md', 'json'].includes(ext)) { badgeColor = '#718096'; }

  return `<p><span class="apple-file-attachment" contenteditable="false" data-media-type="file" data-file-url="${fileDataUrl}" data-file-name="${fileName}" data-file-ext="${ext}" data-file-size="${sizeStr}" style="display: inline-flex; align-items: center; gap: 10px; padding: 7px 12px; margin: 6px 0; border-radius: 16px; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.08); font-size: 13px; font-weight: 500; text-decoration: none; user-select: none; box-shadow: 0 2px 6px rgba(0,0,0,0.03); vertical-align: middle; max-width: 100%;">
    ${docSvg}
    <span style="display: flex; flex-direction: column; min-width: 0; max-width: 220px; line-height: 1.25;">
      <span style="font-weight: 600; color: #1d1d1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;" title="${fileName}">${fileName}</span>
      <span style="font-size: 10.5px; color: #86868b; font-family: ui-monospace, SFMono-Regular, monospace; margin-top: 1px;">${sizeStr}</span>
    </span>
    <span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;">
      <button type="button" class="apple-file-preview-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,113,227,0.12); color: #0071e3; border: 1px solid rgba(0,113,227,0.2); cursor: pointer; padding: 0; outline: none;" title="Xem trước tệp (Quick Look)"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.5"/></svg></button>
      <a href="${fileDataUrl}" download="${fileName}" class="apple-file-download-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: ${badgeColor}; color: white; border: none; text-decoration: none; cursor: pointer;" title="Tải xuống tệp ${fileName}"><svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v8M3.5 7L7 10.5 10.5 7M2 12h10"/></svg></a>
      <button type="button" class="apple-file-delete-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); cursor: pointer; padding: 0; outline: none;" title="Xóa tệp đính kèm"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></button>
    </span>
  </span></p><p><br></p>`;
};

export const QuickNoteWindow: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    isPinned,
    activeNoteId,
    notes,
    loadNotes,
    closeNote,
    setMinimized,
    togglePinned,
    createNote,
    selectNote,
    updateNote,
    updateActiveNote,
    deleteNote,
    togglePinNote,
    changeColorNote,
  } = useNoteStore();

  const [showSidebar, setShowSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'note' | 'checklist'>('all');
  const [copied, setCopied] = useState(false);
  const [editorMode, setEditorMode] = useState<'text' | 'checklist'>('text');

  // Main reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderDesktop, setReminderDesktop] = useState(true);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderNotifyEmail, setReminderNotifyEmail] = useState(true);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; smtpUser?: string | null; senderName?: string } | null>(null);
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [smtpEmailInput, setSmtpEmailInput] = useState('');
  const [smtpPassInput, setSmtpPassInput] = useState('');
  const [isConfiguringSmtp, setIsConfiguringSmtp] = useState(false);

  // Compact AI dropdown menu
  const [showCompactAiMenu, setShowCompactAiMenu] = useState(false);

  // Individual task reminder popover state
  const [taskReminderPopover, setTaskReminderPopover] = useState<{
    lineIndex: number;
    taskId: string;
    taskText: string;
    reminderAt: string;
    reminderEmail?: string;
    reminderNotifyEmail?: boolean;
  } | null>(null);

  // Set of note IDs that have been unlocked in the current session
  // Set of note IDs that have been unlocked in the current session
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);
  // 6-digit Passcode unlock state
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockShake, setUnlockShake] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  // 6-digit Passcode config modal state
  const [showLockConfigModal, setShowLockConfigModal] = useState(false);
  const [lockNewPassword, setLockNewPassword] = useState('');
  const [lockConfirmPassword, setLockConfirmPassword] = useState('');
  const [showLockNewPassword, setShowLockNewPassword] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mode: Main fixed tab (isCompactWindow === false, default) vs Compact draggable floating window (isCompactWindow === true)
  const [isCompactWindow, setIsCompactWindow] = useState(false);
  const [compactPos, setCompactPos] = useState<{ x: number; y: number } | null>(null);
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: 740,
    height: 560,
  });
  const [compactSize, setCompactSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 480,
  });
  const [isDraggingCompact, setIsDraggingCompact] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);

  const handleToggleCompactMode = () => {
    if (!isCompactWindow) {
      setIsCompactWindow(true);
      setShowSidebar(false);
      if (!compactPos) {
        setCompactPos({
          x: Math.max(16, window.innerWidth - compactSize.width - 24),
          y: Math.max(16, window.innerHeight - compactSize.height - 24),
        });
      }
    } else {
      setIsCompactWindow(false);
    }
  };

  const handleCompactHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    // When in fixed main tab, dragging is locked to keep it firmly docked at the bottom-right corner.
    // Dragging is active when in compact window mode!
    if (!isCompactWindow) return;
    e.preventDefault();
    setIsDraggingCompact(true);
    const currentW = compactSize.width;
    const currentH = compactSize.height;
    const currentX = compactPos ? compactPos.x : Math.max(16, window.innerWidth - currentW - 24);
    const currentY = compactPos ? compactPos.y : Math.max(16, window.innerHeight - currentH - 24);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: currentX,
      posY: currentY,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      const newX = Math.max(8, Math.min(window.innerWidth - 180, dragStartRef.current.posX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        setCompactPos({ x: newX, y: newY });
      });
    };

    const handleMouseUp = () => {
      setIsDraggingCompact(false);
      dragStartRef.current = null;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, direction: 'nw' | 'w' | 'n' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = isCompactWindow ? compactSize.width : windowSize.width;
    const startH = isCompactWindow ? compactSize.height : windowSize.height;
    const currentW = isCompactWindow
      ? compactSize.width
      : (showSidebar ? Math.max(windowSize.width, 740) : windowSize.width);
    const currentPos = compactPos || {
      x: Math.max(16, window.innerWidth - currentW - 24),
      y: Math.max(16, window.innerHeight - (isCompactWindow ? compactSize.height : windowSize.height) - 24),
    };
    const startPosX = currentPos.x;
    const startPosY = currentPos.y;

    const minW = isCompactWindow ? 320 : 540;
    const minH = isCompactWindow ? 360 : 460;
    const fixedRight = startPosX + startW;
    const fixedBottom = startPosY + startH;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        if (isCompactWindow) {
          let targetX = startPosX;
          let targetY = startPosY;
          let targetW = startW;
          let targetH = startH;

          if (direction === 'nw') {
            targetX = Math.max(8, Math.min(fixedRight - minW, startPosX + dx));
            targetY = Math.max(8, Math.min(fixedBottom - minH, startPosY + dy));
            targetW = fixedRight - targetX;
            targetH = fixedBottom - targetY;
          } else if (direction === 'w') {
            targetX = Math.max(8, Math.min(fixedRight - minW, startPosX + dx));
            targetW = fixedRight - targetX;
          } else if (direction === 'n') {
            targetY = Math.max(8, Math.min(fixedBottom - minH, startPosY + dy));
            targetH = fixedBottom - targetY;
          } else if (direction === 'se') {
            targetW = Math.max(minW, Math.min(window.innerWidth - startPosX - 16, startW + dx));
            targetH = Math.max(minH, Math.min(window.innerHeight - startPosY - 16, startH + dy));
          }

          setCompactSize({ width: targetW, height: targetH });
          if (direction === 'nw' || direction === 'w' || direction === 'n') {
            setCompactPos({ x: targetX, y: targetY });
          }
        } else {
          // Docked window pinned to bottom-right (right: 0, bottom: 0)
          let targetW = startW;
          let targetH = startH;

          if (direction === 'nw' || direction === 'w') {
            targetW = Math.max(minW, Math.min(window.innerWidth - 16, startW - dx));
          }
          if (direction === 'nw' || direction === 'n') {
            targetH = Math.max(minH, Math.min(window.innerHeight - 16, startH - dy));
          }

          setWindowSize({ width: targetW, height: targetH });
        }
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Local drafts for instant typing, smooth Vietnamese Telex / IME & zero cursor jumping
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState(''); // Content cho chế độ text
  const [localChecklist, setLocalChecklist] = useState(''); // Content riêng cho checklist
  const localTitleRef = useRef('');
  const localContentRef = useRef('');
  const localChecklistRef = useRef(''); // Ref riêng cho checklist
  const activeNoteIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image & Screenshot states
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<NoteImageAttachment | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [snippingSnapshot, setSnippingSnapshot] = useState<string | null>(null);
  const [filePreviewModal, setFilePreviewModal] = useState<{
    url: string;
    name: string;
    ext: string;
    size: string;
  } | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<{ sheets: ExcelSheetPreview[]; activeSheetIndex: number } | null>(null);
  const [docxPreview, setDocxPreview] = useState<DocxBlock[] | null>(null);
  const [pptxPreview, setPptxPreview] = useState<PptxSlide[] | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [lockConfigMismatch, setLockConfigMismatch] = useState(false);

  // Smart Tags & AI Writing Tools states (In-place draft directly in active note)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showWritingToolsMenu, setShowWritingToolsMenu] = useState(false);
  const [writingToolLoading, setWritingToolLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<{
    action: WritingToolAction;
    title: string;
    result: string;
    usedGemini: boolean;
    isSelectionOnly: boolean;
    originalText: string;
  } | null>(null);
  const [aiDraftCopied, setAiDraftCopied] = useState(false);
  const [selectionState, setSelectionState] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [toolbarCoords, setToolbarCoords] = useState<{
    top: number;
    left: number;
    openMenuUp: boolean;
    maxMenuHeight?: number;
  } | null>(null);
  const [showFloatingAiMenu, setShowFloatingAiMenu] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(getStoredGeminiKey());
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [showApiKeyPassword, setShowApiKeyPassword] = useState(false);
  const [mathAnimatedRowIndex, setMathAnimatedRowIndex] = useState<number | null>(null);

  // Active text formatting states for toolbar highlighting
  const [activeFormats, setActiveFormats] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    heading: boolean;
    bullet: boolean;
    number: boolean;
  }>({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    heading: false,
    bullet: false,
    number: false,
  });

  // Initial load
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];
  const isNoteLocked = Boolean(activeNote?.isLocked && !unlockedNoteIds.includes(activeNote.id));

  // ──────── Auto-extract unique #tags across all notes ────────
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    const regex = /#([a-zA-Z0-9_\u00C0-\u1EF9]+)/g;
    notes.forEach((n) => {
      const text = `${n.title || ''} ${n.content || ''}`;
      let match;
      while ((match = regex.exec(text)) !== null) {
        tagSet.add(match[1].toLowerCase());
      }
    });
    return Array.from(tagSet);
  }, [notes]);

  // ──────── Helper: Chèn HTML trực tiếp vào khung soạn thảo tại con trỏ ────────
  const insertHtmlIntoEditor = useCallback((html: string) => {
    const targetEl = editorRef.current;
    if (!targetEl) return;
    targetEl.focus();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && targetEl.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement('div');
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      let lastNode: ChildNode | null = null;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      // Nếu chưa focus trong editor, thêm vào cuối nội dung
      targetEl.innerHTML = (targetEl.innerHTML || '') + html;
    }

    const updated = targetEl.innerHTML;
    setLocalContent(updated);
    localContentRef.current = updated;
    if (activeNoteIdRef.current) {
      updateNote(activeNoteIdRef.current, { content: updated });
    }
  }, [isMinimized, updateNote]);

  // ──────── Image & Screenshot & File Handlers ────────
  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeNote) return;

    toast.loading('Đang xử lý hình ảnh...', { id: 'note-img-process' });
    try {
      const newAttachments: NoteImageAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const { dataUrl, size } = await compressImageFile(file);
        newAttachments.push({
          id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
          url: dataUrl,
          name: file.name || `Anh_${(activeNote.images?.length || 0) + newAttachments.length + 1}.jpg`,
          size,
          createdAt: new Date().toISOString(),
        });

        // Đẩy ảnh trực tiếp vào khung ghi văn bản (chuẩn tỉ lệ gọn gàng, hỗ trợ nhấn để phóng to & xóa)
        const imgHtml = generateInlineImageHtml(dataUrl, file.name || 'Hình ảnh');
        insertHtmlIntoEditor(imgHtml);

        if (editorMode === 'checklist') {
          const nextChecklist = `${localChecklistRef.current.trim()}\n- [ ] 📷 [Hình ảnh: ${file.name}]`.trim();
          setLocalChecklist(nextChecklist);
          localChecklistRef.current = nextChecklist;
          if (activeNoteIdRef.current) {
            updateNote(activeNoteIdRef.current, { checklistContent: nextChecklist } as any);
          }
        }
      }

      if (newAttachments.length > 0) {
        const currentImages = activeNote.images || [];
        await updateActiveNote({ images: [...currentImages, ...newAttachments] });
        playAppleChime();
        toast.success(`Đã chèn ${newAttachments.length} hình ảnh trực tiếp vào ghi chú!`, { id: 'note-img-process' });
      } else {
        toast.dismiss('note-img-process');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi nạp ảnh', { id: 'note-img-process' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Đính kèm tệp tin đa dạng (PDF, Word, Excel, ZIP, Text, v.v.) và đẩy trực tiếp vào văn bản
  const handlePickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeNote) return;

    toast.loading('Đang xử lý tệp tin...', { id: 'note-file-process' });
    try {
      let attachedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.type.startsWith('image/')) {
          const { dataUrl, size } = await compressImageFile(file);
          const newAttachment: NoteImageAttachment = {
            id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
            url: dataUrl,
            name: file.name,
            size,
            createdAt: new Date().toISOString(),
          };
          const currentImages = activeNote.images || [];
          await updateActiveNote({ images: [...currentImages, newAttachment] });

          const imgHtml = generateInlineImageHtml(dataUrl, file.name);
          insertHtmlIntoEditor(imgHtml);
          attachedCount++;
        } else {
          // File tài liệu
          const fileDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const fileCardHtml = generateFileCardHtml(fileDataUrl, file.name, ext, formatFileSize(file.size));

          insertHtmlIntoEditor(fileCardHtml);

          if (editorMode === 'checklist') {
            const nextChecklist = `${localChecklistRef.current.trim()}\n- [ ] [${ext.toUpperCase()} - ${file.name}] (${formatFileSize(file.size)})`.trim();
            setLocalChecklist(nextChecklist);
            localChecklistRef.current = nextChecklist;
            if (activeNoteIdRef.current) {
              updateNote(activeNoteIdRef.current, { checklistContent: nextChecklist } as any);
            }
          }

          attachedCount++;
        }
      }

      playAppleChime();
      toast.success(`Đã đính kèm ${attachedCount} tệp tin trực tiếp vào văn bản!`, { id: 'note-file-process' });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đính kèm tệp tin', { id: 'note-file-process' });
    } finally {
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  // Launch Snipping Tool with interactive rectangle cropping
  const handleStartSnipping = async () => {
    if (!activeNote) return;
    setIsCapturingScreen(true);
    try {
      toast('Chọn màn hình hoặc cửa sổ để bật công cụ cắt ảnh...', { icon: '✂️', duration: 3500 });
      const snapshot = await captureScreenSnapshot();
      if (!snapshot) {
        setIsCapturingScreen(false);
        return;
      }
      setSnippingSnapshot(snapshot);
    } catch (err: any) {
      toast.error(err.message || 'Không thể mở công cụ chụp màn hình', { id: 'note-capture' });
    } finally {
      setIsCapturingScreen(false);
    }
  };

  const handleSnippingCropComplete = async (croppedDataUrl: string, name?: string, size?: number) => {
    setSnippingSnapshot(null);
    if (!activeNote || !croppedDataUrl) return;

    toast.loading('Đang lưu vùng chụp vào ghi chú...', { id: 'note-crop-save' });
    try {
      const fileName = name || `Snip_${new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-')}.jpg`;
      const newAttachment: NoteImageAttachment = {
        id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
        url: croppedDataUrl,
        name: fileName,
        size: size || Math.round((croppedDataUrl.length * 3) / 4),
        createdAt: new Date().toISOString(),
      };
      const currentImages = activeNote.images || [];
      await updateActiveNote({ images: [...currentImages, newAttachment] });

      // Đẩy ảnh chụp màn hình trực tiếp vào khung soạn thảo văn bản
      const imgHtml = generateInlineImageHtml(croppedDataUrl, fileName);
      insertHtmlIntoEditor(imgHtml);

      if (editorMode === 'checklist') {
        const nextChecklist = `${localChecklistRef.current.trim()}\n- [ ] ✂️ [Ảnh chụp màn hình: ${fileName}]`.trim();
        setLocalChecklist(nextChecklist);
        localChecklistRef.current = nextChecklist;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, { checklistContent: nextChecklist } as any);
        }
      }

      playAppleChime();
      toast.success('✂️ Đã chèn ảnh chụp màn hình vào văn bản ghi chú!', { id: 'note-crop-save' });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu ảnh chụp', { id: 'note-crop-save' });
    }
  };

  // ──────── Apple Intelligence Writing Tools (In-place Draft) ────────
  const handleExecuteWritingTool = async (action: WritingToolAction) => {
    setShowWritingToolsMenu(false);
    setShowCompactAiMenu(false);
    let targetText = extractPlainText(localContent);
    let isSelection = false;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const selectedStr = sel.toString().trim();
      if (selectedStr) {
        targetText = selectedStr;
        isSelection = true;
      }
    }
    if (!targetText.trim()) {
      toast.error('Ghi chú chưa có nội dung để AI xử lý!');
      return;
    }

    setWritingToolLoading(true);
    toast.loading('AI Writing Tool đang tạo bản nháp...', { id: 'ai-writing' });
    try {
      const result = await runWritingTool(targetText, action);
      toast.dismiss('ai-writing');
      playAppleChime();
      const title =
        action === 'summarize'
          ? 'Tóm tắt nội dung ghi chú'
          : action === 'keypoints'
          ? 'Rút ra các ý chính'
          : action === 'professional'
          ? 'Viết phong cách chuyên nghiệp'
          : action === 'concise'
          ? 'Viết ngắn gọn, súc tích'
          : action === 'proofread'
          ? 'Sửa chính tả & câu từ'
          : action === 'expand'
          ? 'Mở rộng & phát triển ý'
          : action === 'action_items'
          ? 'Liệt kê công việc cần làm'
          : action === 'translate_en'
          ? 'Dịch sang tiếng Anh'
          : 'Dịch sang tiếng Việt';
      setAiDraft({
        action,
        title,
        result: result.result,
        usedGemini: result.usedGemini,
        isSelectionOnly: isSelection,
        originalText: targetText,
      });
      toast.success('✨ Đã tạo bản nháp AI trực tiếp trong ghi chú!');
    } catch (err: any) {
      toast.error(err.message || 'Không thể xử lý văn bản', { id: 'ai-writing' });
    } finally {
      setWritingToolLoading(false);
    }
  };

  const handleApplyAiDraft = (mode: 'replace' | 'append') => {
    if (!aiDraft) return;

    if (mode === 'replace') {
      if (editorMode === 'checklist') {
        const newContent = aiDraft.result;
        setLocalContent(newContent);
        localContentRef.current = newContent;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, { content: newContent });
        }
      } else {
        const targetEl = editorRef.current;
        if (targetEl) {
          targetEl.focus();
          if (aiDraft.isSelectionOnly && aiDraft.originalText) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed && targetEl.contains(sel.anchorNode)) {
              document.execCommand('insertText', false, aiDraft.result);
            } else {
              const currentHtml = targetEl.innerHTML;
              if (currentHtml.includes(aiDraft.originalText)) {
                targetEl.innerHTML = currentHtml.replace(aiDraft.originalText, aiDraft.result);
              } else {
                targetEl.innerHTML = ensureHtml(aiDraft.result);
              }
            }
          } else {
            targetEl.innerHTML = ensureHtml(aiDraft.result);
          }
          const updated = targetEl.innerHTML;
          setLocalContent(updated);
          localContentRef.current = updated;
          if (activeNoteIdRef.current) {
            updateNote(activeNoteIdRef.current, { content: updated });
          }
        }
      }
    } else {
      // Append mode
      if (editorMode === 'checklist') {
        const newContent = `${localContent}\n${aiDraft.result}`.trim();
        setLocalContent(newContent);
        localContentRef.current = newContent;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, { content: newContent });
        }
      } else if (editorRef.current) {
        const p = document.createElement('p');
        p.textContent = aiDraft.result;
        editorRef.current.appendChild(p);
        const updated = editorRef.current.innerHTML;
        setLocalContent(updated);
        localContentRef.current = updated;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, { content: updated });
        }
      }
    }

    playAppleChime();
    toast.success('Đã áp dụng bản nháp AI vào ghi chú!');
    setAiDraft(null);
    setAiDraftCopied(false);
    setSelectionState(null);
  };

  const handleCopyAiDraft = async () => {
    if (!aiDraft) return;
    try {
      await navigator.clipboard.writeText(aiDraft.result);
      setAiDraftCopied(true);
      playAppleChime();
      toast.success('Đã sao chép bản nháp AI vào bộ nhớ tạm!');
      setTimeout(() => setAiDraftCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleDiscardAiDraft = () => {
    setAiDraft(null);
    setAiDraftCopied(false);
  };

  // Switch format of CURRENT note between Note and Checklist - 2 content hoàn toàn tách biệt
  const handleSwitchNoteMode = (targetMode: 'note' | 'checklist') => {
    if (!activeNote) return;
    const currentIsChecklist = editorMode === 'checklist' || activeNote.noteType === 'checklist';
    const wantChecklist = targetMode === 'checklist';
    if (currentIsChecklist === wantChecklist) return;

    playPopSound();
    if (wantChecklist) {
      // Switching from Note → Checklist: chỉ đổi mode, dùng localChecklist riêng biệt
      setEditorMode('checklist');
      // Nếu chưa có checklist content thì khởi tạo mặc định
      if (!localChecklistRef.current.trim()) {
        const defaultChecklist = '- [ ] ';
        setLocalChecklist(defaultChecklist);
        localChecklistRef.current = defaultChecklist;
      }
      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, {
          noteType: 'checklist',
          checklistContent: localChecklistRef.current,
        });
      }
      toast.success('Đã chuyển sang Checklist việc cần làm', { id: 'note-mode-toggle', duration: 1800 });
    } else {
      // Switching from Checklist → Note: chỉ đổi mode, dùng localContent text riêng
      setEditorMode('text');
      // Restore nội dung text từ localContentRef (không đụng đến checklist)
      const html = ensureHtml(localContentRef.current || activeNote.content || '');
      if (editorRef.current) editorRef.current.innerHTML = html;
      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, { noteType: 'note' });
      }
      toast.success('Đã chuyển sang Ghi chú văn bản', { id: 'note-mode-toggle', duration: 1800 });
    }
  };

  // Unlock active note with 6-digit PIN auto-verification
  const handleUnlockPasscodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setUnlockPasscode(clean);
    if (unlockError) setUnlockError('');

    if (clean.length === 6 && activeNote) {
      if (clean === activeNote.password) {
        setUnlockedNoteIds((prev) => [...prev, activeNote.id]);
        setUnlockPasscode('');
        setUnlockError('');
        playAppleChime();
        toast.success('Đã mở khóa ghi chú', { id: 'note-unlock-success' });
      } else {
        setUnlockShake(true);
        setUnlockError('Mã PIN không đúng. Vui lòng thử lại!');
        setTimeout(() => {
          setUnlockShake(false);
          setUnlockPasscode('');
          setUnlockError('');
          const input = document.getElementById('note-unlock-pin-hidden') as HTMLInputElement | null;
          input?.focus();
        }, 500);
      }
    }
  };

  const handleUnlockActiveNote = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeNote || !activeNote.password) return;
    if (unlockPasscode === activeNote.password) {
      setUnlockedNoteIds((prev) => [...prev, activeNote.id]);
      setUnlockPasscode('');
      setUnlockError('');
      playAppleChime();
      toast.success('Đã mở khóa ghi chú', { id: 'note-unlock-success' });
    } else {
      setUnlockShake(true);
      setTimeout(() => {
        setUnlockShake(false);
        setUnlockPasscode('');
        setUnlockError('');
        const input = document.getElementById('note-unlock-pin-hidden') as HTMLInputElement | null;
        input?.focus();
      }, 500);
      setUnlockError('Mã PIN không đúng. Vui lòng thử lại!');
    }
  };

  // Lock active note back
  const handleLockActiveNoteImmediately = () => {
    if (!activeNote) return;
    setUnlockedNoteIds((prev) => prev.filter((id) => id !== activeNote.id));
    toast.success('Đã khóa ghi chú', { id: 'note-relocked' });
  };

  const handleOpenLockConfig = () => {
    setLockNewPassword('');
    setLockConfirmPassword('');
    setLockConfigMismatch(false);
    setShowReminderModal(false);
    setTaskReminderPopover(null);
    setShowApiKeySetting(false);
    setShowFloatingAiMenu(false);
    setShowLockConfigModal(true);
  };

  // Save new 6-digit lock passcode
  const handleSaveLockPassword = (customPass?: string, customConfirm?: string) => {
    if (!activeNote) return;
    // Security check: cannot change password if note is currently locked without PIN
    if (activeNote.isLocked && !unlockedNoteIds.includes(activeNote.id)) {
      toast.error('Ghi chú đang bị khóa. Bạn phải mở khóa trước khi đổi mã PIN!');
      return;
    }
    const cleanPass = (customPass !== undefined ? customPass : lockNewPassword).replace(/\D/g, '');
    const cleanConfirm = (customConfirm !== undefined ? customConfirm : lockConfirmPassword).replace(/\D/g, '');
    if (cleanPass.length !== 6) {
      toast.error('Mã PIN phải gồm đúng 6 chữ số (0-9)', { id: 'note-lock-err' });
      return;
    }
    if (cleanPass !== cleanConfirm) {
      setLockConfigMismatch(true);
      toast.error('Mã PIN xác nhận không khớp', { id: 'note-lock-err' });
      setTimeout(() => {
        setLockConfirmPassword('');
        setLockConfigMismatch(false);
        const input = document.getElementById('apple-pin-config-input') as HTMLInputElement | null;
        input?.focus();
      }, 500);
      return;
    }
    updateActiveNote({ isLocked: true, password: cleanPass });
    setUnlockedNoteIds((prev) => [...prev, activeNote.id]);
    setShowLockConfigModal(false);
    setLockNewPassword('');
    setLockConfirmPassword('');
    setLockConfigMismatch(false);
    playAppleChime();
    toast.success('Đã cài mật khẩu 6 số bảo vệ ghi chú thành công!', { id: 'note-lock-set' });
  };

  // Remove lock password
  const handleRemoveLockPassword = () => {
    if (!activeNote) return;
    // Security check: cannot remove password if note is currently locked without PIN
    if (activeNote.isLocked && !unlockedNoteIds.includes(activeNote.id)) {
      toast.error('Ghi chú đang bị khóa. Bạn phải mở khóa trước khi gỡ mã PIN!');
      return;
    }
    updateActiveNote({ isLocked: false, password: '' });
    setUnlockedNoteIds((prev) => prev.filter((id) => id !== activeNote.id));
    setShowLockConfigModal(false);
    toast.success('Đã gỡ bỏ mật khẩu ghi chú', { id: 'note-lock-removed' });
  };

  const handleEditorSelect = useCallback(() => {
    if (!editorRef.current || !canvasRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelectionState(null);
      setToolbarCoords(null);
      setShowFloatingAiMenu(false);
      return;
    }
    const anchor = sel.anchorNode;
    const focus = sel.focusNode;
    if (!editorRef.current.contains(anchor) && !editorRef.current.contains(focus)) {
      setSelectionState(null);
      setToolbarCoords(null);
      setShowFloatingAiMenu(false);
      return;
    }
    const text = sel.toString();
    if (!text.trim()) {
      setSelectionState(null);
      setToolbarCoords(null);
      setShowFloatingAiMenu(false);
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      const selRect = range.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();

      if (selRect.width > 0 || selRect.height > 0) {
        const rects = range.getClientRects();
        const firstRect = rects.length > 0 ? rects[0] : selRect;
        const lastRect = rects.length > 0 ? rects[rects.length - 1] : selRect;

        const toolbarHeight = 40;
        const toolbarHalfWidth = 145;

        // Ưu tiên 1: Đặt phía trên dòng đầu tiên của vùng chọn
        let top = firstRect.top - canvasRect.top - toolbarHeight - 8;
        let centerX = firstRect.left + firstRect.width / 2 - canvasRect.left;

        // Nếu không đủ chỗ phía trên dòng đầu tiên (sát mép trên của editor)
        if (top < 4) {
          // Thử đặt phía dưới dòng cuối cùng của vùng chọn nếu vừa với khung
          const belowBottom = lastRect.bottom - canvasRect.top + 8;
          if (belowBottom + toolbarHeight <= canvasRect.height - 4) {
            top = belowBottom;
            centerX = lastRect.left + lastRect.width / 2 - canvasRect.left;
          } else {
            // Vùng chọn phủ dài từ trên xuống dưới toàn bộ khung: Đặt lơ lửng ngay phía trên canvas để TUYỆT ĐỐI không che chữ đang đọc
            top = -toolbarHeight - 6;
            centerX = canvasRect.width / 2;
          }
        }

        // Clamp horizontal position so toolbar doesn't overflow container
        const left = Math.max(
          toolbarHalfWidth + 12,
          Math.min(canvasRect.width - toolbarHalfWidth - 12, centerX)
        );

        // Tính khoảng trống thực tế trong canvas phía trên và phía dưới
        const spaceAbove = top;
        const spaceBelow = canvasRect.height - (top + toolbarHeight);

        // Ưu tiên hướng có nhiều không gian hơn và không bị che khuất
        const openMenuUp = top >= 200 || (spaceAbove > spaceBelow && top >= 140);
        const maxMenuHeight = openMenuUp
          ? Math.max(130, Math.min(260, Math.max(130, top - 8)))
          : Math.max(130, Math.min(260, Math.max(130, spaceBelow - 8)));

        setToolbarCoords({ top, left, openMenuUp, maxMenuHeight });
        setSelectionState({ text, start: 0, end: text.length });

        // Query active formatting states on current selection
        try {
          const bold = document.queryCommandState('bold');
          const italic = document.queryCommandState('italic');
          const underline = document.queryCommandState('underline');
          const strike = document.queryCommandState('strikeThrough');
          const bullet = document.queryCommandState('insertUnorderedList');
          const number = document.queryCommandState('insertOrderedList');
          const anchor = sel?.anchorNode;
          const el = anchor instanceof Element ? anchor : anchor?.parentElement;
          const heading = !!el?.closest('h2, h1');
          setActiveFormats({ bold, italic, underline, strike, heading, bullet, number });
        } catch (_) {}

        return;
      }
    } catch (_) {}

    // Check formatting even for collapsed caret
    try {
      const bold = document.queryCommandState('bold');
      const italic = document.queryCommandState('italic');
      const underline = document.queryCommandState('underline');
      const strike = document.queryCommandState('strikeThrough');
      const bullet = document.queryCommandState('insertUnorderedList');
      const number = document.queryCommandState('insertOrderedList');
      const sel = window.getSelection();
      const anchor = sel?.anchorNode;
      const el = anchor instanceof Element ? anchor : anchor?.parentElement;
      const heading = !!el?.closest('h2, h1');
      setActiveFormats({ bold, italic, underline, strike, heading, bullet, number });
    } catch (_) {}

    setSelectionState(null);
    setToolbarCoords(null);
    setShowFloatingAiMenu(false);
  }, []);

  // Listen to document selectionchange for real-time tracking
  useEffect(() => {
    document.addEventListener('selectionchange', handleEditorSelect);
    return () => {
      document.removeEventListener('selectionchange', handleEditorSelect);
    };
  }, [handleEditorSelect]);

  const handleApplyFormat = (
    format: 'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number' | 'heading'
  ) => {
    const targetEl = editorRef.current;
    if (!targetEl) return;
    targetEl.focus();

    switch (format) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'underline':
        document.execCommand('underline', false);
        break;
      case 'strike':
        document.execCommand('strikeThrough', false);
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList', false);
        break;
      case 'number':
        document.execCommand('insertOrderedList', false);
        break;
      case 'heading': {
        const sel = window.getSelection();
        const anchor = sel?.anchorNode;
        const el = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (el?.closest('h2, h1')) {
          document.execCommand('formatBlock', false, '<p>');
        } else {
          document.execCommand('formatBlock', false, '<h2>');
        }
        break;
      }
    }

    // Refresh active formatting state immediately
    try {
      const bold = document.queryCommandState('bold');
      const italic = document.queryCommandState('italic');
      const underline = document.queryCommandState('underline');
      const strike = document.queryCommandState('strikeThrough');
      const bullet = document.queryCommandState('insertUnorderedList');
      const number = document.queryCommandState('insertOrderedList');
      const sel = window.getSelection();
      const anchor = sel?.anchorNode;
      const el = anchor instanceof Element ? anchor : anchor?.parentElement;
      const heading = !!el?.closest('h2, h1');
      setActiveFormats({ bold, italic, underline, strike, heading, bullet, number });
    } catch (_) {}

    const updatedHtml = targetEl.innerHTML;
    setLocalContent(updatedHtml);
    localContentRef.current = updatedHtml;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateActiveNote({ content: updatedHtml });
    }, 300);
    playPopSound();
  };

  const handleExecuteSelectedWritingTool = async (action: WritingToolAction) => {
    if (!selectionState || !selectionState.text.trim()) return;
    const targetText = selectionState.text.trim();
    setWritingToolLoading(true);
    setShowFloatingAiMenu(false);
    toast.loading('AI Writing Tool đang tạo bản nháp...', { id: 'ai-writing' });
    try {
      const result = await runWritingTool(targetText, action);
      playAppleChime();
      const title =
        action === 'summarize'
          ? 'Tóm tắt đoạn văn bản'
          : action === 'keypoints'
          ? 'Rút ra các ý chính'
          : action === 'professional'
          ? 'Viết lại chuyên nghiệp'
          : action === 'concise'
          ? 'Viết ngắn gọn, súc tích'
          : action === 'proofread'
          ? 'Sửa chính tả & câu từ'
          : action === 'expand'
          ? 'Mở rộng & phát triển ý'
          : action === 'action_items'
          ? 'Liệt kê công việc cần làm'
          : action === 'translate_en'
          ? 'Dịch sang tiếng Anh'
          : 'Dịch sang tiếng Việt';
      setAiDraft({
        action,
        title,
        result: result.result,
        usedGemini: result.usedGemini,
        isSelectionOnly: true,
        originalText: targetText,
      });
      toast.dismiss('ai-writing');
      toast.success('✨ Đã tạo bản nháp AI trực tiếp trong ghi chú!');
    } catch (err: any) {
      toast.error(err.message || 'Không thể xử lý văn bản', { id: 'ai-writing' });
    } finally {
      setWritingToolLoading(false);
    }
  };

  // Close AI Draft on Escape
  useEffect(() => {
    if (!aiDraft) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAiDraft(null);
        setAiDraftCopied(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiDraft]);

  const handleDeleteImage = async (imageId?: string, imageUrl?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeNote) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // 1. Lọc trong mảng activeNote.images
    const currentImages = activeNote.images || [];
    const updatedImages = currentImages.filter(
      (img) => (imageId ? img.id !== imageId : true) && (imageUrl ? img.url !== imageUrl : true)
    );

    // 2. Xóa phần tử hình ảnh trong editor DOM
    if (editorRef.current) {
      const imgs = Array.from(editorRef.current.querySelectorAll('img'));
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || '';
        const matches = (imageUrl && (src === imageUrl || src.includes(imageUrl.substring(0, 80)))) ||
                        (imageId && img.getAttribute('data-image-id') === imageId);
        if (matches) {
          const wrapper = img.closest('.apple-img-wrapper') || img;
          const parentP = wrapper.closest('p');
          if (parentP && (parentP.children.length <= 1 || parentP.textContent?.trim() === '')) {
            parentP.remove();
          } else {
            wrapper.remove();
          }
        }
      });
    }

    let updatedHtml = editorRef.current?.innerHTML;
    if (updatedHtml === undefined || (imageUrl && updatedHtml.includes(imageUrl))) {
      let cur = localContentRef.current || activeNote.content || '';
      if (imageUrl) {
        cur = cur.replace(new RegExp(`<p>[^<]*<span class=["']apple-img-wrapper["'][^>]*>[\\s\\S]*?src=["']${escapeRegex(imageUrl)}["'][\\s\\S]*?<\\/span>[^<]*<\\/p>`, 'g'), '');
        cur = cur.replace(new RegExp(`<span class=["']apple-img-wrapper["'][^>]*>[\\s\\S]*?src=["']${escapeRegex(imageUrl)}["'][\\s\\S]*?<\\/span>`, 'g'), '');
        cur = cur.replace(new RegExp(`<p>[^<]*<img[^>]*src=["']${escapeRegex(imageUrl)}["'][^>]*>[^<]*<\\/p>`, 'g'), '');
        cur = cur.replace(new RegExp(`<img[^>]*src=["']${escapeRegex(imageUrl)}["'][^>]*>`, 'g'), '');
      }
      updatedHtml = cur;
    }

    setLocalContent(updatedHtml);
    localContentRef.current = updatedHtml;

    if (activeNoteIdRef.current) {
      await updateNote(activeNoteIdRef.current, { images: updatedImages, content: updatedHtml });
    }
    playPopSound();
    toast.success('Đã xóa hình ảnh khỏi ghi chú', { id: 'note-img-del' });
  };

  const handleDeleteFileFromPreview = (fileUrl: string, fileName?: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (editorRef.current) {
      const attachments = Array.from(editorRef.current.querySelectorAll('.apple-file-attachment'));
      attachments.forEach((badge) => {
        const u = badge.getAttribute('data-file-url');
        const n = badge.getAttribute('data-file-name');
        if ((fileUrl && u === fileUrl) || (fileName && n === fileName)) {
          const parentP = badge.closest('p');
          if (parentP && (parentP.children.length <= 1 || parentP.textContent?.trim() === badge.textContent?.trim())) {
            parentP.remove();
          } else {
            badge.remove();
          }
        }
      });
    }

    let updatedHtml = editorRef.current?.innerHTML;
    if (updatedHtml === undefined || (fileUrl && updatedHtml.includes(fileUrl))) {
      let cur = localContentRef.current || activeNote?.content || '';
      if (fileUrl) {
        cur = cur.replace(new RegExp(`<p>[^<]*<span class=["']apple-file-attachment["'][^>]*data-file-url=["']${escapeRegex(fileUrl)}["'][\\s\\S]*?<\\/span>[^<]*<\\/p>`, 'g'), '');
        cur = cur.replace(new RegExp(`<span class=["']apple-file-attachment["'][^>]*data-file-url=["']${escapeRegex(fileUrl)}["'][\\s\\S]*?<\\/span>`, 'g'), '');
      }
      updatedHtml = cur;
    }

    setLocalContent(updatedHtml);
    localContentRef.current = updatedHtml;
    if (activeNoteIdRef.current) {
      updateNote(activeNoteIdRef.current, { content: updatedHtml });
    }
    setFilePreviewModal(null);
    playPopSound();
    toast.success('Đã xóa tệp tin khỏi ghi chú!', { id: 'file-del-modal' });
  };

  const handleCopyImage = async (img: NoteImageAttachment) => {
    const ok = await copyImageToClipboard(img.url);
    if (ok) {
      toast.success('Đã sao chép ảnh vào bộ nhớ tạm!', { id: 'note-img-copy' });
    } else {
      toast.error('Trình duyệt chưa hỗ trợ sao chép ảnh trực tiếp, bạn hãy tải ảnh về máy!', { id: 'note-img-copy' });
    }
  };

  // Listen for Ctrl+V paste containing images
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (!isOpen || isMinimized || !activeNote) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        toast.loading('Đang dán ảnh từ clipboard...', { id: 'note-img-paste' });
        try {
          const newAttachments: NoteImageAttachment[] = [];
          for (const f of imageFiles) {
            const { dataUrl, size } = await compressImageFile(f);
            newAttachments.push({
              id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
              url: dataUrl,
              name: f.name || `Anh_dan_${new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-')}.jpg`,
              size,
              createdAt: new Date().toISOString(),
            });

            // Đẩy ảnh dán trực tiếp vào khung soạn thảo văn bản
            const imgHtml = generateInlineImageHtml(dataUrl, f.name || 'Hình ảnh dán');
            insertHtmlIntoEditor(imgHtml);
          }
          const currentImages = activeNote.images || [];
          await updateActiveNote({ images: [...currentImages, ...newAttachments] });
          playAppleChime();
          toast.success(`Đã dán ${newAttachments.length} hình ảnh vào ghi chú!`, { id: 'note-img-paste' });
        } catch (err: any) {
          toast.error(err.message || 'Lỗi khi dán hình ảnh', { id: 'note-img-paste' });
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, isMinimized, activeNote, updateActiveNote, insertHtmlIntoEditor]);

  // Load and parse in-app file preview when filePreviewModal changes
  useEffect(() => {
    if (!filePreviewModal) {
      setPreviewTextContent(null);
      setExcelPreview(null);
      setDocxPreview(null);
      setPptxPreview(null);
      setIsPreviewLoading(false);
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }

    const ext = filePreviewModal.ext.toLowerCase();
    setIsPreviewLoading(true);

    // Create a native blob URL for PDF, audio, video, etc.
    let bUrl: string | null = null;
    try {
      if (filePreviewModal.url.startsWith('data:')) {
        const blob = dataUrlToBlob(filePreviewModal.url);
        bUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(bUrl);
      } else {
        setPreviewBlobUrl(filePreviewModal.url);
      }
    } catch {
      setPreviewBlobUrl(filePreviewModal.url);
    }

    if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'log', 'xml', 'yaml', 'yml'].includes(ext)) {
      setPreviewTextContent(decodeDataUrlText(filePreviewModal.url));
      setIsPreviewLoading(false);
    } else if (['xlsx', 'xls'].includes(ext)) {
      const data = parseExcelFromDataUrl(filePreviewModal.url);
      setExcelPreview(data);
      setIsPreviewLoading(false);
    } else if (['docx'].includes(ext)) {
      parseDocxFromDataUrl(filePreviewModal.url).then((res) => {
        setDocxPreview(res);
        setIsPreviewLoading(false);
      }).catch(() => {
        setIsPreviewLoading(false);
      });
    } else if (['pptx'].includes(ext)) {
      parsePptxFromDataUrl(filePreviewModal.url).then((res) => {
        setPptxPreview(res);
        setIsPreviewLoading(false);
      }).catch(() => {
        setIsPreviewLoading(false);
      });
    } else {
      setIsPreviewLoading(false);
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFilePreviewModal(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      if (bUrl) {
        URL.revokeObjectURL(bUrl);
      }
    };
  }, [filePreviewModal]);

  // Active note images and carousel navigation
  const noteImages = activeNote?.images || [];
  const currentImageIndex = lightboxImage ? noteImages.findIndex((img) => img.id === lightboxImage.id) : -1;

  const handlePrevImage = useCallback(() => {
    if (noteImages.length <= 1 || currentImageIndex === -1) return;
    const prevIdx = (currentImageIndex - 1 + noteImages.length) % noteImages.length;
    setLightboxImage(noteImages[prevIdx]);
    setLightboxZoom(1);
  }, [noteImages, currentImageIndex]);

  const handleNextImage = useCallback(() => {
    if (noteImages.length <= 1 || currentImageIndex === -1) return;
    const nextIdx = (currentImageIndex + 1) % noteImages.length;
    setLightboxImage(noteImages[nextIdx]);
    setLightboxZoom(1);
  }, [noteImages, currentImageIndex]);

  // Keyboard controls for Lightbox (Escape, ArrowLeft, ArrowRight, Zoom)
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setLightboxImage(null);
        setLightboxZoom(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setLightboxZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-') {
        e.preventDefault();
        setLightboxZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
      } else if (e.key === '0') {
        e.preventDefault();
        setLightboxZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [lightboxImage, handlePrevImage, handleNextImage]);

  // Auto-dismiss Writing Tools menu on outside click
  useEffect(() => {
    if (!showWritingToolsMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.writing-tools-container')) {
        setShowWritingToolsMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showWritingToolsMenu]);

  // Flush current draft immediately to persistent store using specific note id
  const savePendingDraft = useCallback(
    (targetId?: string | null) => {
      const noteId = targetId || activeNoteIdRef.current;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (noteId) {
        const current = notes.find((n) => n.id === noteId);
        const newTitle = localTitleRef.current;
        const newContent = localContentRef.current;
        // Only trigger update if content or title actually changed
        if (current && (current.title !== newTitle || current.content !== newContent)) {
          updateNote(noteId, {
            title: newTitle,
            content: newContent,
          });
        }
      }
    },
    [notes, updateNote]
  );

  const handleCreateNewNote = async (type: 'note' | 'checklist' = 'note') => {
    savePendingDraft(activeNoteIdRef.current);
    // Auto-sync filter so new note is immediately visible in sidebar
    if (type === 'note' && typeFilter === 'checklist') {
      setTypeFilter('note');
    } else if (type === 'checklist' && typeFilter === 'note') {
      setTypeFilter('checklist');
    }
    await createNote(type);
  };

  const handleSetTypeFilter = (filter: 'all' | 'note' | 'checklist') => {
    setTypeFilter(filter);
    if (filter === 'all') return;

    // Check if active note matches the new filter; if not, switch to first matching note
    if (activeNote) {
      const isChecklist =
        activeNote.noteType === 'checklist' ||
        (/^-\s*\[([ xX])\]/m.test(activeNote.content) && activeNote.noteType !== 'note');
      const isMatch = filter === 'note' ? !isChecklist : isChecklist;
      if (isMatch) return;
    }

    const matching = notes.find((n) => {
      const isChecklist =
        n.noteType === 'checklist' ||
        (/^-\s*\[([ xX])\]/m.test(n.content) && n.noteType !== 'note');
      return filter === 'note' ? !isChecklist : isChecklist;
    });

    if (matching) {
      savePendingDraft(activeNoteIdRef.current);
      selectNote(matching.id);
    }
  };

  const handleSelectNote = (id: string) => {
    if (id === activeNote?.id) return;
    savePendingDraft(activeNoteIdRef.current);
    setUnlockedNoteIds([]); // Relock tất cả khi chuyển sang note khác
    selectNote(id);
  };

  const handleCloseNote = () => {
    savePendingDraft(activeNoteIdRef.current);
    setUnlockedNoteIds([]); // Relock tất cả ghi chú khi đóng cửa sổ
    activeNoteIdRef.current = null;
    closeNote();
  };

  // Mutual modal logic: prevent overlapping popovers
  const handleToggleApiKeySetting = () => {
    if (showApiKeySetting) {
      setShowApiKeySetting(false);
    } else {
      setShowReminderModal(false);
      setTaskReminderPopover(null);
      setShowFloatingAiMenu(false);
      setShowLockConfigModal(false);
      setGeminiApiKeyInput(getStoredGeminiKey());
      setShowApiKeySetting(true);
    }
  };

  // Sync local draft when active note switches
  useEffect(() => {
    if (activeNote) {
      if (activeNoteIdRef.current !== activeNote.id) {
        if (activeNoteIdRef.current) {
          savePendingDraft(activeNoteIdRef.current);
        }
        activeNoteIdRef.current = activeNote.id;
        const initialTitle = activeNote.title || '';
        const initialContent = activeNote.content || '';
        const initialChecklist = (activeNote as any).checklistContent || '';

        setLocalTitle(initialTitle);
        localTitleRef.current = initialTitle;

        const isChecklist =
          activeNote.noteType === 'checklist' ||
          (/^-\s*\[([ xX])\]/m.test(initialContent) && activeNote.noteType !== 'note');

        if (isChecklist) {
          setEditorMode('checklist');
          // Load checklist content từ checklistContent field, fallback về content
          const checklistData = initialChecklist || initialContent;
          setLocalChecklist(checklistData);
          localChecklistRef.current = checklistData;
          // Vẫn giữ localContent là content text (nếu có)
          // Không load checklist vào localContent nữa
          setLocalContent('');
          localContentRef.current = '';
        } else {
          setEditorMode('text');
          const html = ensureHtml(initialContent);
          setLocalContent(html);
          localContentRef.current = html;
          // Load checklistContent nếu có vào localChecklist
          setLocalChecklist(initialChecklist);
          localChecklistRef.current = initialChecklist;
          if (editorRef.current) {
            editorRef.current.innerHTML = html;
          }
        }

        // Sync note-level reminder state
        if (activeNote.reminderAt) {
          try {
            const d = new Date(activeNote.reminderAt);
            setReminderDate(toDatetimeLocal(d));
          } catch (_) {
            setReminderDate('');
          }
        } else {
          setReminderDate('');
        }
        setReminderDesktop(activeNote.reminderNotifyDesktop ?? true);
      }
    }
  }, [activeNote, savePendingDraft]);

  // Ensure editorRef.current has the content when mounted, switching to text mode, or active note changes
  useEffect(() => {
    if (isOpen && editorMode === 'text' && editorRef.current) {
      const source = localContentRef.current || activeNote?.content || '';
      const html = ensureHtml(source);
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
      }
    }
  }, [isOpen, editorMode, activeNote?.id]);

  // Clean up and flush draft on unmount
  useEffect(() => {
    return () => {
      savePendingDraft(activeNoteIdRef.current);
    };
  }, [savePendingDraft]);

  // Filter notes by search, type filter & smart tags, with pinned notes always prioritized on top
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        const isChecklist =
          n.noteType === 'checklist' ||
          (/^-\s*\[([ xX])\]/m.test(n.content) && n.noteType !== 'note');

        if (typeFilter === 'note' && isChecklist) return false;
        if (typeFilter === 'checklist' && !isChecklist) return false;

        if (activeTagFilter) {
          const text = `${n.title || ''} ${n.content || ''}`.toLowerCase();
          if (!text.includes(`#${activeTagFilter.toLowerCase()}`)) return false;
        }
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          (n.title || '').toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aPinned = Boolean(a.pinned);
        const bPinned = Boolean(b.pinned);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, typeFilter, activeTagFilter, searchTerm]);

  const countNotes = notes.filter(
    (n) =>
      !(
        n.noteType === 'checklist' ||
        (/^-\s*\[([ xX])\]/m.test(n.content) && n.noteType !== 'note')
      )
  ).length;

  const countChecklists = notes.filter(
    (n) =>
      n.noteType === 'checklist' ||
      (/^-\s*\[([ xX])\]/m.test(n.content) && n.noteType !== 'note')
  ).length;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    localTitleRef.current = val;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, { title: val });
      }
    }, 250);
  };

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const html = target.innerHTML;
    setLocalContent(html);
    localContentRef.current = html;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, { content: html });
      }
    }, 300);

    const nativeEvent = e.nativeEvent as InputEvent;
    const isTypingEqual = nativeEvent?.data === '=';
    const isDeleting = nativeEvent?.inputType?.startsWith('delete');

    if (isTypingEqual && !isDeleting) {
      const sel = window.getSelection();
      if (sel && sel.focusNode) {
        const text = sel.focusNode.textContent || '';
        const offset = sel.focusOffset;
        const textBefore = text.substring(0, offset);

        const mathRes = tryCalculateInlineMath(textBefore, textBefore.length);
        if (mathRes) {
          const resultHtml = `<span class="apple-math-result-badge">&nbsp;${mathRes.resultStr}&nbsp;</span>&nbsp;`;
          document.execCommand('insertHTML', false, resultHtml);
          playPopSound();
          toast.success(`🧮 ${mathRes.matchedExpr} = ${mathRes.resultStr}`, {
            id: 'math-notes',
            duration: 2500,
          });
          const updated = target.innerHTML;
          setLocalContent(updated);
          updateActiveNote({ content: updated });
        }
      }
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (text && !e.clipboardData.types.includes('Files')) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
    }
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      '.apple-file-delete-btn, .apple-img-delete-btn, .apple-img-zoom-btn, .apple-file-preview-btn, .apple-img-download-btn, .apple-file-download-btn'
    );
    if (isInteractive) {
      // Ngăn browser contenteditable selection can thiệp làm mất sự kiện click
      e.stopPropagation();
    }
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Nhấp vào nút Xóa tệp đính kèm (✕)
    const fileDeleteBtn = target.closest('.apple-file-delete-btn');
    if (fileDeleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const badge = fileDeleteBtn.closest('.apple-file-attachment') as HTMLElement | null;
      if (badge) {
        const fileName = badge.getAttribute('data-file-name') || 'tệp đính kèm';
        const parentP = badge.closest('p');
        if (parentP && (parentP.children.length <= 1 || parentP.textContent?.trim() === badge.textContent?.trim())) {
          parentP.remove();
        } else {
          badge.remove();
        }
        const updated = editorRef.current?.innerHTML || '';
        setLocalContent(updated);
        localContentRef.current = updated;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, { content: updated });
        }
        playPopSound();
        toast.success(`Đã xóa tệp "${fileName}" khỏi ghi chú!`, { id: 'file-del-badge' });
      }
      return;
    }

    // 2. Nhấp vào nút Xóa nhanh hình ảnh trực tiếp (✕) - 1 CLICK XÓA NGAY KHÔNG CẦN PHÓNG TO
    const imgDeleteBtn = target.closest('.apple-img-delete-btn');
    if (imgDeleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const wrapper = imgDeleteBtn.closest('.apple-img-wrapper') || imgDeleteBtn.parentElement;
      const imgEl = wrapper?.querySelector('img');
      const imgSrc = imgEl?.getAttribute('src') || '';
      const imgAlt = imgEl?.getAttribute('alt') || 'hình ảnh';

      if (wrapper) {
        const parentP = wrapper.closest('p');
        if (parentP && (parentP.children.length <= 1 || parentP.textContent?.trim() === '')) {
          parentP.remove();
        } else {
          wrapper.remove();
        }
      }
      const updatedHtml = editorRef.current?.innerHTML || '';
      setLocalContent(updatedHtml);
      localContentRef.current = updatedHtml;

      // Đồng thời gỡ khỏi danh sách activeNote.images
      let updatedImages = activeNote?.images || [];
      if (imgSrc) {
        updatedImages = updatedImages.filter((img) => img.url !== imgSrc);
      }
      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, { content: updatedHtml, images: updatedImages });
      }
      playPopSound();
      toast.success(`Đã xóa ${imgAlt} khỏi ghi chú!`, { id: 'img-del-inline' });
      return;
    }

    // 3. Nhấp vào nút Phóng to ảnh (🔍) trên thanh tác vụ ảnh
    const imgZoomBtn = target.closest('.apple-img-zoom-btn');
    if (imgZoomBtn) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = imgZoomBtn.closest('.apple-img-wrapper') || imgZoomBtn.parentElement;
      const imgEl = wrapper?.querySelector('img');
      const src = imgEl?.getAttribute('src') || '';
      const alt = imgEl?.getAttribute('alt') || 'Ảnh chi tiết';
      if (src) {
        const matched = activeNote?.images?.find((img) => img.url === src);
        setLightboxImage({
          id: matched?.id || ('img_zoom_' + Date.now()),
          url: src,
          name: matched?.name || alt,
          size: matched?.size,
          createdAt: matched?.createdAt || new Date().toISOString(),
        });
        setLightboxZoom(1);
        playPopSound();
      }
      return;
    }

    // 4. Nhấp vào nút Xem trước (Preview) hoặc click vào thẻ tệp đính kèm
    const previewBtn = target.closest('.apple-file-preview-btn');
    const badge = target.closest('.apple-file-attachment') as HTMLElement | null;
    if (previewBtn || (badge && !target.closest('.apple-file-delete-btn') && !target.closest('a'))) {
      const targetBadge = badge || (previewBtn?.closest('.apple-file-attachment') as HTMLElement | null);
      if (targetBadge) {
        e.preventDefault();
        e.stopPropagation();
        const url = targetBadge.getAttribute('data-file-url') || targetBadge.querySelector('a')?.getAttribute('href') || '';
        const name = targetBadge.getAttribute('data-file-name') || targetBadge.querySelector('a')?.getAttribute('download') || 'Tệp đính kèm';
        const ext = targetBadge.getAttribute('data-file-ext') || name.split('.').pop()?.toLowerCase() || '';
        const size = targetBadge.getAttribute('data-file-size') || '';
        if (url) {
          setFilePreviewModal({ url, name, ext, size });
          playPopSound();
        }
      }
      return;
    }

    // 5. Nhấp vào ảnh để phóng to Lightbox (loại trừ khi bấm trúng các nút tác vụ xóa/phóng to/tải về)
    const imgEl = target.closest('img');
    if (
      imgEl &&
      editorRef.current?.contains(imgEl) &&
      !target.closest('.apple-img-delete-btn') &&
      !target.closest('.apple-img-zoom-btn') &&
      !target.closest('.apple-img-download-btn')
    ) {
      e.preventDefault();
      e.stopPropagation();
      const src = imgEl.getAttribute('src') || '';
      const alt = imgEl.getAttribute('alt') || 'Ảnh chi tiết';
      if (src) {
        const matched = activeNote?.images?.find((img) => img.url === src);
        setLightboxImage({
          id: matched?.id || ('img_zoom_' + Date.now()),
          url: src,
          name: matched?.name || alt,
          size: matched?.size,
          createdAt: matched?.createdAt || new Date().toISOString(),
        });
        setLightboxZoom(1);
        playPopSound();
      }
      return;
    }
  };

  // ──────── Parse Checklist Rows & match taskReminders ────────
  const checklistRows: ChecklistRow[] = useMemo(() => {
    // Dùng localChecklist riêng biệt, không dùng localContent
    const plain = extractPlainText(localChecklist);
    const lines = plain.split('\n');
    const rows: ChecklistRow[] = [];
    const taskReminders = activeNote?.taskReminders || [];

    lines.forEach((line, idx) => {
      const match = line.match(/^(?:-\s*)?\[([ xX])\]\s*(.*)$/);
      if (match) {
        const taskText = match[2];
        const trimmed = taskText.trim();
        // Match primarily by trimmed task text, or by task id
        const reminder = taskReminders.find(
          (tr) => (tr.taskText.trim() === trimmed || tr.id === `task-${idx}`) && !tr.reminderCompleted
        );
        const taskId = reminder ? reminder.id : `task-${idx}-${Date.now()}`;

        rows.push({
          lineIndex: idx,
          taskId,
          completed: match[1].toLowerCase() === 'x',
          text: taskText,
          reminderAt: reminder?.reminderAt || null,
        });
      }
    });
    return rows;
  }, [localChecklist, activeNote?.taskReminders]);

  const checklistTotal = checklistRows.length;
  const checklistCompleted = checklistRows.filter((r) => r.completed).length;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
  const activeTaskRemindersCount = (activeNote?.taskReminders || []).filter((tr) => !tr.reminderCompleted).length;

  // Toggle single checklist row directly in note
  const handleToggleChecklistRow = (lineIndex: number) => {
    playPopSound();
    const lines = localChecklist.split('\n');
    const targetLine = lines[lineIndex];
    if (!targetLine) return;

    const match = targetLine.match(/^(?:-\s*)?\[([ xX])\]\s*(.*)$/);
    if (match) {
      const isCurrentlyChecked = match[1].toLowerCase() === 'x';
      const newCheck = isCurrentlyChecked ? ' ' : 'x';
      lines[lineIndex] = `- [${newCheck}] ${match[2]}`;
      const newContent = lines.join('\n');
      setLocalChecklist(newContent);
      localChecklistRef.current = newContent;
      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, { checklistContent: newContent } as any);
      }
    }
  };

  // Update text of single checklist row with synchronized reminder tracking & Math Notes
  const handleUpdateChecklistRowText = (lineIndex: number, newText: string) => {
    const lines = localChecklist.split('\n');
    const targetLine = lines[lineIndex];
    if (!targetLine) return;

    const match = targetLine.match(/^(?:-\s*)?\[([ xX])\]\s*(.*)$/);
    if (match) {
      // Calculate inline math if user just typed '='
      const isTypingEqual = newText.endsWith('=') && newText.length > (match[2] || '').length;
      let finalText = newText;
      if (isTypingEqual) {
        const mathRes = tryCalculateInlineMath(newText, newText.length);
        if (mathRes) {
          finalText = mathRes.newText;
          setMathAnimatedRowIndex(lineIndex);
          setTimeout(() => setMathAnimatedRowIndex(null), 1200);
          playPopSound();
          toast.success(`🧮 ${mathRes.matchedExpr} = ${mathRes.resultStr}`, { id: 'math-notes-row', duration: 2500 });
        }
      }

      const oldTrimmed = match[2].trim();
      const nextTrimmed = finalText.trim();
      lines[lineIndex] = `- [${match[1]}] ${finalText}`;
      const newContent = lines.join('\n');
      setLocalChecklist(newContent);
      localChecklistRef.current = newContent;

      // Seamlessly keep active reminder bound to updated task text
      let updatedReminders = activeNote?.taskReminders || [];
      if (oldTrimmed && nextTrimmed && oldTrimmed !== nextTrimmed) {
        updatedReminders = updatedReminders.map((tr) => {
          if (tr.taskText.trim() === oldTrimmed) {
            return { ...tr, taskText: nextTrimmed };
          }
          return tr;
        });
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, { checklistContent: newContent, taskReminders: updatedReminders } as any);
        }
      }, 300);
    }
  };

  // Delete single checklist row & cleanly purge only its associated reminder
  const handleDeleteChecklistRow = (lineIndex: number) => {
    const lines = localChecklist.split('\n');
    const targetLine = lines[lineIndex];
    let deletedText = '';
    if (targetLine) {
      const match = targetLine.match(/^(?:-\s*)?\[([ xX])\]\s*(.*)$/);
      if (match) deletedText = match[2].trim();
    }
    lines.splice(lineIndex, 1);
    const newContent = lines.join('\n');
    setLocalChecklist(newContent);
    localChecklistRef.current = newContent;

    // Clean up task reminder for this deleted row by text and row id
    const currentReminders = activeNote?.taskReminders || [];
    const filteredReminders = deletedText
      ? currentReminders.filter((tr) => tr.taskText.trim() !== deletedText)
      : currentReminders;

    if (activeNoteIdRef.current) {
      updateNote(activeNoteIdRef.current, { checklistContent: newContent, taskReminders: filteredReminders } as any);
    }
  };

  // Insert a new checklist row below lineIndex or at end
  const handleInsertChecklistRowAfter = (lineIndex?: number) => {
    const lines = localChecklist.split('\n');
    if (lineIndex !== undefined && lineIndex >= 0) {
      lines.splice(lineIndex + 1, 0, '- [ ] ');
    } else {
      if (lines.length === 1 && lines[0].trim() === '') {
        lines[0] = '- [ ] ';
      } else {
        lines.push('- [ ] ');
      }
    }
    const newContent = lines.join('\n');
    setLocalChecklist(newContent);
    localChecklistRef.current = newContent;
    if (activeNoteIdRef.current) {
      updateNote(activeNoteIdRef.current, { checklistContent: newContent } as any);
    }

    // Focus newly created row
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.checklist-item-input');
      const targetInput = lineIndex !== undefined ? inputs[lineIndex + 1] : inputs[inputs.length - 1];
      targetInput?.focus();
    }, 50);
  };

  // Complete / Uncomplete all checklist rows
  const handleToggleAllChecklist = (completed: boolean) => {
    const char = completed ? 'x' : ' ';
    const lines = localChecklist.split('\n');
    const updated = lines.map((line) => {
      if (/^(?:-\s*)?\[([ xX])\]/.test(line)) {
        return line.replace(/^(?:-\s*)?\[([ xX])\]/, `- [${char}]`);
      }
      return line;
    });
    const newContent = updated.join('\n');
    setLocalChecklist(newContent);
    localChecklistRef.current = newContent;
    if (activeNoteIdRef.current) {
      updateNote(activeNoteIdRef.current, { checklistContent: newContent } as any);
    }
    toast.success(completed ? 'Đã hoàn tất tất cả việc!' : 'Đã bỏ chọn tất cả!', { id: 'check-all' });
  };

  // 1-Click copy whole note
  const handleCopyNote = () => {
    if (!activeNote) return;
    const title = localTitle.trim() || activeNote.title || 'Ghi chú';
    const plain = extractPlainText(localContent);
    let text = `${title}\n\n${plain}`.trim();
    if (activeNote.images && activeNote.images.length > 0) {
      text += `\n\n[Đính kèm ${activeNote.images.length} hình ảnh]`;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Đã sao chép nội dung ghi chú!', { id: 'note-copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  // ──────── Individual Task Reminder Handlers ────────
  const handleSaveIndividualTaskReminder = async (
    lineIndex: number,
    taskId: string,
    taskText: string,
    datetimeStr: string | null,
    optEmail?: string,
    optNotifyEmail?: boolean
  ) => {
    if (!activeNote) return;

    if (reminderDesktop) {
      await reminderService.requestNotificationPermission();
    }

    const currentReminders = [...(activeNote.taskReminders || [])];
    const filtered = currentReminders.filter((tr) => tr.id !== taskId && tr.taskText !== taskText);

    if (datetimeStr) {
      const iso = new Date(datetimeStr).toISOString();
      filtered.push({
        id: taskId,
        taskText: taskText.trim() || 'Việc cần làm',
        reminderAt: iso,
        reminderCompleted: false,
      });

      toast.success(
        `⏰ Đã đặt giờ nhắc: "${(taskText.trim() || 'Mục này').slice(0, 24)}" lúc ${new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        { id: 'task-reminder' }
      );
    } else {
      toast.success('Đã hủy lịch nhắc việc này', { id: 'task-reminder-cancel' });
    }

    const updates: Partial<QuickNoteItem> = { taskReminders: filtered };
    if (optNotifyEmail !== undefined) updates.reminderNotifyEmail = optNotifyEmail;
    if (optEmail !== undefined) {
      updates.reminderEmail = optEmail.trim() || null;
      if (optEmail.trim()) reminderService.setPreferredEmail(optEmail.trim());
    }

    updateActiveNote(updates);
    setTaskReminderPopover(null);
  };

  // ──────── Main Note Reminder Handlers ────────
  const handleOpenReminderModal = () => {
    setShowApiKeySetting(false);
    setTaskReminderPopover(null);
    setShowFloatingAiMenu(false);
    setShowLockConfigModal(false);
    if (activeNote?.reminderAt) {
      try {
        setReminderDate(toDatetimeLocal(new Date(activeNote.reminderAt)));
      } catch (_) {
        setReminderDate(toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
      }
    } else {
      setReminderDate(toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
    }
    setReminderDesktop(activeNote?.reminderNotifyDesktop ?? true);
    setReminderNotifyEmail(activeNote?.reminderNotifyEmail ?? true);
    const existingEmail = activeNote?.reminderEmail || reminderService.getPreferredEmail() || '';
    setReminderEmail(existingEmail);
    reminderService.getSmtpStatus().then((st) => {
      setSmtpStatus(st);
      if (st.fullUser && !existingEmail) {
        setReminderEmail(st.fullUser);
      }
    }).catch(() => {});
    setShowReminderModal(true);
  };

  const handleSendTestEmail = async () => {
    const dest = reminderEmail.trim() || reminderService.getPreferredEmail();
    if (!dest || !dest.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ email nhận hợp lệ!');
      return;
    }
    setIsSendingTestEmail(true);
    toast.loading('Đang gửi thử email nhắc việc...', { id: 'test-email' });
    try {
      const res = await reminderService.sendAutomatedEmail({
        to: dest,
        subject: `[Farmers Market] Thử nghiệm nhắc việc: ${localTitle.trim() || activeNote?.title || 'Ghi chú công việc'}`,
        content: `Xin chào,\n\nĐây là email kiểm tra tính năng nhắc nhở tự động từ Trợ Lý Thu Mua Farmers Market.\n\nThời gian gửi: ${new Date().toLocaleString('vi-VN')}`,
        noteTitle: localTitle.trim() || activeNote?.title || 'Ghi chú công việc',
        taskText: 'Kiểm tra nhận thông báo công việc qua email thành công',
      });
      toast.dismiss('test-email');
      if (res.success) {
        toast.success(`🎉 Đã gửi thành công email thử nghiệm tới ${dest}!`);
        reminderService.setPreferredEmail(dest);
      } else {
        toast.error(res.message || 'Không thể gửi email. Kiểm tra lại cấu hình SMTP.', { duration: 6000 });
        if (res.configured === false) {
          setShowSmtpConfig(true);
        }
      }
    } catch (err: any) {
      toast.dismiss('test-email');
      toast.error(err.message || 'Lỗi khi gửi email', { duration: 5000 });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleSaveSmtpConfig = async () => {
    if (!smtpEmailInput.trim() || !smtpPassInput.trim()) {
      toast.error('Vui lòng nhập email gửi và mật khẩu ứng dụng Gmail (App Password)');
      return;
    }
    setIsConfiguringSmtp(true);
    toast.loading('Đang kiểm tra kết nối với máy chủ gửi thư...', { id: 'smtp-cfg' });
    try {
      const res = await reminderService.configureSmtp({
        user: smtpEmailInput.trim(),
        pass: smtpPassInput.trim(),
        senderName: 'Trợ Lý Thu Mua Farmers Market',
      });
      toast.dismiss('smtp-cfg');
      if (res.success) {
        toast.success('✅ Đã kết nối máy chủ gửi email thành công!');
        setSmtpStatus({
          configured: true,
          smtpUser: smtpEmailInput.trim(),
          senderName: 'Trợ Lý Thu Mua Farmers Market',
        });
        setShowSmtpConfig(false);
      } else {
        toast.error(res.message || 'Lỗi kết nối máy chủ SMTP', { duration: 6000 });
      }
    } catch (err: any) {
      toast.dismiss('smtp-cfg');
      toast.error(err.message || 'Không thể kết nối máy chủ SMTP', { duration: 5000 });
    } finally {
      setIsConfiguringSmtp(false);
    }
  };

  const handleApplyPreset = (minutesAhead: number) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    setReminderDate(toDatetimeLocal(target));
  };

  const handleApplyPresetTime = (hours: number, minutes: number, tomorrow = false) => {
    const target = new Date();
    if (tomorrow) target.setDate(target.getDate() + 1);
    target.setHours(hours, minutes, 0, 0);
    if (!tomorrow && target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    setReminderDate(toDatetimeLocal(target));
  };

  const handleApplyNextMonday = () => {
    const target = new Date();
    const day = target.getDay();
    const diff = target.getDate() + ((7 - day + 1) % 7 || 7);
    target.setDate(diff);
    target.setHours(8, 30, 0, 0);
    setReminderDate(toDatetimeLocal(target));
  };

  const handleSaveReminder = async () => {
    if (!activeNote) return;

    if (!reminderDate) {
      toast.error('Vui lòng chọn thời gian nhắc nhở');
      return;
    }
    const reminderIso = new Date(reminderDate).toISOString();

    if (reminderDesktop) {
      const granted = await reminderService.requestNotificationPermission();
      if (!granted) {
        toast('Hãy cấp quyền thông báo trên trình duyệt để nhận chuông nhắc', { icon: '🔔' });
      }
    }

    if (reminderNotifyEmail && reminderEmail.trim()) {
      reminderService.setPreferredEmail(reminderEmail.trim());
    }

    updateActiveNote({
      reminderAt: reminderIso,
      reminderNotifyDesktop: reminderDesktop,
      reminderNotifyEmail: reminderNotifyEmail,
      reminderEmail: reminderEmail.trim() || null,
      reminderCompleted: false,
    });

    setShowReminderModal(false);
    toast.success(
      `⏰ Đã đặt lịch nhắc: ${new Date(reminderIso).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })}${reminderNotifyEmail && reminderEmail.trim() ? ` (Kèm email gửi tới ${reminderEmail.trim()})` : ''}`,
      { id: 'reminder-saved' }
    );
  };

  const handleRemoveNoteReminder = () => {
    if (!activeNote) return;
    updateActiveNote({
      reminderAt: null,
      reminderCompleted: false,
    });
    setShowReminderModal(false);
    toast.success('Đã hủy lịch nhắc nhở toàn bộ ghi chú', { id: 'reminder-removed' });
  };

  // Only render if opened
  if (!isOpen) return null;

  const currentColorConfig = COLOR_MAP[activeNote?.color || 'amber'];
  const currentW = isCompactWindow
    ? compactSize.width
    : windowSize.width;
  const currentH = isCompactWindow
    ? compactSize.height
    : Math.max(windowSize.height, 580);

  return createPortal(
    <>
      {/* ─────────────────── Apple Liquid Glass Floating Window (Single Unified Window) ─────────────────── */}
      <div
        role="region"
        aria-label="Cửa sổ ghi chú nhanh"
        style={
          isCompactWindow && compactPos
            ? {
                left: `${compactPos.x}px`,
                top: `${compactPos.y}px`,
                width: `${currentW}px`,
                height: `${currentH}px`,
                right: 'auto',
                bottom: 'auto',
              }
            : {
                right: '0px',
                bottom: '0px',
                width: `${currentW}px`,
                height: `${currentH}px`,
                left: 'auto',
                top: 'auto',
              }
        }
        className={cn(
          "fixed z-[9999] bg-white/95 dark:bg-[#181822]/95 backdrop-blur-3xl border border-white/80 dark:border-white/15 flex overflow-hidden font-sans select-none will-change-[transform,box-shadow] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] animate-in fade-in zoom-in-95 duration-200",
          isCompactWindow ? "rounded-[26px]" : "rounded-tl-[26px] rounded-tr-none rounded-br-none rounded-bl-none",
          (isDraggingCompact || isResizing)
            ? "shadow-[0_32px_85px_rgba(0,0,0,0.3)] transition-none select-none pointer-events-auto"
            : "shadow-[0_20px_60px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] transition-[width,height,shadow] duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingFile) setIsDraggingFile(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDraggingFile(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDraggingFile(false);
          if (!activeNote) return;

          const files = Array.from(e.dataTransfer.files);
          if (files.length === 0) return;

          toast.loading('Đang xử lý tệp kéo thả...', { id: 'note-drop-process' });
          try {
            let processed = 0;
            for (const file of files) {
              if (file.type.startsWith('image/')) {
                const { dataUrl, size } = await compressImageFile(file);
                const newAttachment: NoteImageAttachment = {
                  id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
                  url: dataUrl,
                  name: file.name || `Anh_${(activeNote.images?.length || 0) + 1}.jpg`,
                  size,
                  createdAt: new Date().toISOString(),
                };
                const currentImages = activeNote.images || [];
                await updateActiveNote({ images: [...currentImages, newAttachment] });

                const imgHtml = generateInlineImageHtml(dataUrl, file.name || `Anh_${(activeNote.images?.length || 0) + 1}.jpg`);
                insertHtmlIntoEditor(imgHtml);
                processed++;
              } else {
                const fileDataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });

                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const fileCardHtml = generateFileCardHtml(fileDataUrl, file.name, ext, formatFileSize(file.size));

                insertHtmlIntoEditor(fileCardHtml);
                processed++;
              }
            }
            playAppleChime();
            toast.success(`Đã thêm ${processed} tệp trực tiếp vào ghi chú!`, { id: 'note-drop-process' });
          } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xử lý tệp', { id: 'note-drop-process' });
          }
        }}
      >
        {/* Resize Handles (Top, Left, Top-Left, Bottom-Right) */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'n')}
          className="absolute top-0 inset-x-4 h-2 cursor-n-resize z-50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Kéo đổi chiều cao"
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, 'w')}
          className="absolute left-0 inset-y-4 w-2 cursor-w-resize z-50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Kéo đổi chiều rộng"
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
          className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50 hover:bg-black/10 dark:hover:bg-white/10 rounded-tl-[26px] transition-colors"
          title="Kéo góc đổi kích thước"
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, 'se')}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 text-black/20 dark:text-white/20 hover:text-[#0071e3] transition-colors"
          title="Kéo góc đổi kích thước"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <circle cx="7" cy="1" r="0.75" />
            <circle cx="7" cy="4" r="0.75" />
            <circle cx="4" cy="4" r="0.75" />
            <circle cx="7" cy="7" r="0.75" />
            <circle cx="4" cy="7" r="0.75" />
            <circle cx="1" cy="7" r="0.75" />
          </svg>
        </div>

        {/* Drag & Drop Visual Indicator Overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-50 bg-[#0071e3]/10 dark:bg-[#0071e3]/20 backdrop-blur-md border-2 border-dashed border-[#0071e3] rounded-[28px] flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-lg shadow-[#0071e3]/30 mb-3 animate-bounce">
              <SFPhotoBadgePlus size={28} />
            </div>
            <p className="text-[16px] font-bold text-[#1d1d1f] dark:text-white">
              Thả hình ảnh vào đây
            </p>
            <p className="text-[12px] text-[#0071e3] dark:text-[#2997ff] mt-1 font-medium">
              Tự động nén và đính kèm vào ghi chú
            </p>
          </div>
        )}
        {/* Top Meniscus Specular Reflection */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/25 to-transparent pointer-events-none z-20" />

        {/* ───────── Collapsible Notes List Sidebar (Absolute Overlay — không thu nhỏ editor) ───────── */}
        {showSidebar && !isCompactWindow && (
          <>
            {/* Backdrop click outside to close sidebar — Trong suốt, không làm tối màn hình bất chợt */}
            <div
              onClick={() => setShowSidebar(false)}
              className="absolute inset-0 z-20 bg-transparent"
            />
            <div className="absolute top-0 left-0 bottom-0 w-[275px] z-30 border-r border-black/[0.08] dark:border-white/10 flex flex-col bg-white/95 dark:bg-[#181820]/95 backdrop-blur-3xl shrink-0 animate-in slide-in-from-left duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[4px_0_24px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.35)]">
              {/* Sidebar Search Bar & Close button */}
              <div className="p-3 border-b border-black/[0.06] dark:border-white/10 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <SFMagnifyingglass size={14} className="text-[#86868b] absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-full text-[12px] bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10 focus:border-[#0071e3]/40 focus:ring-0 focus:outline-none outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b]"
                    />
                  </div>
                  {/* Nút đóng sidebar */}
                  <button
                    type="button"
                    onClick={() => setShowSidebar(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="Đóng danh sách ghi chú"
                    aria-label="Đóng danh sách"
                  >
                    <SFSidebarLeft size={15} />
                  </button>
                </div>




              </div>

            {/* Notes List — stable-layout container with clear distinction between Ghi chú vs Checklist */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth" style={{ contain: 'layout' }}>
              {filteredNotes.map((note) => {
                const isSelected = note.id === activeNote?.id;
                const dotColor = COLOR_MAP[note.color || 'amber'].dot;
                const isChecklistNote =
                  note.noteType === 'checklist' ||
                  (/^-\s*\[([ xX])\]/m.test(note.content) && note.noteType !== 'note');
                const isLockedAndHidden = note.isLocked && !unlockedNoteIds.includes(note.id);
                const hasNoteReminder = Boolean(note.reminderAt && !note.reminderCompleted);
                const hasTaskReminder = Boolean((note.taskReminders || []).some((tr) => !tr.reminderCompleted));

                // Quick parse checklist stats for snippet & progress bar
                let checklistSnippet = '';
                let checklistTotalCount = 0;
                let checklistDoneCount = 0;
                let checklistPercentVal = 0;
                if (isChecklistNote) {
                  const plain = extractPlainText(note.content);
                  const lines = plain.split('\n');
                  checklistTotalCount = lines.filter((l) => /^(?:-\s*)?\[([ xX])\]/.test(l)).length;
                  checklistDoneCount = lines.filter((l) => /^(?:-\s*)?\[[xX]\]/.test(l)).length;
                  checklistPercentVal = checklistTotalCount > 0 ? Math.round((checklistDoneCount / checklistTotalCount) * 100) : 0;
                  checklistSnippet = `${checklistDoneCount}/${checklistTotalCount} việc hoàn thành`;
                }

                  return (
                    <div
                      key={note.id}
                      onClick={() => handleSelectNote(note.id)}
                      className={`group relative p-3 rounded-2xl cursor-pointer transition-all duration-180 border ${
                        isSelected
                          ? isChecklistNote
                            ? 'bg-[#0071e3]/10 dark:bg-[#0071e3]/20 border-[#0071e3]/30 shadow-xs'
                            : 'bg-amber-500/12 dark:bg-amber-500/20 border-amber-500/30 shadow-xs'
                          : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.04] dark:border-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:border-black/[0.08]'
                      }`}
                    >
                      {/* Action buttons: Top-right cluster (Thứ tự chuẩn Apple: Khóa -> Ghim -> Xóa) */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {note.isLocked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (unlockedNoteIds.includes(note.id)) {
                                setUnlockedNoteIds((prev) => prev.filter((id) => id !== note.id));
                                toast('Đã khóa lại ghi chú', { icon: '🔒', id: 'note-relocked' });
                              } else {
                                handleSelectNote(note.id);
                                setTimeout(() => {
                                  const input = document.getElementById('note-unlock-pin-hidden') as HTMLInputElement | null;
                                  input?.focus();
                                }, 50);
                              }
                            }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              unlockedNoteIds.includes(note.id)
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 opacity-90 hover:opacity-100'
                                : 'text-[#0071e3] dark:text-[#2997ff] bg-[#0071e3]/15 opacity-100 shadow-2xs'
                            }`}
                            title={unlockedNoteIds.includes(note.id) ? 'Đang mở khóa — Nhấp để khóa lại' : 'Đang khóa — Nhấp để nhập mã PIN mở khóa'}
                          >
                            {unlockedNoteIds.includes(note.id) ? <Unlock size={13} /> : <Lock size={13} />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); togglePinNote(note.id); }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            note.pinned
                              ? 'text-amber-500 dark:text-amber-400 bg-amber-500/15 opacity-100 shadow-2xs'
                              : 'text-[#86868b] hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/10 opacity-70 group-hover:opacity-100'
                          }`}
                          title={note.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                        >
                          <SFPin size={15.5} className={note.pinned ? 'fill-amber-500' : ''} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868b] hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/12 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                          title="Xóa ghi chú"
                        >
                          <SFTrash size={15} />
                        </button>
                      </div>

                      {/* Content */}
                      <div className={`min-w-0 ${note.isLocked ? 'pr-24' : 'pr-16'}`}>
                        {/* Title row */}
                        <div className="flex items-center gap-1.5 mb-1 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                          {note.isLocked && (
                            <span title={isLockedAndHidden ? 'Ghi chú đã khóa mật khẩu' : 'Ghi chú được bảo vệ'}>
                              <Lock size={11} className="text-[#0071e3] dark:text-[#2997ff] shrink-0" />
                            </span>
                          )}
                          <h5 className={`text-[12.5px] font-semibold truncate leading-snug ${
                            isSelected ? 'text-[#1d1d1f] dark:text-white' : 'text-[#1d1d1f]/90 dark:text-[#f5f5f7]/85'
                          }`}>
                            {note.title || (isChecklistNote ? 'Danh sách việc mới' : 'Ghi chú mới')}
                          </h5>
                        </div>

                        {/* Snippet / Progress */}
                        {isLockedAndHidden ? (
                          <p className="text-[11px] text-[#86868b] dark:text-[#76767b] italic flex items-center gap-1">
                            <Lock size={10} /> Đã khóa
                          </p>
                        ) : isChecklistNote ? (
                          <div className="space-y-1">
                            <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] flex items-center justify-between">
                              <span className="truncate">{checklistSnippet || 'Chưa có việc nào'}</span>
                              {checklistTotalCount > 0 && (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 ml-1.5 shrink-0">{checklistPercentVal}%</span>
                              )}
                            </p>
                            {checklistTotalCount > 0 && (
                              <div className="w-full h-1 bg-black/[0.06] dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#0088FF] to-emerald-500 rounded-full transition-all duration-300" style={{ width: `${checklistPercentVal}%` }} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">{formatNotePreview(note.content)}</p>
                        )}

                        {/* Footer info: Date & Reminder Icons aligned harmoniously */}
                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-black/[0.03] dark:border-white/[0.04]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#86868b] dark:text-[#76767b] font-mono">
                              {new Date(note.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </span>
                            {note.isLocked && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded-full font-medium bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff]">
                                {isLockedAndHidden ? 'Đã khóa' : 'Bảo vệ'}
                              </span>
                            )}
                          </div>
                          {(hasNoteReminder || hasTaskReminder) && (
                            <div className="flex items-center gap-1" title="Có cài lịch nhắc nhở">
                              <SFClock size={10.5} className={isChecklistNote ? 'text-[#0071e3]' : 'text-amber-500'} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
              })}

            </div>
          </div>
          </>
        )}

        {/* ───────── Main Editor Column ───────── */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Apple Window Title Bar */}
          <div
            onMouseDown={handleCompactHeaderMouseDown}
            className={cn(
              "h-12 px-3 sm:px-4 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-white/50 dark:bg-white/[0.02] select-none",
              isCompactWindow ? (isDraggingCompact ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
            title={isCompactWindow ? "Kéo thả thanh này để di chuyển ghi chú tự do" : "Tab ghi chú chính cố định ở góc dưới phải"}
          >
            {/* Left Controls: Sidebar toggle + Brand + Compose Capsule */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Bỏ nút mở sidebar khi ở chế độ cửa sổ (Hình 5) */}
              {!isCompactWindow && (
                <button
                  type="button"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    showSidebar
                      ? 'bg-[#0088FF]/15 text-[#0088FF] dark:text-[#0091FF]'
                      : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  title={showSidebar ? 'Ẩn danh sách ghi chú' : 'Hiện danh sách ghi chú'}
                >
                  <SFSidebarLeft size={16} />
                </button>
              )}

              <div className="flex items-center gap-2 font-sans">
                <AppleNotesBadge size={22} />
                <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white hidden sm:inline">
                  Notes
                </span>
              </div>

              {/* Apple macOS Fluid Mode Switcher Capsule (Hình 3) */}
              {(() => {
                const isChecklistActive = editorMode === 'checklist' || activeNote?.noteType === 'checklist';
                return (
                  <div className="relative inline-flex items-center p-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] backdrop-blur-2xl border border-black/[0.06] dark:border-white/12 shadow-2xs ml-1 shrink-0 flex-nowrap select-none">
                    {/* Fluid Sliding Pill Indicator: Lướt qua lướt lại có độ nẩy chất lỏng */}
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-full bg-[#0071e3] shadow-xs transition-transform duration-280 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none will-change-transform"
                      style={{
                        width: isCompactWindow ? '28px' : 'calc(50% - 2px)',
                        transform: `translate3d(${isChecklistActive ? (isCompactWindow ? '28px' : '100%') : '0px'}, 0, 0)`,
                      }}
                    />

                    {/* Nút 1: Ghi chú */}
                    <button
                      type="button"
                      onClick={() => handleSwitchNoteMode('note')}
                      className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors duration-200 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                        isCompactWindow ? 'w-7 h-7 p-0' : 'px-3 py-1'
                      } ${
                        !isChecklistActive
                          ? 'text-white'
                          : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white'
                      }`}
                      title="Chế độ Ghi chú văn bản"
                    >
                      <SFSquareAndPencil
                        size={13}
                        className={!isChecklistActive ? 'text-white' : 'text-[#76767b] dark:text-[#a1a1a6]'}
                      />
                      {!isCompactWindow && <span>Ghi chú</span>}
                    </button>

                    {/* Nút 2: Checklist (Đã xóa vạch dọc chắn ở giữa) */}
                    <button
                      type="button"
                      onClick={() => handleSwitchNoteMode('checklist')}
                      className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors duration-200 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                        isCompactWindow ? 'w-7 h-7 p-0' : 'px-3 py-1'
                      } ${
                        isChecklistActive
                          ? 'text-white'
                          : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white'
                      }`}
                      title="Chế độ Checklist việc cần làm"
                    >
                      <SFCheckmarkSquare
                        size={13}
                        className={isChecklistActive ? 'text-white' : 'text-[#76767b] dark:text-[#a1a1a6]'}
                      />
                      {!isCompactWindow && <span>Checklist</span>}
                    </button>
                  </div>
                );
              })()}

              {/* Dedicated + Button to create a new note */}
              <button
                type="button"
                onClick={() => handleCreateNewNote(editorMode === 'checklist' ? 'checklist' : 'note')}
                className="w-7 h-7 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#0071e3]/15 hover:text-[#0071e3] dark:hover:text-[#2997ff] text-[#76767b] flex items-center justify-center transition-all cursor-pointer active:scale-90 ml-0.5 shadow-2xs"
                title="Tạo ghi chú / checklist mới (+)"
              >
                <SFPlus size={14} />
              </button>
            </div>

            {/* Right Window Controls: Thứ tự chuẩn Apple: Khóa -> Phóng to thu nhỏ -> Đóng ngoài cùng (Hình 5) */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              {/* 1. Lock / Password Protection Button */}
              {activeNote && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeNote.isLocked) {
                        handleOpenLockConfig();
                      } else if (unlockedNoteIds.includes(activeNote.id)) {
                        handleLockActiveNoteImmediately();
                      } else {
                        // Ghi chú đang khóa: Chỉ focus vào ô nhập PIN và rung nhắc người dùng, tuyệt đối không mở modal
                        const input = document.getElementById('note-unlock-pin-hidden') as HTMLInputElement | null;
                        input?.focus();
                        setUnlockShake(true);
                        setTimeout(() => setUnlockShake(false), 500);
                        toast('Vui lòng nhập mã PIN 6 số để mở khóa ghi chú', { icon: '🔒', id: 'lock-pin-hint' });
                      }
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      activeNote.isLocked
                        ? unlockedNoteIds.includes(activeNote.id)
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#0071e3]/15 text-[#0071e3] dark:text-[#2997ff] border border-[#0071e3]/30 shadow-xs'
                        : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title={
                      activeNote.isLocked
                        ? unlockedNoteIds.includes(activeNote.id)
                          ? 'Ghi chú đang mở khóa — Nhấp để khóa lại ngay'
                          : 'Ghi chú đang bị khóa mật khẩu (Nhập mã PIN để xem)'
                        : 'Cài mật khẩu bảo vệ ghi chú (Khóa riêng tư)'
                    }
                  >
                    {activeNote.isLocked ? (
                      unlockedNoteIds.includes(activeNote.id) ? (
                        <Unlock size={14} />
                      ) : (
                        <Lock size={14} />
                      )
                    ) : (
                      <Lock size={14} />
                    )}
                  </button>

                  {/* Khi ghi chú đã được mở khóa hợp lệ: Hiển thị thêm icon cài đặt để đổi hoặc gỡ mật khẩu */}
                  {activeNote.isLocked && unlockedNoteIds.includes(activeNote.id) && (
                    <button
                      type="button"
                      onClick={handleOpenLockConfig}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Quản lý mật khẩu ghi chú (Đổi hoặc gỡ mã PIN)"
                    >
                      <Settings size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* 2. Apple Window Mode Toggle: Phóng to / Thu nhỏ nằm kế bên nút đóng */}
              <button
                type="button"
                onClick={handleToggleCompactMode}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
                title={isCompactWindow ? 'Phóng to thành tab chính cố định (Góc dưới phải)' : 'Thu nhỏ thành cửa sổ nhỏ linh động di chuyển'}
                aria-label={isCompactWindow ? 'Phóng to tab chính' : 'Thu nhỏ cửa sổ'}
              >
                {isCompactWindow ? <Maximize2 size={13.5} /> : <Minimize2 size={13.5} />}
              </button>

              {/* 3. Close window — nút đóng ngoài cùng bên phải */}
              <button
                type="button"
                onClick={handleCloseNote}
                className="w-7 h-7 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <SFXmark size={14} />
              </button>
            </div>
          </div>

          {/* Note Editor Area */}
          {activeNote ? (
            isNoteLocked ? (
              <div
                onClick={() => {
                  const input = document.getElementById('note-unlock-pin-hidden') as HTMLInputElement | null;
                  input?.focus();
                }}
                className="flex-1 flex flex-col items-center justify-center p-6 text-center font-sans bg-transparent select-none animate-in fade-in duration-200 cursor-text"
              >
                <div className={cn(
                  "w-full max-w-[340px] p-6 rounded-[26px] bg-white/90 dark:bg-[#1c1c24]/90 border border-black/10 dark:border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.12)] flex flex-col items-center relative",
                  unlockShake && "apple-shake"
                )}>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#0071e3]/20 to-[#0071e3]/5 border border-[#0071e3]/25 flex items-center justify-center text-[#0071e3] dark:text-[#2997ff] shadow-md shadow-[#0071e3]/20 mb-3">
                    <Lock size={26} />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1d1d1f] dark:text-white tracking-tight">
                    Ghi chú đã được khóa
                  </h3>
                  <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] mt-1 text-center">
                    Nhập mã PIN 6 số để mở khóa ghi chú này
                  </p>

                  {/* 6 PIN Indicator Circles — Chuẩn Apple, tự nhận phím gõ */}
                  <div className="flex items-center gap-3.5 my-6 relative cursor-pointer">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const isFilled = idx < unlockPasscode.length;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "w-4 h-4 rounded-full transition-all duration-180",
                            isFilled
                              ? unlockError
                                ? "bg-rose-500 shadow-xs scale-110"
                                : "bg-[#0071e3] shadow-xs scale-110"
                              : "border-2 border-black/25 dark:border-white/30 bg-transparent"
                          )}
                        />
                      );
                    })}

                    {/* Hidden input overlays circles so clicks always focus & receive input */}
                    <input
                      id="note-unlock-pin-hidden"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      value={unlockPasscode}
                      onKeyDown={(e) => {
                        if (['Backspace', 'Tab', 'Escape'].includes(e.key)) return;
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => handleUnlockPasscodeChange(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>

                  {unlockError && (
                    <p className="text-[12px] text-rose-500 font-medium animate-in fade-in duration-150">
                      {unlockError}
                    </p>
                  )}
                </div>
              </div>
            ) : (
            <div className={cn(
              "flex-1 flex flex-col overflow-hidden apple-note-canvas font-sans bg-transparent dark:bg-[#16161e]",
              isCompactWindow ? "pt-3.5 pb-2 pl-4 pr-1" : "p-5 sm:p-6"
            )}>
              {/* Title input - Apple macOS 27 Title 1 Typography */}
              <div className="mb-1 shrink-0">
                <input
                  type="text"
                  value={localTitle}
                  onChange={handleTitleChange}
                  placeholder="Tiêu đề ghi chú..."
                  style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                  className="w-full macos-title-1 font-bold text-[#1d1d1f] dark:text-[#f5f5f7] bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-none placeholder:text-[#86868b]/40 tracking-tight p-0 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200"
                />
              </div>

              {/* Note Metadata Row: Timestamp, Auto-save status, Per-Note Reminder Button, Color Tags — ẨN trong compact mode */}
              {!isCompactWindow && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-[#86868b] dark:text-[#76767b] pb-2.5 pt-1 border-b border-black/[0.04] dark:border-white/[0.06] mb-3 shrink-0">
                <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                  <span className="font-medium text-[#86868b] dark:text-[#a1a1a6] truncate">
                    {new Date(activeNote.updatedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {extractPlainText(localContent).length} ký tự
                  </span>
                  <span className="text-[#34c759] inline-flex items-center gap-1 font-medium shrink-0">
                    <SFCheckmark size={12} className="text-[#34c759]" /> Đã lưu
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Note-Level Reminder Action: Icon-only Apple liquid glass button */}
                  {activeNote.reminderAt && !activeNote.reminderCompleted ? (
                    <button
                      type="button"
                      onClick={handleOpenReminderModal}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[#0071e3] dark:text-[#2997ff] border-0 transition-all cursor-pointer relative group active:scale-90"
                      title={`Lịch nhắc: ${new Date(activeNote.reminderAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} ${new Date(activeNote.reminderAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      })}`}
                      aria-label="Lịch nhắc"
                    >
                      <SFClock size={13.5} className="text-[#0071e3] dark:text-[#2997ff]" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#0071e3] ring-2 ring-white dark:ring-[#1c1c24]" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenReminderModal}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white border-0 transition-all cursor-pointer active:scale-90"
                      title="Cài đặt lịch nhắc cho ghi chú này"
                      aria-label="Hẹn giờ nhắc"
                    >
                      <SFBell size={13.5} />
                    </button>
                  )}

                  {/* Gemini API Key Setting Button: Matches Reminder button with NO border (Hình 1) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={handleToggleApiKeySetting}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white border-0 transition-all cursor-pointer active:scale-90 relative"
                      title={getStoredGeminiKey() ? 'Cấu hình Gemini API Key (Đã kích hoạt)' : 'Cài đặt Gemini API Key để dùng AI Writing'}
                      aria-label="Cấu hình Gemini API Key"
                    >
                      <SFKey size={13.5} className={getStoredGeminiKey() ? 'text-[#0071e3] dark:text-[#2997ff]' : ''} />
                      {getStoredGeminiKey() && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#0071e3] ring-2 ring-white dark:ring-[#1c1c24]" />
                      )}
                    </button>
                  </div>

                  {/* Quick Note Color Tag Selector */}
                  <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05] shrink-0">
                    {(['amber', 'blue', 'emerald', 'purple', 'rose'] as QuickNoteColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => changeColorNote(activeNote.id, c)}
                        className={`w-3.5 h-3.5 rounded-full ${COLOR_MAP[c].dot} transition-transform ${
                          activeNote.color === c ? 'scale-110 ring-2 ring-black/20 dark:ring-white/40 shadow-xs' : 'opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                        title={`Màu ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              )} {/* end !isCompactWindow metadata row */}

              {/* ──────────────── IN-LINE AI WRITING DRAFT PREVIEW (Apple Diff Inline) ──────────────── */}
              {aiDraft && (
                <div className="mb-3 px-3.5 py-2.5 rounded-2xl bg-white/90 dark:bg-[#1e1e26]/90 backdrop-blur-2xl border border-black/[0.08] dark:border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] flex items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1.5 duration-150 shrink-0">
                  <div className="flex-1 min-w-0 text-[13.5px] leading-relaxed select-text flex flex-wrap items-center gap-2 max-h-[160px] overflow-y-auto scrollbar-thin">
                    {aiDraft.originalText && aiDraft.originalText !== aiDraft.result && (
                      <span className="line-through text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 px-2 py-0.5 rounded-lg text-[13px] whitespace-pre-wrap">
                        {aiDraft.originalText}
                      </span>
                    )}
                    <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 font-medium px-2 py-0.5 rounded-lg text-[13px] whitespace-pre-wrap">
                      {aiDraft.result}
                    </span>
                  </div>

                  {/* Compact Floating Action Pill: [✓] [✕] */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-full border border-black/[0.05] dark:border-white/10 shadow-2xs self-center">
                    <button
                      type="button"
                      onClick={() => handleApplyAiDraft('replace')}
                      className="w-7 h-7 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
                      title="Chấp nhận thay thế"
                      aria-label="Chấp nhận"
                    >
                      <SFCheckmark size={13} className="stroke-[3]" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardAiDraft}
                      className="w-7 h-7 rounded-full text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                      title="Hủy bỏ"
                      aria-label="Hủy bỏ"
                    >
                      <SFXmark size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* In-place Quick Formatting & Tools Strip — ẨN trong compact mode */}
              {!isCompactWindow && (
              <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-black/[0.06] dark:border-white/10 shrink-0 select-none relative">
                <div className="flex items-center gap-0.5 shrink-0 overflow-x-auto scrollbar-none py-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('bold')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center font-bold text-[12.5px] transition-all cursor-pointer ${
                      activeFormats.bold
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="In đậm (Bold)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('italic')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                      activeFormats.italic
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="In nghiêng (Italic) - Chữ I có chân (Ctrl+I)"
                    aria-label="In nghiêng"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="4" x2="10" y2="4" />
                      <line x1="14" y1="20" x2="5" y2="20" />
                      <line x1="15" y1="4" x2="9" y2="20" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('underline')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center underline text-[12.5px] transition-all cursor-pointer ${
                      activeFormats.underline
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Gạch chân (Underline)"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('strike')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center line-through text-[12.5px] transition-all cursor-pointer ${
                      activeFormats.strike
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Gạch ngang (Strikethrough)"
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('heading')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center font-bold text-[11.5px] transition-all cursor-pointer ${
                      activeFormats.heading
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Tiêu đề mục (Heading)"
                  >
                    H
                  </button>

                  <div className="w-[1px] h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0" />

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('bullet')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                      activeFormats.bullet
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Danh sách gạch đầu dòng"
                  >
                    <List size={13.5} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('number')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                      activeFormats.number
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Danh sách số"
                  >
                    <ListOrdered size={13.5} />
                  </button>
                </div>

                {/* Tools Dropdown trigger (Full 9 Writing Tools, No Blur) */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCompactAiMenu(!showCompactAiMenu)}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs ${
                      showCompactAiMenu
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/10'
                    }`}
                    title="Công cụ AI soạn thảo & xử lý văn bản"
                  >
                    <SFWandAndSparkles size={11.5} className="text-[#0071e3] dark:text-[#2997ff]" />
                    <span>Tools</span>
                    <ChevronDown size={10} className={`transition-transform duration-150 ${showCompactAiMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showCompactAiMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-white dark:bg-[#1c1c24] border border-black/10 dark:border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5 text-left max-h-[380px] overflow-y-auto"
                    >
                      <div className="px-2.5 py-1 text-[10.5px] font-bold text-[#86868b] dark:text-[#a1a1a6] border-b border-black/[0.06] dark:border-white/10 mb-1 flex items-center justify-between">
                        <span>Công cụ Apple AI</span>
                        <span className="text-[9.5px] bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] px-1.5 py-0.5 rounded-full font-semibold">Intelligence</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('summarize');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#0071e3]/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center shrink-0">
                          <SFDocument size={12} />
                        </div>
                        <span className="truncate">Tóm tắt nội dung</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('keypoints');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-amber-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <SFListBullet size={12} />
                        </div>
                        <span className="truncate">Rút ra ý chính</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('professional');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-purple-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <SFBriefcase size={12} />
                        </div>
                        <span className="truncate">Viết chuyên nghiệp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('concise');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-emerald-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <SFTextQuote size={12} />
                        </div>
                        <span className="truncate">Viết ngắn gọn, súc tích</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('proofread');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-rose-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                          <SFCheckmarkCircle size={12} />
                        </div>
                        <span className="truncate">Sửa chính tả & câu từ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('expand');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-indigo-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <SFSquareAndPencil size={12} />
                        </div>
                        <span className="truncate">Mở rộng & phát triển ý</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('action_items');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-sky-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                          <SFCheckmarkSquare size={12} />
                        </div>
                        <span className="truncate">Liệt kê việc cần làm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('translate_en');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-blue-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Globe size={12} />
                        </div>
                        <span className="truncate">Dịch sang tiếng Anh</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('translate_vi');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-teal-500/10 dark:hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <Globe size={12} />
                        </div>
                        <span className="truncate">Dịch sang tiếng Việt</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              )} {/* end !isCompactWindow toolbar strip */}

              {/* ──────────────── CONTENT AREA: TEXT VS INTERACTIVE CHECKLIST ──────────────── */}
              {editorMode === 'checklist' ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1 space-y-2.5">
                  {/* Progress Bar & Actions */}
                  {checklistTotal > 0 && (
                    <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] shrink-0 space-y-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Tiến độ: <strong className="text-emerald-600 dark:text-emerald-400">{checklistCompleted}/{checklistTotal} việc</strong> ({checklistPercent}%)
                        </span>
                        <div className="flex items-center gap-2 text-[11px]">
                          {checklistCompleted < checklistTotal ? (
                            <button
                              type="button"
                              onClick={() => handleToggleAllChecklist(true)}
                              className="text-[#0071e3] dark:text-[#2997ff] hover:underline cursor-pointer font-medium"
                            >
                              Xong tất cả
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleAllChecklist(false)}
                              className="text-slate-500 hover:underline cursor-pointer"
                            >
                              Bỏ chọn
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                          style={{ width: `${checklistPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Interactive Checklist Rows */}
                  <div className="space-y-1.5 flex-1">
                    {checklistRows.map((row) => (
                      <div
                        key={`row-${row.lineIndex}`}
                        className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 ${
                          mathAnimatedRowIndex === row.lineIndex
                            ? 'animate-math-flash ring-2 ring-[#0071e3]/40 border-[#0071e3]/50'
                            : ''
                        } ${
                          row.completed
                            ? 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.05] border-emerald-500/20'
                            : 'bg-white/60 dark:bg-white/[0.03] border-black/[0.04] dark:border-white/[0.06] hover:border-[#0071e3]/45 hover:bg-[#0071e3]/[0.02]'
                        }`}
                      >
                        {/* Interactive Clickable Round Apple Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleChecklistRow(row.lineIndex)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
                            row.completed
                              ? 'bg-emerald-500 dark:bg-emerald-400 text-white shadow-xs scale-105'
                              : 'border-2 border-black/25 dark:border-white/30 hover:border-[#0071e3] hover:scale-105'
                          }`}
                          title={row.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu đã hoàn thành'}
                        >
                          {row.completed && <SFCheckmark size={14} className="stroke-[3]" />}
                        </button>

                        {/* Direct Editable Task Text Input */}
                        <input
                          type="text"
                          value={row.text}
                          onChange={(e) => handleUpdateChecklistRowText(row.lineIndex, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInsertChecklistRowAfter(row.lineIndex);
                            } else if (e.key === 'Backspace' && row.text === '') {
                              e.preventDefault();
                              handleDeleteChecklistRow(row.lineIndex);
                            }
                          }}
                          placeholder="Nhập việc cần làm..."
                          className={`checklist-item-input flex-1 bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 text-[14px] ${
                            row.completed
                              ? 'line-through text-[#86868b] dark:text-[#76767b]'
                              : 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                          }`}
                        />

                        {/* Individual Task Reminder Chip / Clock Button */}
                        {row.reminderAt ? (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskReminderPopover({
                                lineIndex: row.lineIndex,
                                taskId: row.taskId,
                                taskText: row.text,
                                reminderAt: toDatetimeLocal(new Date(row.reminderAt!)),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0071e3]/12 text-[#0071e3] dark:text-[#2997ff] border border-[#0071e3]/25 hover:bg-[#0071e3]/20 transition-all cursor-pointer shrink-0 shadow-2xs"
                            title="Nhấp để đổi giờ hoặc hủy nhắc cho việc này"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
                            <SFClock size={12} className="text-[#0071e3] dark:text-[#2997ff]" />
                            <span>{formatReminderBadge(row.reminderAt)}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskReminderPopover({
                                lineIndex: row.lineIndex,
                                taskId: row.taskId,
                                taskText: row.text,
                                reminderAt: toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)),
                              })
                            }
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#86868b] hover:text-[#0071e3] dark:hover:text-[#2997ff] hover:bg-[#0071e3]/10 rounded-full transition-all cursor-pointer shrink-0"
                            title="Hẹn giờ nhắc riêng cho mục việc này"
                          >
                            <SFClock size={14} />
                          </button>
                        )}

                        {/* Delete row button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistRow(row.lineIndex)}
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-1 text-[#86868b] cursor-pointer shrink-0"
                          title="Xóa dòng này"
                        >
                          <SFXmark size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add New Item Button inside list */}
                    <button
                      type="button"
                      onClick={() => handleInsertChecklistRowAfter()}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 hover:border-[#0071e3]/50 hover:bg-[#0071e3]/[0.04] text-[13px] text-[#76767b] hover:text-[#0071e3] dark:hover:text-[#2997ff] transition-all cursor-pointer mt-2"
                    >
                      <SFPlus size={16} className="text-[#0071e3] dark:text-[#2997ff]" />
                      <span>Thêm mục mới... (Nhấn Enter)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Seamless Flowing Writing Canvas */
                <div ref={canvasRef} className="flex-1 flex flex-col min-h-0 relative">
                  {/* ──────────────── Apple Liquid Glass Floating Selection Toolbar (Follows Highlighted Text) ──────────────── */}
                  {selectionState && toolbarCoords && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        top: `${toolbarCoords.top}px`,
                        left: `${toolbarCoords.left}px`,
                        transform: 'translateX(-50%)',
                      }}
                      className="absolute z-30 flex items-center gap-1 p-1 rounded-full bg-white/88 dark:bg-[#1c1c24]/88 backdrop-blur-3xl border border-white/80 dark:border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_1.5px_rgba(255,255,255,0.9)] animate-in fade-in zoom-in-95 duration-150 select-none transition-all"
                    >
                      {/* Basic Typography Formatting Buttons */}
                      <div className="flex items-center gap-0.5 pr-1 border-r border-black/[0.08] dark:border-white/10">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('bold')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                            activeFormats.bold
                              ? 'bg-[#0071e3] text-white shadow-xs font-black'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="In đậm (Bold) - Bôi đậm văn bản (Ctrl+B)"
                          aria-label="In đậm"
                        >
                          <span className="font-black text-[13.5px] leading-none select-none tracking-tight">B</span>
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('italic')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                            activeFormats.italic
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="In nghiêng (Italic) - Chữ I có chân (Ctrl+I)"
                          aria-label="In nghiêng"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="4" x2="10" y2="4" />
                            <line x1="14" y1="20" x2="5" y2="20" />
                            <line x1="15" y1="4" x2="9" y2="20" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('underline')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer text-xs ${
                            activeFormats.underline
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Gạch chân (Underline)"
                          aria-label="Gạch chân"
                        >
                          <Underline size={13} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('strike')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer text-xs ${
                            activeFormats.strike
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Gạch ngang (Strikethrough)"
                          aria-label="Gạch ngang"
                        >
                          <Strikethrough size={13} />
                        </button>
                      </div>

                      {/* Structure Formatting: Bullet, Number, Heading */}
                      <div className="flex items-center gap-0.5 px-1 border-r border-black/[0.08] dark:border-white/10">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('bullet')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                            activeFormats.bullet
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Danh sách dấu đầu dòng"
                          aria-label="Danh sách gạch đầu dòng"
                        >
                          <List size={14} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('number')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer ${
                            activeFormats.number
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Danh sách đánh số"
                          aria-label="Danh sách số"
                        >
                          <ListOrdered size={14} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('heading')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer font-bold text-xs ${
                            activeFormats.heading
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Tiêu đề đề mục (Heading)"
                          aria-label="Tiêu đề"
                        >
                          <Heading size={14} />
                        </button>
                      </div>

                      {/* Apple Writing Tools Button */}
                      <div className="relative pl-0.5">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowFloatingAiMenu(!showFloatingAiMenu)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 relative overflow-hidden group ${
                            showFloatingAiMenu
                              ? 'bg-[#0071e3] text-white shadow-xs scale-105'
                              : 'bg-black/[0.05] dark:bg-white/[0.1] hover:bg-black/10 dark:hover:bg-white/15 text-[#1d1d1f] dark:text-white border border-black/[0.08] dark:border-white/[0.12] shadow-2xs hover:scale-105'
                          }`}
                          title="Công cụ soạn thảo Apple"
                          aria-label="Công cụ soạn thảo Apple"
                        >
                          <SFWandAndSparkles size={13.5} />
                        </button>

                        {/* Apple Writing Tools Contextual Menu — Tự động tính chiều cao để không bao giờ bị cắt xén ngoài đỉnh/đáy */}
                        {showFloatingAiMenu && (
                          <div
                            onMouseDown={(e) => e.preventDefault()}
                            style={{
                              maxHeight: toolbarCoords.maxMenuHeight ? `${toolbarCoords.maxMenuHeight}px` : '220px',
                            }}
                            className={`absolute right-0 w-60 rounded-[20px] bg-white dark:bg-[#1e1e24] border border-black/10 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5 text-left overflow-y-auto scrollbar-thin [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/20 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full ${
                              toolbarCoords.openMenuUp
                                ? 'bottom-full mb-2 origin-bottom-right'
                                : 'top-full mt-2 origin-top-right'
                            }`}
                          >
                            <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 mb-1">
                              <div className="flex items-center gap-1.5 text-[#0071e3] dark:text-[#2997ff]">
                                <SFWandAndSparkles size={12.5} />
                                <span className="text-[11.5px] font-bold text-[#1d1d1f] dark:text-white">
                                  Công cụ soạn thảo
                                </span>
                              </div>
                              <span className="text-[10px] text-[#0071e3] dark:text-[#2997ff] font-medium bg-[#0071e3]/10 px-2 py-0.5 rounded-full">
                                {selectionState.text.length} ký tự
                              </span>
                            </div>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('summarize')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center shrink-0">
                                <SFDocument size={12.5} />
                              </div>
                              <span className="truncate">Tóm tắt nội dung</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('keypoints')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <SFListBullet size={12.5} />
                              </div>
                              <span className="truncate">Rút ra ý chính</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('professional')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <SFBriefcase size={12.5} />
                              </div>
                              <span className="truncate">Viết chuyên nghiệp</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('concise')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <SFTextQuote size={12.5} />
                              </div>
                              <span className="truncate">Viết ngắn gọn, súc tích</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('proofread')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                <SFCheckmarkCircle size={12.5} />
                              </div>
                              <span className="truncate">Sửa chính tả & câu từ</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('expand')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <SFSquareAndPencil size={12.5} />
                              </div>
                              <span className="truncate">Mở rộng & phát triển ý</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('action_items')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <SFCheckmarkSquare size={12.5} />
                              </div>
                              <span className="truncate">Liệt kê việc cần làm</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('translate_en')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Globe size={12.5} />
                              </div>
                              <span className="truncate">Dịch sang tiếng Anh</span>
                            </button>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleExecuteSelectedWritingTool('translate_vi')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <div className="w-5.5 h-5.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                                <Globe size={12.5} />
                              </div>
                              <span className="truncate">Dịch sang tiếng Việt</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Placeholder overlay when empty */}
                  {(!localContent ||
                    localContent === '<p><br></p>' ||
                    localContent === '<br>' ||
                    localContent.trim() === '') && (
                    <div className="absolute top-0 left-0 text-[#86868b]/50 dark:text-[#636366]/60 text-[14.5px] pointer-events-none select-none">
                      Gõ ghi chú, kế hoạch thu mua, thông tin cần nhớ... (Phím tắt Alt + N)
                    </div>
                  )}

                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    onSelect={handleEditorSelect}
                    onMouseDown={handleEditorMouseDown}
                    onMouseUp={handleEditorSelect}
                    onKeyUp={handleEditorSelect}
                    onScroll={handleEditorSelect}
                    onPaste={handleEditorPaste}
                    onClick={handleEditorClick}
                    className="flex-1 w-full bg-transparent border-0 outline-none shadow-none ring-0 focus:ring-0 focus:outline-none focus:border-none font-sans text-[14.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] p-0 pr-1 selection:bg-purple-500/25 selection:text-[#1d1d1f] dark:selection:text-white overflow-y-auto min-h-0 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1d1d1f] dark:[&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_img]:!max-w-[320px] [&_img]:!max-h-[220px] [&_img]:!w-auto [&_img]:!h-auto [&_img]:object-contain [&_img]:rounded-xl [&_img]:cursor-zoom-in [&_.apple-img-wrapper]:my-2 [&_.apple-img-wrapper_img]:!m-0 [&_.apple-img-wrapper_img]:!p-0 [&_.apple-img-wrapper_img]:!border-0 [&_.apple-img-wrapper_img]:!shadow-none [&_.apple-img-wrapper_img]:!block [&_.apple-file-attachment]:transition-all hover:[&_.apple-file-attachment]:bg-black/[0.07] dark:hover:[&_.apple-file-attachment]:bg-white/[0.08] cursor-text scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/30"
                    style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                  />
                </div>
              )}

              {/* Bottom Quick Tools Bar - Apple Liquid Glass Dock — ẨN trong compact mode */}
              {!isCompactWindow && (
              <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                {/* Left: Content Insertion & Quick Tools (Tách biệt thành các button độc lập theo Hình 1 & 4) */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePickImages}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={attachmentInputRef}
                    onChange={handlePickFiles}
                    multiple
                    className="hidden"
                  />

                  {/* 1. Nút Thêm hình ảnh riêng biệt (Tăng kích thước icon, sáng button khi hover, không đổi viền) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.12] dark:hover:bg-white/[0.18] hover:brightness-110 text-[#0071e3] dark:text-[#2997ff] border border-black/[0.05] dark:border-white/[0.08] transition-all cursor-pointer active:scale-90 shadow-2xs hover:shadow-xs"
                    title="Chèn hình ảnh trực tiếp vào văn bản (Hỗ trợ kéo thả & dán)"
                    aria-label="Thêm hình ảnh"
                  >
                    <SFPhotoBadgePlus size={18} />
                  </button>

                  {/* 2. Nút Cắt màn hình Snipping Tool riêng biệt (Sáng button khi hover, không đổi viền) */}
                  <button
                    type="button"
                    disabled={isCapturingScreen}
                    onClick={handleStartSnipping}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border border-black/[0.05] dark:border-white/[0.08] transition-all cursor-pointer active:scale-90 shadow-2xs ${
                      isCapturingScreen
                        ? 'bg-amber-500/25 text-amber-600 animate-pulse'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.12] dark:hover:bg-white/[0.18] hover:brightness-110 text-amber-500 dark:text-amber-400 hover:shadow-xs'
                    }`}
                    title="Cắt màn hình nhanh và chèn thẳng vào văn bản (Snipping Tool)"
                    aria-label="Cắt màn hình"
                  >
                    <Scissors size={15.5} />
                  </button>

                  {/* 3. Nút Đính kèm tệp tin đa dạng (Sáng button khi hover, không đổi viền) */}
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.12] dark:hover:bg-white/[0.18] hover:brightness-110 text-emerald-600 dark:text-emerald-400 border border-black/[0.05] dark:border-white/[0.08] transition-all cursor-pointer active:scale-90 shadow-2xs hover:shadow-xs"
                    title="Đính kèm tệp tin đa dạng (PDF, Word, Excel, ZIP, Text... vào văn bản)"
                    aria-label="Đính kèm tệp tin"
                  >
                    <Paperclip size={15.5} />
                  </button>
                </div>

                {/* Right: Note Management Actions: Copy & Delete */}
                <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-xl shrink-0 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleCopyNote}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                      copied
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs scale-105'
                        : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-white dark:hover:bg-[#2c2c2e] hover:shadow-xs'
                    }`}
                    title={copied ? 'Đã sao chép nội dung!' : 'Sao chép toàn bộ nội dung ghi chú'}
                    aria-label="Sao chép nội dung"
                  >
                    {copied ? (
                      <SFCheckmark size={15} className="text-[#34c759] animate-in zoom-in-75 duration-150" />
                    ) : (
                      <SFSquareOnSquare size={15} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteNote(activeNote.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#76767b] hover:text-rose-600 hover:bg-rose-500/15 transition-all cursor-pointer active:scale-90 hover:shadow-xs"
                    title="Xóa ghi chú này"
                    aria-label="Xóa ghi chú"
                  >
                    <SFTrash size={15} />
                  </button>
                </div>
              </div>
              )} {/* end !isCompactWindow bottom dock */}
            </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#76767b]">
              <SFDocument size={40} className="opacity-30 mb-2" />
              <p className="text-sm font-medium">Chưa có ghi chú nào</p>
              <button
                type="button"
                onClick={() => handleCreateNewNote(typeFilter === 'checklist' ? 'checklist' : 'note')}
                className={`mt-3 px-4 py-1.5 rounded-full text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 ${
                  typeFilter === 'checklist'
                    ? 'bg-[#0071e3] hover:bg-[#0077ed]'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {typeFilter === 'checklist' ? 'Tạo checklist ngay' : 'Tạo ghi chú ngay'}
              </button>
            </div>
          )}

                  </div>
      </div>

      {/* ─────────────────── Apple Gemini API Key Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      {showApiKeySetting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cài đặt Gemini API Key"
          onClick={() => setShowApiKeySetting(false)}
          className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-black/25 dark:bg-black/50 backdrop-blur-md select-none animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-white/85 dark:bg-[#1e1e24]/85 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-5 space-y-4 text-left animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
                  <SFKey size={15} />
                </div>
                <div>
                  <h4 className="font-semibold text-[14.5px] text-[#1d1d1f] dark:text-white leading-tight">
                    Gemini API Key
                  </h4>
                  <p className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                    Cung cấp trí tuệ cho Apple Writing Tools
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeySetting(false)}
                className="w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
              >
                <SFXmark size={14} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Nhập Google Gemini API Key:
              </label>
              <div className="relative flex items-center">
                <input
                  type={showApiKeyPassword ? 'text' : 'password'}
                  value={geminiApiKeyInput}
                  onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-3 pr-10 py-2 rounded-xl text-[12.5px] font-mono bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20 outline-none focus:border-[#0071e3] dark:focus:border-[#2997ff] text-[#1d1d1f] dark:text-white transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeyPassword(!showApiKeyPassword)}
                  className="absolute right-2.5 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer p-1"
                  title={showApiKeyPassword ? 'Ẩn khóa' : 'Hiện khóa'}
                >
                  {showApiKeyPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
                Khóa API được lưu an toàn trên trình duyệt của bạn và dùng trực tiếp để kích hoạt các công cụ Apple AI.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/10">
              {getStoredGeminiKey() ? (
                <button
                  type="button"
                  onClick={() => {
                    setStoredGeminiKey('');
                    setGeminiApiKeyInput('');
                    toast.success('Đã xóa Gemini API Key!', { id: 'api-key-clear' });
                  }}
                  className="text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Xóa khóa hiện tại
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeySetting(false)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoredGeminiKey(geminiApiKeyInput.trim());
                    setShowApiKeySetting(false);
                    playAppleChime();
                    toast.success('Đã lưu Gemini API Key thành công!', { id: 'api-key-save' });
                  }}
                  className="px-4.5 py-1.5 rounded-full text-[12px] font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Lưu khóa API
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── Individual Task Reminder Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      {taskReminderPopover && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hẹn giờ nhắc việc"
          onClick={() => setTaskReminderPopover(null)}
          className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-black/25 dark:bg-black/50 backdrop-blur-md select-none animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[390px] bg-white/85 dark:bg-[#1e1e24]/85 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-5 space-y-4 text-left animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-2xs">
                  <SFClock size={15} />
                </div>
                <div>
                  <h4 className="font-semibold text-[14px] text-[#1d1d1f] dark:text-white leading-tight">
                    Hẹn Giờ Nhắc Việc
                  </h4>
                  <p className="text-[11.5px] text-[#6e6e73] dark:text-[#a1a1a6] truncate max-w-[220px] mt-0.5">
                    {taskReminderPopover.taskText || 'Mục việc cần làm'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTaskReminderPopover(null)}
                className="w-6.5 h-6.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
              >
                <SFXmark size={13} />
              </button>
            </div>

            {/* Quick Presets for this task */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                <SFWandAndSparkles size={12} className="text-amber-500" />
                <span>Gợi ý thời gian</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() + 30 * 60 * 1000);
                    setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                  }}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  ⚡ Sau 30 phút
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(15, 0, 0, 0);
                    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                    setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                  }}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  ☀️ Chiều nay 15:00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(9, 0, 0, 0);
                    setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                  }}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  🌅 Sáng mai 09:00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const day = d.getDay();
                    d.setDate(d.getDate() + ((7 - day + 1) % 7 || 7));
                    d.setHours(8, 30, 0, 0);
                    setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                  }}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  📅 Thứ Hai 8h30
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                <SFClock size={12} className="text-[#0071e3] dark:text-[#2997ff]" />
                <span>Chọn giờ cụ thể:</span>
              </label>
              <input
                type="datetime-local"
                value={taskReminderPopover.reminderAt}
                onChange={(e) => setTaskReminderPopover({ ...taskReminderPopover, reminderAt: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl text-[12.5px] font-medium bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20 outline-none focus:border-[#0071e3] dark:focus:border-[#2997ff] text-[#1d1d1f] dark:text-white transition-all shadow-2xs"
              />
            </div>

            {/* Email reminder option for this individual task */}
            <div className="space-y-1.5 pt-2 border-t border-black/[0.06] dark:border-white/10">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                <input
                  type="checkbox"
                  checked={taskReminderPopover.reminderNotifyEmail ?? reminderNotifyEmail}
                  onChange={(e) =>
                    setTaskReminderPopover({
                      ...taskReminderPopover,
                      reminderNotifyEmail: e.target.checked,
                    })
                  }
                  className="w-3.5 h-3.5 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                />
                <span className="font-medium flex items-center gap-1">
                  <Mail size={12} className="text-[#0071e3]" />
                  <span>Nhắc qua Email khi đến hạn</span>
                </span>
              </label>
              {(taskReminderPopover.reminderNotifyEmail ?? reminderNotifyEmail) && (
                <input
                  type="email"
                  value={taskReminderPopover.reminderEmail ?? reminderEmail}
                  onChange={(e) =>
                    setTaskReminderPopover({
                      ...taskReminderPopover,
                      reminderEmail: e.target.value,
                    })
                  }
                  placeholder="Email nhận (VD: kaka.nhdk@gmail.com)"
                  className="w-full px-3 py-1.5 rounded-xl text-[12px] bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/10">
              {taskReminderPopover.taskId && (
                <button
                  type="button"
                  onClick={() =>
                    handleSaveIndividualTaskReminder(
                      taskReminderPopover.lineIndex,
                      taskReminderPopover.taskId,
                      taskReminderPopover.taskText,
                      null
                    )
                  }
                  className="text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Hủy nhắc việc
                </button>
              )}
              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskReminderPopover(null)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveIndividualTaskReminder(
                      taskReminderPopover.lineIndex,
                      taskReminderPopover.taskId,
                      taskReminderPopover.taskText,
                      taskReminderPopover.reminderAt,
                      taskReminderPopover.reminderEmail ?? reminderEmail,
                      taskReminderPopover.reminderNotifyEmail ?? reminderNotifyEmail
                    )
                  }
                  className="px-4 py-1.5 rounded-full text-[12px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] cursor-pointer active:scale-95 shadow-xs whitespace-nowrap"
                >
                  Lưu hẹn giờ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── Apple Liquid Glass Master Reminder Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      {showReminderModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cài lịch nhắc nhở"
          onClick={() => setShowReminderModal(false)}
          className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-black/25 dark:bg-black/50 backdrop-blur-md select-none animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[460px] max-h-[85vh] flex flex-col bg-white/85 dark:bg-[#1e1e24]/85 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden text-left animate-in zoom-in-95 duration-150"
          >
            {/* Fixed Header */}
            <div className="p-4 sm:px-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-black/[0.01] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-2xs shrink-0">
                  <SFBellBadge size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-[14.5px] text-[#1d1d1f] dark:text-white leading-tight truncate">
                    Cài Lịch Nhắc Nhở
                  </h4>
                  <p className="text-[11.5px] text-[#6e6e73] dark:text-[#a1a1a6] truncate mt-0.5">
                    {activeNote.title ? `Cho "${activeNote.title}"` : 'Hẹn giờ thông báo tự động'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="w-6.5 h-6.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <SFXmark size={14} />
              </button>
            </div>

            {/* Scrollable Body with Ultra-Thin Apple Scrollbar */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/25">
              {/* Section 1: Quick Presets */}
              <div className="space-y-2">
                <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 block">
                  <SFWandAndSparkles size={13} className="text-amber-500" />
                  <span>Gợi ý thời gian nhanh</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(30)}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    ⚡ Sau 30 phút nữa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTime(15, 0)}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    ☀️ Chiều nay 15:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTime(9, 0, true)}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    🌅 Sáng mai 09:00
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyNextMonday}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-amber-500/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-amber-700 dark:hover:text-amber-300 transition-all text-left border border-black/[0.06] dark:border-white/10 hover:border-amber-500/30 cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    📅 Thứ Hai tới 08:30
                  </button>
                </div>
              </div>

              {/* Section 2: Custom Date & Time Picker */}
              <div className="space-y-2">
                <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 block">
                  <SFClock size={13} className="text-[#0071e3] dark:text-[#2997ff]" />
                  <span>Thời gian nhắc hẹn cụ thể</span>
                </label>
                <input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] font-medium bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20 focus:border-[#0071e3] dark:focus:border-[#2997ff] focus:ring-2 focus:ring-[#0071e3]/20 outline-none text-[#1d1d1f] dark:text-white transition-all shadow-2xs"
                />
              </div>

              {/* Section 3: Checklist Tasks List (ONLY if this note actually has checklist rows!) */}
              {checklistRows.length > 0 && (
                <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                      <SFCheckmarkSquare size={13} className="text-emerald-500" />
                      <span>Hẹn giờ riêng từng mục việc ({checklistRows.length} việc)</span>
                    </label>
                  </div>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {checklistRows.map((row) => (
                      <div
                        key={row.taskId}
                        className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/10 text-[12px]"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className={row.completed ? 'line-through opacity-50' : 'font-medium truncate'}>
                            {row.text || '(Chưa nhập nội dung việc)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {row.reminderAt ? (
                            <span className="text-[11px] font-mono text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <SFClock size={10} />
                              {formatReminderBadge(row.reminderAt)}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setTaskReminderPopover({
                                lineIndex: row.lineIndex,
                                taskId: row.taskId,
                                taskText: row.text,
                                reminderAt: row.reminderAt
                                  ? toDatetimeLocal(new Date(row.reminderAt))
                                  : toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)),
                                reminderEmail: activeNote.reminderEmail || reminderEmail,
                                reminderNotifyEmail: activeNote.reminderNotifyEmail ?? reminderNotifyEmail,
                              })
                            }
                            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20 transition-colors cursor-pointer"
                          >
                            {row.reminderAt ? 'Đổi giờ' : 'Hẹn giờ'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Notification Channels */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 space-y-3">
                <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
                  Kênh nhận thông báo
                </label>

                {/* Option 1: Desktop Browser Notification */}
                <label className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/10 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#0071e3]/15 text-[#0071e3] flex items-center justify-center">
                      <SFBell size={14} />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white">
                        Thông báo màn hình (Desktop)
                      </div>
                      <div className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                        Hiện popup và phát chuông khi đến hạn
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminderDesktop}
                    onChange={(e) => setReminderDesktop(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                  />
                </label>

                {/* Option 2: Email Notification */}
                <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/10 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Mail size={14} />
                      </div>
                      <div>
                        <div className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white">
                          Gửi email nhắc nhở tự động
                        </div>
                        <div className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                          Nhận thư nhắc việc đến hòm thư của bạn
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={reminderNotifyEmail}
                      onChange={(e) => setReminderNotifyEmail(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                    />
                  </label>

                  {reminderNotifyEmail && (
                    <div className="pt-2 border-t border-black/[0.04] dark:border-white/10 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={reminderEmail}
                          onChange={(e) => setReminderEmail(e.target.value)}
                          placeholder="Địa chỉ email nhận (VD: kaka.nhdk@gmail.com)"
                          className="flex-1 px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-black/20 border border-black/15 dark:border-white/20 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white shadow-2xs"
                        />
                        <button
                          type="button"
                          disabled={isSendingTestEmail}
                          onClick={handleSendTestEmail}
                          className="px-3 py-2 rounded-xl text-[11.5px] font-medium bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] border border-[#0071e3]/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                          title="Gửi thử một email mẫu để kiểm tra hòm thư"
                        >
                          {isSendingTestEmail ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          <span>Gửi thử</span>
                        </button>
                      </div>

                      {/* SMTP status indicator & inline configuration */}
                      <div className="flex items-center justify-between text-[11px] px-1 text-[#86868b]">
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${smtpStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>
                            {smtpStatus?.configured
                              ? `Máy chủ gửi thư: ${smtpStatus.smtpUser || 'Đã kích hoạt'}`
                              : 'Chưa cấu hình máy chủ gửi Gmail'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSmtpConfig(!showSmtpConfig)}
                          className="text-[#0071e3] hover:underline font-medium cursor-pointer"
                        >
                          {showSmtpConfig ? 'Ẩn cấu hình' : 'Cấu hình SMTP'}
                        </button>
                      </div>

                      {showSmtpConfig && (
                        <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[11.5px] text-[#1d1d1f] dark:text-white">
                              Cài đặt Gmail App Password
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSmtpConfig(false)}
                              className="text-[#86868b] hover:text-[#1d1d1f] text-[11px]"
                            >
                              Đóng
                            </button>
                          </div>
                          <p className="text-[11px] text-[#86868b] leading-tight">
                            Nhập tài khoản Gmail và Mật khẩu ứng dụng (Google App Password 16 chữ cái) để hệ thống gửi thư:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <input
                              type="email"
                              value={smtpEmailInput}
                              onChange={(e) => setSmtpEmailInput(e.target.value)}
                              placeholder="Email gửi (VD: mygmail@gmail.com)"
                              className="px-2.5 py-1.5 rounded-lg text-[11.5px] bg-white dark:bg-black/30 border border-black/15 dark:border-white/20 outline-none"
                            />
                            <input
                              type="password"
                              value={smtpPassInput}
                              onChange={(e) => setSmtpPassInput(e.target.value)}
                              placeholder="Mật khẩu ứng dụng (16 ký tự)"
                              className="px-2.5 py-1.5 rounded-lg text-[11.5px] bg-white dark:bg-black/30 border border-black/15 dark:border-white/20 outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={isConfiguringSmtp}
                            onClick={handleSaveSmtpConfig}
                            className="w-full py-1.5 rounded-lg bg-[#0071e3] text-white font-semibold text-[11.5px] hover:bg-[#0077ed] transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isConfiguringSmtp ? 'Đang kiểm tra kết nối...' : 'Lưu & Kích hoạt gửi thư'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed Pinned Footer */}
            <div className="p-3.5 sm:px-5 border-t border-black/[0.06] dark:border-white/10 shrink-0 bg-black/[0.01] dark:bg-white/[0.02] flex items-center justify-between gap-2">
              {activeNote.reminderAt ? (
                <button
                  type="button"
                  onClick={handleRemoveNoteReminder}
                  className="px-3 py-1.5 rounded-full text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  Hủy lịch ghi chú
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  className="px-4.5 py-1.5 rounded-full text-[12px] font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  Lưu lịch nhắc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── Apple PIN Lock Config Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      {showLockConfigModal && activeNote && (!activeNote.isLocked || unlockedNoteIds.includes(activeNote.id)) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cài đặt mã PIN"
          onClick={() => {
            setShowLockConfigModal(false);
            setLockNewPassword('');
            setLockConfirmPassword('');
            setLockConfigMismatch(false);
          }}
          className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-black/25 dark:bg-black/50 backdrop-blur-md select-none animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              const input = document.getElementById('apple-pin-config-input') as HTMLInputElement | null;
              input?.focus();
            }}
            className={cn(
              "w-full max-w-[340px] bg-white/85 dark:bg-[#1e1e24]/85 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 text-center space-y-5 animate-in zoom-in-95 duration-150 relative cursor-default",
              lockConfigMismatch && "apple-shake"
            )}
          >
            {/* Header */}
            <div className="space-y-1.5 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs mx-auto mb-3">
                <Lock size={22} />
              </div>
              <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
                {activeNote.isLocked ? 'Đổi mã PIN bảo vệ' : 'Cài mã PIN bảo vệ'}
              </h3>
              <p className="text-[12.5px] text-[#86868b] dark:text-[#a1a1a6] min-h-[18px]">
                {lockNewPassword.length < 6
                  ? 'Nhập mã PIN 6 số mới'
                  : lockConfigMismatch
                  ? 'Mã xác nhận không khớp! Vui lòng nhập lại'
                  : 'Nhập lại mã PIN để xác nhận'}
              </p>
            </div>

            {/* 6 Visual PIN Dots */}
            <div className="flex items-center justify-center gap-3.5 my-4 cursor-pointer relative">
              {Array.from({ length: 6 }).map((_, i) => {
                const isConfirming = lockNewPassword.length === 6;
                const currentPin = isConfirming ? lockConfirmPassword : lockNewPassword;
                const isFilled = i < currentPin.length;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-4 h-4 rounded-full transition-all duration-150",
                      lockConfigMismatch
                        ? "bg-rose-500 shadow-xs scale-110"
                        : isFilled
                        ? "bg-[#0071e3] shadow-xs scale-110"
                        : "border-2 border-black/20 dark:border-white/25 bg-transparent"
                    )}
                  />
                );
              })}

              {/* Hidden active input covering dots area with autoFocus & strictly digits only */}
              <input
                id="apple-pin-config-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={lockNewPassword.length < 6 ? lockNewPassword : lockConfirmPassword}
                onKeyDown={(e) => {
                  if (['Backspace', 'Tab', 'Escape'].includes(e.key)) {
                    if (e.key === 'Escape') {
                      setShowLockConfigModal(false);
                      setLockNewPassword('');
                      setLockConfirmPassword('');
                      setLockConfigMismatch(false);
                    }
                    if (e.key === 'Backspace') {
                      e.preventDefault();
                      if (lockConfirmPassword.length > 0) {
                        setLockConfirmPassword((prev) => prev.slice(0, -1));
                        setLockConfigMismatch(false);
                      } else if (lockNewPassword.length > 0) {
                        setLockNewPassword((prev) => prev.slice(0, -1));
                        setLockConfigMismatch(false);
                      }
                    }
                    return;
                  }
                  if (!/^[0-9]$/.test(e.key)) {
                    e.preventDefault();
                    return;
                  }
                  // Allow numeric digit
                  e.preventDefault();
                  const digit = e.key;
                  if (lockNewPassword.length < 6) {
                    setLockNewPassword((prev) => prev + digit);
                  } else if (lockConfirmPassword.length < 6) {
                    const nextConfirm = lockConfirmPassword + digit;
                    setLockConfirmPassword(nextConfirm);
                    if (nextConfirm.length === 6) {
                      if (nextConfirm === lockNewPassword) {
                        // Password matches! Save PIN immediately
                        handleSaveLockPassword(lockNewPassword, nextConfirm);
                      } else {
                        // Mismatch!
                        setLockConfigMismatch(true);
                        toast.error('Mã xác nhận không khớp! Đang làm mới...', { id: 'note-lock-err' });
                        setTimeout(() => {
                          setLockConfirmPassword('');
                          setLockConfigMismatch(false);
                          const input = document.getElementById('apple-pin-config-input') as HTMLInputElement | null;
                          input?.focus();
                        }, 500);
                      }
                    }
                  }
                }}
                onChange={() => {}} // Controlled by onKeyDown for exact numeric capture
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>

            {/* Sub-step indicator pill */}
            <div className="flex items-center justify-center">
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b] dark:text-[#a1a1a6]">
                {lockNewPassword.length < 6 ? 'Bước 1/2: Đặt PIN mới' : 'Bước 2/2: Xác nhận lại PIN'}
              </span>
            </div>

            {/* Action buttons (No "Chạm để xác nhận mã PIN" button!) */}
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/10">
              {activeNote.isLocked ? (
                <button
                  type="button"
                  onClick={handleRemoveLockPassword}
                  className="text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Gỡ khóa
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLockConfigModal(false);
                    setLockNewPassword('');
                    setLockConfirmPassword('');
                    setLockConfigMismatch(false);
                  }}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ─────────────────── Snipping Tool Interactive Overlay ─────────────────── */}
      {snippingSnapshot && (
        <SnippingToolOverlay
          snapshotDataUrl={snippingSnapshot}
          onCropComplete={handleSnippingCropComplete}
          onCancel={() => setSnippingSnapshot(null)}
        />
      )}



      {/* ─────────────────── Liquid Glass Full-Size Image Lightbox Portal ─────────────────── */}
      {lightboxImage &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh chi tiết"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                e.stopPropagation();
                setLightboxImage(null);
                setLightboxZoom(1);
              }
            }}
            className="fixed inset-0 z-[10002] bg-black/80 dark:bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
          >
            {/* Top Floating Pill Capsule Toolbar */}
            <header
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl flex items-center justify-between px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white shrink-0 z-20 animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-white/80 shrink-0">
                  <SFPhoto size={13} />
                </div>
                <span className="text-[13px] font-semibold truncate max-w-xs text-white">
                  {lightboxImage.name || 'Ảnh ghi chú'}
                </span>
                {lightboxImage.size && (
                  <span className="text-[11px] font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                    {formatFileSize(lightboxImage.size)}
                  </span>
                )}
              </div>

              {/* Pure Icon Buttons - Liquid Glass Style */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyImage(lightboxImage)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer border border-white/15 shadow-xs"
                  title="Sao chép ảnh (Ctrl+C)"
                >
                  <SFSquareOnSquare size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => downloadImage(lightboxImage.url, lightboxImage.name)}
                  className="w-8 h-8 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-[#0071e3]/40 border border-white/25"
                  title="Tải ảnh về máy"
                >
                  <SFArrowDownToLine size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleDeleteImage(lightboxImage.id, lightboxImage.url);
                    setLightboxImage(null);
                    setLightboxZoom(1);
                  }}
                  className="w-8 h-8 rounded-full bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white active:scale-90 flex items-center justify-center transition-all cursor-pointer border border-rose-500/30"
                  title="Xóa ảnh khỏi ghi chú"
                >
                  <SFTrash size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLightboxImage(null);
                    setLightboxZoom(1);
                  }}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white active:scale-90 flex items-center justify-center transition-all cursor-pointer border border-white/20 ml-1"
                  title="Đóng xem ảnh (Esc)"
                >
                  <SFXmark size={15} />
                </button>
              </div>
            </header>

            {/* Main Stage with Floating Image & Chevrons & Outside Click Listener */}
            <main
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.stopPropagation();
                  setLightboxImage(null);
                  setLightboxZoom(1);
                }
              }}
              className="flex-1 w-full flex items-center justify-center relative my-2 overflow-hidden cursor-zoom-out"
            >
              {/* Previous Image Chevron */}
              {noteImages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all cursor-pointer shadow-lg z-20"
                  title="Ảnh trước (Phím Mũi tên trái)"
                >
                  <SFChevronLeft size={18} />
                </button>
              )}

              <img
                src={lightboxImage.url}
                alt={lightboxImage.name || 'Ảnh chi tiết'}
                onClick={(e) => e.stopPropagation()}
                style={{ transform: `scale(${lightboxZoom})` }}
                className="max-h-[calc(100vh-170px)] max-w-[90vw] object-contain rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.5)] border border-white/15 select-none transition-transform duration-200 cursor-default"
              />

              {/* Next Image Chevron */}
              {noteImages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all cursor-pointer shadow-lg z-20"
                  title="Ảnh kế tiếp (Phím Mũi tên phải)"
                >
                  <SFChevronRight size={18} />
                </button>
              )}
            </main>

            {/* Bottom Floating Pill - Zoom Controls & Counter */}
            <footer
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white text-[12px] shrink-0 z-20 animate-in slide-in-from-bottom-2 duration-200"
            >
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                className="w-7 h-7 rounded-full hover:bg-white/15 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
                title="Thu nhỏ (-)"
              >
                -
              </button>

              <button
                type="button"
                onClick={() => setLightboxZoom(1)}
                className="px-2 py-0.5 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer font-mono text-[11px]"
                title="Tỉ lệ ban đầu (Phím 0)"
              >
                {Math.round(lightboxZoom * 100)}%
              </button>

              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="w-7 h-7 rounded-full hover:bg-white/15 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
                title="Phóng to (+)"
              >
                +
              </button>

              {noteImages.length > 1 && (
                <>
                  <span className="w-[1px] h-3.5 bg-white/20" />
                  <span className="font-mono text-white/70 text-[11px]">
                    {currentImageIndex + 1} / {noteImages.length}
                  </span>
                </>
              )}
            </footer>
          </div>,
          document.body
        )}

      {/* ─────────────────── Apple QuickLook File Preview Modal ─────────────────── */}
      {filePreviewModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Xem trước tệp ${filePreviewModal.name}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                e.stopPropagation();
                setFilePreviewModal(null);
              }
            }}
            className="fixed inset-0 z-[10010] bg-black/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-180"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl h-[85vh] max-h-[850px] bg-white dark:bg-[#1c1c24] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.55)] border border-black/10 dark:border-white/12 flex flex-col overflow-hidden animate-in zoom-in-95 duration-180"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] shrink-0">
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    className="shrink-0"
                    dangerouslySetInnerHTML={{ __html: getAppleDocSvg(filePreviewModal.ext) }}
                  />
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate" title={filePreviewModal.name}>
                      {filePreviewModal.name}
                    </h3>
                    <p className="text-[11px] text-[#86868b] font-mono">
                      {filePreviewModal.ext.toUpperCase()} {filePreviewModal.size && `• ${filePreviewModal.size}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={filePreviewModal.url}
                    download={filePreviewModal.name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Tải xuống tệp tin"
                  >
                    <span>↓ Tải xuống</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteFileFromPreview(filePreviewModal.url, filePreviewModal.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500 text-rose-600 hover:text-white dark:text-rose-400 text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-95 border border-rose-500/30"
                    title="Xóa tệp này khỏi ghi chú"
                  >
                    <SFTrash size={13} />
                    <span>Xóa tệp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilePreviewModal(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Đóng (Esc)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Preview Body - Multi-format In-App QuickLook */}
              <div className="flex-1 overflow-auto p-3 sm:p-4 flex items-center justify-center bg-[#f8f9fa] dark:bg-[#131317]">
                {isPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center p-8 text-[#86868b] space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0071e3]" />
                    <span className="text-[13px] font-medium">Đang giải nạp và chuẩn bị xem trước tệp...</span>
                  </div>
                ) : filePreviewModal.ext.toLowerCase() === 'pdf' ? (
                  <iframe
                    src={previewBlobUrl || filePreviewModal.url}
                    className="w-full h-full rounded-xl border border-black/10 dark:border-white/10 shadow-sm bg-white"
                    title={filePreviewModal.name}
                  />
                ) : ['xlsx', 'xls'].includes(filePreviewModal.ext.toLowerCase()) ? (
                  excelPreview && excelPreview.sheets.length > 0 ? (
                    <div className="w-full h-full flex flex-col bg-white dark:bg-[#1a1a22] rounded-xl border border-black/10 dark:border-white/10 overflow-hidden shadow-sm">
                      {/* Sheets Tab Bar */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-black/[0.06] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] overflow-x-auto shrink-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {excelPreview.sheets.map((s, idx) => (
                            <button
                              key={s.name + idx}
                              type="button"
                              onClick={() => setExcelPreview({ ...excelPreview, activeSheetIndex: idx })}
                              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                                excelPreview.activeSheetIndex === idx
                                  ? 'bg-[#217346] text-white shadow-xs font-semibold'
                                  : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/10'
                              }`}
                            >
                              📊 {s.name}
                            </button>
                          ))}
                        </div>
                        {excelPreview.sheets[excelPreview.activeSheetIndex] && (
                          <span className="text-[11px] font-mono text-[#86868b] shrink-0 ml-3">
                            {excelPreview.sheets[excelPreview.activeSheetIndex].totalRows} dòng • {excelPreview.sheets[excelPreview.activeSheetIndex].totalCols} cột
                          </span>
                        )}
                      </div>

                      {/* Spreadsheet Table View */}
                      <div className="flex-1 overflow-auto p-0 scrollbar-thin">
                        {(() => {
                          const curSheet = excelPreview.sheets[excelPreview.activeSheetIndex];
                          if (!curSheet || curSheet.rows.length === 0) {
                            return <div className="p-8 text-center text-[#86868b] text-[13px]">Trang tính trống không có dữ liệu</div>;
                          }
                          return (
                            <table className="w-full border-collapse text-[12px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                              <thead>
                                <tr className="bg-black/[0.03] dark:bg-white/[0.05] sticky top-0 z-10 border-b border-black/[0.08] dark:border-white/10">
                                  <th className="w-10 px-2 py-1.5 text-center font-mono text-[10.5px] text-[#86868b] border-r border-black/[0.06] dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06]">#</th>
                                  {Array.from({ length: curSheet.totalCols || (curSheet.rows[0]?.length || 1) }).map((_, cIdx) => {
                                    const colLetter = String.fromCharCode(65 + (cIdx % 26));
                                    return (
                                      <th key={cIdx} className="px-3 py-1.5 text-left font-mono text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] border-r border-black/[0.06] dark:border-white/10 whitespace-nowrap">
                                        {colLetter}
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {curSheet.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-black/[0.04] dark:border-white/[0.06] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                    <td className="px-2 py-1 text-center font-mono text-[10.5px] text-[#86868b] border-r border-black/[0.06] dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] select-none">
                                      {rIdx + 1}
                                    </td>
                                    {Array.from({ length: curSheet.totalCols || row.length }).map((_, cIdx) => (
                                      <td key={cIdx} className="px-3 py-1.5 border-r border-black/[0.04] dark:border-white/[0.06] whitespace-nowrap max-w-[280px] truncate" title={String(row[cIdx] ?? '')}>
                                        {String(row[cIdx] ?? '')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-[#86868b] text-[13px]">Không thể nạp nội dung trang tính</div>
                  )
                ) : filePreviewModal.ext.toLowerCase() === 'docx' && docxPreview && docxPreview.length > 0 ? (
                  <div className="w-full h-full overflow-y-auto p-4 sm:p-8 flex justify-center">
                    <div className="w-full max-w-3xl bg-white dark:bg-[#1a1a20] rounded-2xl border border-black/10 dark:border-white/10 p-6 sm:p-10 shadow-lg space-y-3.5 text-left font-sans select-text">
                      {docxPreview.map((b, idx) => {
                        if (b.type === 'h1') {
                          return <h1 key={idx} className="text-[20px] font-bold text-[#1d1d1f] dark:text-white pt-2 border-b pb-1 border-black/10 dark:border-white/10">{b.text}</h1>;
                        }
                        if (b.type === 'h2') {
                          return <h2 key={idx} className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white pt-1">{b.text}</h2>;
                        }
                        if (b.type === 'h3') {
                          return <h3 key={idx} className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">{b.text}</h3>;
                        }
                        if (b.type === 'li') {
                          return (
                            <div key={idx} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] pl-3">
                              <span className="text-[#0071e3] mt-1.5">•</span>
                              <span>{b.text}</span>
                            </div>
                          );
                        }
                        if (b.type === 'table' && b.tableRows) {
                          return (
                            <div key={idx} className="overflow-x-auto my-3 rounded-lg border border-black/10 dark:border-white/10">
                              <table className="w-full border-collapse text-[12.5px]">
                                <tbody>
                                  {b.tableRows.map((tr, rIdx) => (
                                    <tr key={rIdx} className={rIdx === 0 ? 'bg-black/[0.04] dark:bg-white/[0.06] font-semibold' : 'border-t border-black/5 dark:border-white/5'}>
                                      {tr.map((tc, cIdx) => (
                                        <td key={cIdx} className="px-3 py-1.5 border-r border-black/5 dark:border-white/5">{tc}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        return <p key={idx} className="text-[13.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7]">{b.text}</p>;
                      })}
                    </div>
                  </div>
                ) : filePreviewModal.ext.toLowerCase() === 'pptx' && pptxPreview && pptxPreview.length > 0 ? (
                  <div className="w-full h-full overflow-y-auto p-4 sm:p-6 space-y-4">
                    {pptxPreview.map((s) => (
                      <div key={s.slideNum} className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#1a1a20] border border-black/10 dark:border-white/10 p-6 shadow-md text-left space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#d24726]/12 text-[#d24726]">Trang chiếu {s.slideNum}</span>
                          <span className="text-[11px] text-[#86868b]">PowerPoint Slide</span>
                        </div>
                        {s.texts.map((t, tIdx) => (
                          <p key={tIdx} className={tIdx === 0 ? 'text-[16px] font-bold text-[#1d1d1f] dark:text-white pt-1' : 'text-[13px] text-[#48484a] dark:text-[#d1d1d6] pl-3'}>
                            {tIdx > 0 && <span className="text-[#d24726] mr-1.5">•</span>}
                            {t}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(filePreviewModal.ext.toLowerCase()) ? (
                  <img
                    src={previewBlobUrl || filePreviewModal.url}
                    alt={filePreviewModal.name}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-black/10 dark:border-white/10"
                  />
                ) : ['mp3', 'wav', 'm4a', 'ogg'].includes(filePreviewModal.ext.toLowerCase()) ? (
                  <div className="p-8 flex flex-col items-center gap-4 bg-white dark:bg-[#1a1a20] rounded-2xl border border-black/10 dark:border-white/10 shadow-md">
                    <div className="w-16 h-16 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center text-[24px]">🎵</div>
                    <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">{filePreviewModal.name}</h4>
                    <audio controls src={previewBlobUrl || filePreviewModal.url} className="w-72 sm:w-96" />
                  </div>
                ) : ['mp4', 'webm', 'mov'].includes(filePreviewModal.ext.toLowerCase()) ? (
                  <video controls src={previewBlobUrl || filePreviewModal.url} className="max-w-full max-h-full rounded-2xl shadow-lg border border-black/10 dark:border-white/10" />
                ) : ['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'log', 'xml', 'yaml', 'yml'].includes(filePreviewModal.ext.toLowerCase()) ? (
                  <div className="w-full h-full overflow-auto p-4 rounded-xl bg-white dark:bg-[#1a1a20] border border-black/10 dark:border-white/10 font-mono text-[12.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap select-text">
                    {previewTextContent !== null ? previewTextContent : 'Đang nạp nội dung văn bản...'}
                  </div>
                ) : (
                  <div className="text-center py-10 px-6 max-w-md">
                    <div
                      className="inline-block mb-4 p-4 rounded-3xl bg-black/[0.04] dark:bg-white/[0.06] shadow-inner"
                      dangerouslySetInnerHTML={{
                        __html: getAppleDocSvg(filePreviewModal.ext).replace('width="26" height="32"', 'width="64" height="78"')
                      }}
                    />
                    <h4 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5 break-words">
                      {filePreviewModal.name}
                    </h4>
                    <p className="text-[12.5px] text-[#86868b] leading-relaxed mb-5">
                      Tệp định dạng <strong>.{filePreviewModal.ext.toUpperCase()}</strong> ({filePreviewModal.size || 'tệp đính kèm'}). Bạn có thể tải về để mở bằng ứng dụng tương ứng trên máy tính.
                    </p>
                    <a
                      href={filePreviewModal.url}
                      download={filePreviewModal.name}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Tải xuống tệp tin ({filePreviewModal.size})</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>,
    document.body
  );
};
