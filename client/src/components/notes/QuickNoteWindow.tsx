import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  SFChevronDown,
  SFChevronUp,
  SFWandAndSparkles,
  SFKey,
  SFKeyFill,
  SFChecklist,
  SFListBullet,
  SFListNumber,
  SFTextQuote,
  SFCheckmarkCircle,
  SFBriefcase,
  SFDocumentOnDocument,
  SFGlobe,
  SFLock,
  SFLockOpen,
  SFPaperclip,
  SFArrowClockwise,
  SFEnvelope,
  SFPaperplaneFill,
  SFGearshape,
  SFArrowUpLeftAndArrowDownRight,
  SFArrowDownRightAndArrowUpLeft,
  SFUnderline,
  SFStrikethrough,
  SFScissors,
  SFEye,
  SFEyeSlash,
  AppleNotesBadge,
} from '@/components/ui/AppleIcon';
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
  testGeminiApiKey,
} from '@/services/writingToolsService';
import { attachmentService } from '@/services/attachmentService';
import { CloseButton } from '@/components/ui/close-button';
import { AppleLiquidDialog } from '@/components/ui/AppleLiquidDialog';
import { AppleDateTimePicker } from '@/components/ui/AppleDateTimePicker';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';
import { sanitizeNoteHTML } from '@/services/backupService';
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
 * Sound effects disabled per user request
 */
const playPopSound = () => {
  // Silent no-op: sound effects disabled across app
};

/**
 * Ensures checklist text is clean markdown checkboxes without any HTML tags or file attachments
 */
const cleanChecklistText = (raw?: string | null): string => {
  if (!raw || !raw.trim()) return '- [ ] ';
  let text = raw
    .replace(/<span\b[^>]*class=["'][^"']*apple-file-attachment[^"']*["'][\s\S]*?<\/span>/gi, '')
    .replace(/<div\b[^>]*class=["'][^"']*apple-img-wrapper[^"']*["'][\s\S]*?<\/div>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n');

  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s+/, ''))
    .filter((l) => Boolean(l && l.trim()));

  const validLines = lines.filter((l) => /^(?:-\s*)?\[([ xX])\]/.test(l));
  if (validLines.length > 0) return validLines.join('\n');
  return '- [ ] ';
};

/**
 * Convert AI/plain-text output into checklist-only content.
 * To-do must never persist generated text in the note HTML `content` field.
 */
const normalizeChecklistDraft = (raw?: string | null): string => {
  if (!raw || !raw.trim()) return '- [ ] ';

  const cleaned = raw
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n');

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*•]\s*|\d+[.)]\s*)/, '').trim())
    .filter(Boolean);

  return lines.length > 0 ? lines.map((line) => `- [ ] ${line}`).join('\n') : '- [ ] ';
};

/**
 * Convert multiline plain text (from AI draft) into cleanly formatted note paragraph blocks,
 * preserving line breaks and paragraph structure exactly without collapsing lines into one run-on paragraph.
 */
const convertTextToNoteBlocks = (text: string): HTMLElement[] => {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  return lines.map((line) => {
    const p = document.createElement('p');
    if (!line.trim()) {
      p.appendChild(document.createElement('br'));
    } else {
      p.textContent = line;
    }
    return p;
  });
};

interface ChecklistRow {
  lineIndex: number;
  taskId: string;
  completed: boolean;
  text: string;
  reminderAt?: string | null;
}

/**
 * Extract precise client rects of selected text nodes only.
 * This guarantees ZERO bounding boxes for block elements (<p>, <div>, <ul>, etc.)
 * and strictly isolates only the characters the user has actually highlighted.
 */
const getStrictSelectionLineRects = (
  range: Range,
  canvasRect: DOMRect
): Array<{ top: number; left: number; width: number; height: number }> => {
  if (range.collapsed) return [];

  const textNodes: Text[] = [];
  const root = range.commonAncestorContainer;

  if (root.nodeType === Node.TEXT_NODE) {
    if (root.textContent && root.textContent.trim().length > 0) {
      textNodes.push(root as Text);
    }
  } else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        try {
          if (!node.textContent || node.textContent.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } catch {
          return NodeFilter.FILTER_REJECT;
        }
      },
    });

    let curr = walker.currentNode;
    if (curr && curr.nodeType === Node.TEXT_NODE && curr.textContent && curr.textContent.trim().length > 0) {
      try {
        if (range.intersectsNode(curr)) textNodes.push(curr as Text);
      } catch {}
    }
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }
  }

  const rawRects: DOMRect[] = [];

  for (const node of textNodes) {
    const text = node.textContent;
    if (!text || text.trim().length === 0) continue;

    let start = node === range.startContainer ? range.startOffset : 0;
    let end = node === range.endContainer ? range.endOffset : text.length;

    // Skip leading & trailing whitespace characters so the rect hugs only the visible text
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;

    if (end <= start) continue;

    const nodeRange = document.createRange();
    try {
      nodeRange.setStart(node, start);
      nodeRange.setEnd(node, end);
      const clientRects = nodeRange.getClientRects();
      for (let i = 0; i < clientRects.length; i++) {
        const r = clientRects[i];
        if (r.width > 2 && r.height > 2) {
          rawRects.push(r);
        }
      }
    } catch {}
  }

  if (rawRects.length === 0) return [];

  // Group and merge rects on the same visual line (within 5px vertical tolerance)
  const merged: Array<{ top: number; left: number; width: number; height: number }> = [];

  for (const r of rawRects) {
    const relTop = r.top - canvasRect.top;
    const relLeft = r.left - canvasRect.left;

    const existing = merged.find(
      (m) => Math.abs(m.top - relTop) < 6 && Math.abs(m.height - r.height) < 8
    );

    if (existing) {
      const newLeft = Math.min(existing.left, relLeft);
      const newRight = Math.max(existing.left + existing.width, relLeft + r.width);
      existing.left = newLeft;
      existing.width = newRight - newLeft;
      existing.top = Math.min(existing.top, relTop);
      existing.height = Math.max(existing.height, r.height);
    } else {
      merged.push({
        top: relTop,
        left: relLeft,
        width: r.width,
        height: r.height,
      });
    }
  }

  // Filter out any empty lines/whitespace gaps
  return merged
    .filter((m) => m.width > 4 && m.height > 4)
    .sort((a, b) => a.top - b.top || a.left - b.left);
};

/**
 * Ensure note content is well-formed & strictly sanitized HTML for rich text editing
 */
const ensureHtml = (content: string): string => {
  if (!content) return '<p><br></p>';
  // 1. Sanitize HTML to prevent Stored & DOM-based XSS attacks
  let cleaned = sanitizeNoteHTML(content);

  // Clean up any accidentally escaped or nested <p> tags
  cleaned = cleaned
    .replace(/&lt;p&gt;/gi, '')
    .replace(/&lt;\/p&gt;/gi, '')
    .replace(/<p>\s*<p>/gi, '<p>')
    .replace(/<\/p>\s*<\/p>/gi, '</p>');

  // Normalize headings: Strip redundant <b> or <strong> tags inside headings so all headings render uniformly
  cleaned = cleaned.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, lvl, attrs, inner) => {
    return `<h${lvl}${attrs}>${inner.replace(/<\/?(?:b|strong)>/gi, '')}</h${lvl}>`;
  });

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

  // Tự động phục hồi (Self-Healing) các thẻ file đính kèm nếu từng bị strip mất SVG hoặc button
  if (typeof document !== 'undefined' && cleaned.includes('apple-file-attachment')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleaned, 'text/html');
      let modified = false;
      const fileCards = Array.from(doc.querySelectorAll('.apple-file-attachment'));
      fileCards.forEach((card) => {
        // Kiểm tra xem thẻ có bị thiếu SVG, thiếu nút hành động hoặc đang dùng màu sặc sỡ cũ không
        const hasSvg = !!card.querySelector('svg');
        const hasActions = !!card.querySelector('.apple-file-preview-btn, .apple-file-download-btn, .apple-file-delete-btn');
        const hasOldColoredStyle = card.outerHTML.includes('rgba(0,113,227') || card.outerHTML.includes('rgba(52,199,89') || card.outerHTML.includes('rgba(255,59,48');
        if (!hasSvg || !hasActions || hasOldColoredStyle) {
          modified = true;
          const fileId = card.getAttribute('data-file-id') || '';
          const fileUrl = card.getAttribute('data-file-url') || '';
          const fileName = card.getAttribute('data-file-name') || card.querySelector('.apple-file-attachment-title')?.textContent?.trim() || 'Tệp đính kèm';
          let ext = card.getAttribute('data-file-ext') || '';
          if (!ext && fileName.includes('.')) {
            ext = fileName.split('.').pop() || '';
          }
          const sizeStr = card.getAttribute('data-file-size') || card.querySelector('.apple-file-attachment-size')?.textContent?.trim() || '';

          const fileIdOrUrl = fileId || fileUrl || '#';
          const freshHtml = generateFileCardHtml(fileIdOrUrl, fileName, ext, sizeStr);
          
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = freshHtml;
          const freshCard = tempDiv.querySelector('.apple-file-attachment');
          if (freshCard) {
            card.replaceWith(freshCard);
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
  // Strip heavy data: URLs (>50k chars) before parsing DOM to prevent main thread freezing
  let cleaned = html.length > 50000 ? html.replace(/data:[^"'\s)]+/g, '') : html;
  cleaned = cleaned.replace(/<span\b[^>]*class=["'][^"']*apple-file-attachment[^"']*["'][^>]*data-file-name=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi, ' 📎 $1 ');
  cleaned = cleaned.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
  const formatted = cleaned
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
 * Format note preview snippet for the left sidebar list (Ultra-fast, zero DOM allocation)
 */
const formatNotePreview = (content: string): string => {
  if (!content || !content.trim()) return 'Trống...';
  try {
    if (typeof document !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');

      // 1. Remove all SVGs and scripts/styles
      doc.querySelectorAll('svg, script, style').forEach((el) => el.remove());

      // 2. Replace file attachment badges with clean readable text
      doc.querySelectorAll('.apple-file-attachment').forEach((card) => {
        const name = card.getAttribute('data-file-name') || card.querySelector('.apple-file-attachment-title')?.textContent?.trim() || 'Tệp đính kèm';
        const txt = document.createTextNode(` 📎 ${name} `);
        card.replaceWith(txt);
      });

      // 3. Replace image wrappers with clean readable text
      doc.querySelectorAll('.apple-img-wrapper').forEach((wrapper) => {
        const alt = wrapper.querySelector('img')?.getAttribute('alt') || 'Hình ảnh';
        const txt = document.createTextNode(` 🖼️ ${alt} `);
        wrapper.replaceWith(txt);
      });

      const raw = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw) return 'Trống...';
      return raw.replace(/^(?:-\s*)?\[([ xX])\]\s*/, (_, check) =>
        check.toLowerCase() === 'x' ? '☑ ' : '☐ '
      );
    }
  } catch (_) {}

  // Regex fallback:
  let plain = content.replace(/<span\b[^>]*class=["'][^"']*apple-file-attachment[^"']*["'][^>]*data-file-name=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi, ' 📎 $1 ');
  plain = plain.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
  plain = plain.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return plain || 'Trống...';
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
 * Universal byte reader for Blob/HTTP URLs and base64 Data URLs
 */
const getBytesFromUrl = async (url: string): Promise<Uint8Array> => {
  if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:')) {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
  const parts = url.split(',');
  const base64 = parts[1] || parts[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Decode file or base64 data URL to text
 */
const decodeDataUrlText = async (dataUrl: string): Promise<string> => {
  try {
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http:') || dataUrl.startsWith('https:')) {
      const res = await fetch(dataUrl);
      return await res.text();
    }
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
 * Convert base64 data URL or Blob URL to native Blob
 */
const dataUrlToBlob = async (url: string): Promise<Blob> => {
  if (url.startsWith('blob:')) {
    const res = await fetch(url);
    return await res.blob();
  }
  const parts = url.split(',');
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

const parseExcelFromDataUrl = async (dataUrl: string): Promise<{ sheets: ExcelSheetPreview[]; activeSheetIndex: number } | null> => {
  try {
    const bytes = await getBytesFromUrl(dataUrl);
    const XLSX = await import('xlsx');
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
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  tableRows?: string[][];
}

const parseDocxFromDataUrl = async (dataUrl: string): Promise<DocxBlock[] | null> => {
  try {
    const buf = await getBytesFromUrl(dataUrl);
    const view = new DataView(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
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
          writer.write(compData as any);
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
        // Extract runs to preserve linebreaks
        const textNodes = child.getElementsByTagName('w:t');
        let fullText = '';
        for (let i = 0; i < textNodes.length; i++) {
          fullText += textNodes[i].textContent || '';
        }
        if (!fullText.trim()) continue;

        // Extract alignment (left, center, right, both/justify)
        const jcEl = child.getElementsByTagName('w:jc')[0];
        const jcVal = jcEl?.getAttribute('w:val') || '';
        let align: 'left' | 'center' | 'right' | 'justify' = 'left';
        if (jcVal === 'center') align = 'center';
        else if (jcVal === 'right') align = 'right';
        else if (jcVal === 'both' || jcVal === 'distribute') align = 'justify';

        // Check if paragraph has bold formatting
        const hasBold = child.getElementsByTagName('w:b').length > 0;

        const pStyle = child.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
        const numPr = child.getElementsByTagName('w:numPr')[0];
        if (pStyle.toLowerCase().includes('heading1') || pStyle === '1') {
          blocks.push({ type: 'h1', text: fullText, align });
        } else if (pStyle.toLowerCase().includes('heading2') || pStyle === '2') {
          blocks.push({ type: 'h2', text: fullText, align });
        } else if (pStyle.toLowerCase().includes('heading3') || pStyle === '3') {
          blocks.push({ type: 'h3', text: fullText, align });
        } else if (numPr) {
          blocks.push({ type: 'li', text: fullText, align });
        } else {
          blocks.push({ type: 'p', text: fullText, align, bold: hasBold });
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
    const buf = await getBytesFromUrl(dataUrl);
    const view = new DataView(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
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
          writer.write(compData as any);
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
    <button type="button" class="apple-img-delete-btn" style="position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%; background: rgba(22,22,26,0.65); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ff453a; border: 0.5px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; outline: none; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);" title="Xóa hình ảnh này"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/><line x1="6.5" y1="7" x2="6.5" y2="12"/><line x1="9.5" y1="7" x2="9.5" y2="12"/></svg></button>
  </span></p><p><br></p>`;
};

const generateFileCardHtml = (fileIdOrUrl: string, fileName: string, ext: string, sizeStr: string): string => {
  const docSvg = getAppleDocSvg(ext);

  const isAttachmentId = fileIdOrUrl.startsWith('att_');
  const fileIdAttr = isAttachmentId ? `data-file-id="${fileIdOrUrl}"` : '';
  const fileUrlAttr = !isAttachmentId ? `data-file-url="${fileIdOrUrl}"` : '';
  const downloadHref = isAttachmentId ? '#' : fileIdOrUrl;

  return `<p><span class="apple-file-attachment" contenteditable="false" data-media-type="file" ${fileIdAttr} ${fileUrlAttr} data-file-name="${fileName}" data-file-ext="${ext}" data-file-size="${sizeStr}" style="display: inline-flex; align-items: center; gap: 10px; padding: 7px 12px; margin: 6px 0; border-radius: 16px; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.08); font-size: 13px; font-weight: 500; text-decoration: none; user-select: none; box-shadow: 0 2px 6px rgba(0,0,0,0.03); vertical-align: middle; max-width: 100%;">
    ${docSvg}
    <span style="display: flex; flex-direction: column; min-width: 0; max-width: 220px; line-height: 1.25;">
      <span class="apple-file-attachment-title" style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;" title="${fileName}">${fileName}</span>
      <span class="apple-file-attachment-size" style="font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, monospace; margin-top: 1px;">${sizeStr}</span>
    </span>
    <span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;">
      <button type="button" class="apple-file-preview-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,0,0,0.04); color: #48484a; border: 1px solid rgba(0,0,0,0.08); cursor: pointer; padding: 0; outline: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 1px 2px rgba(0,0,0,0.02);" title="Xem trước tệp (Quick Look)"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.5"/></svg></button>
      <a href="${downloadHref}" download="${fileName}" class="apple-file-download-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,0,0,0.04); color: #48484a; border: 1px solid rgba(0,0,0,0.08); text-decoration: none; cursor: pointer; padding: 0; outline: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 1px 2px rgba(0,0,0,0.02);" title="Tải xuống tệp ${fileName}"><svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v8M3.5 7L7 10.5 10.5 7M2 12h10"/></svg></a>
      <button type="button" class="apple-file-delete-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,0,0,0.04); color: #48484a; border: 1px solid rgba(0,0,0,0.08); cursor: pointer; padding: 0; outline: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 1px 2px rgba(0,0,0,0.02);" title="Xóa tệp đính kèm"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/><line x1="6.5" y1="7" x2="6.5" y2="12"/><line x1="9.5" y1="7" x2="9.5" y2="12"/></svg></button>
    </span>
  </span></p><p><br></p>`;
};

/**
 * Safely removes a file or image attachment from HTML using DOMParser.
 * NEVER destroys sibling elements or unclosed tags.
 */
const removeAttachmentFromHtml = (rawHtml: string, targetUrl: string, targetName?: string): string => {
  if (!rawHtml || (!targetUrl && !targetName)) return rawHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    let modified = false;

    // 1. Check file attachment cards
    const fileBadges = Array.from(doc.querySelectorAll('.apple-file-attachment'));
    fileBadges.forEach((badge) => {
      const fileId = badge.getAttribute('data-file-id');
      const u = badge.getAttribute('data-file-url');
      const n = badge.getAttribute('data-file-name');
      const a = badge.querySelector('a');
      const href = a?.getAttribute('href');
      const download = a?.getAttribute('download');

      if (
        (targetUrl && (fileId === targetUrl || u === targetUrl || href === targetUrl)) ||
        (targetName && (n === targetName || download === targetName))
      ) {
        if (fileId) {
          attachmentService.deleteAttachment(fileId).catch(console.error);
        }
        const parent = badge.parentElement;
        badge.remove();
        modified = true;
        // Only remove parent if it is an empty paragraph with no text and no other children
        if (parent && parent.tagName.toLowerCase() === 'p' && parent.children.length === 0 && !parent.textContent?.trim()) {
          parent.remove();
        }
      }
    });

    // 2. Check inline images (.apple-img-wrapper and <img>)
    const imgWrappers = Array.from(doc.querySelectorAll('.apple-img-wrapper, img'));
    imgWrappers.forEach((el) => {
      const img = el.tagName.toLowerCase() === 'img' ? (el as HTMLImageElement) : el.querySelector('img');
      const src = img?.getAttribute('src') || '';
      const alt = img?.getAttribute('alt') || '';

      if ((targetUrl && src === targetUrl) || (targetName && alt === targetName)) {
        const targetContainer = el.closest('.apple-img-wrapper') || el;
        const parent = targetContainer.parentElement;
        targetContainer.remove();
        modified = true;
        if (parent && parent.tagName.toLowerCase() === 'p' && parent.children.length === 0 && !parent.textContent?.trim()) {
          parent.remove();
        }
      }
    });

    if (modified) {
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error('Lỗi khi xóa tệp khỏi HTML:', err);
  }
  return rawHtml;
};

export const QuickNoteWindow: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    isPinned,
    activeNoteId,
    activeTextNoteId,
    activeChecklistId,
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

  // Compact AI dropdown menu & outside click ref
  const [showCompactAiMenu, setShowCompactAiMenu] = useState(false);
  const compactAiPresence = useAnimatedPresence(showCompactAiMenu, 180);
  const compactAiMenuRef = useRef<HTMLDivElement>(null);

  // Dedicated To-do item reminder modal state (Separate from note reminder modal)
  const [todoReminderTarget, setTodoReminderTarget] = useState<{
    lineIndex: number;
    taskId: string;
    taskText: string;
    reminderAt: string;
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
  const [lockCurrentPassword, setLockCurrentPassword] = useState('');
  const [lockNewPassword, setLockNewPassword] = useState('');
  const [lockConfirmPassword, setLockConfirmPassword] = useState('');
  const [showLockNewPassword, setShowLockNewPassword] = useState(false);

  // 6-digit Passcode removal modal state (Strictly requires current PIN)
  const [showLockRemoveModal, setShowLockRemoveModal] = useState(false);
  const [lockRemoveInput, setLockRemoveInput] = useState('');
  const [lockRemoveMismatch, setLockRemoveMismatch] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [isWindowClosing, setIsWindowClosing] = useState(false);
  const closeWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const resizeRafRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close Writing Tools menu when clicking outside
  useEffect(() => {
    if (!showCompactAiMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (compactAiMenuRef.current && !compactAiMenuRef.current.contains(e.target as Node)) {
        setShowCompactAiMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showCompactAiMenu]);

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

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    // Disable CSS transitions immediately on DOM for 0ms drag latency
    if (windowRef.current) {
      windowRef.current.style.transition = 'none';
    }

    let finalX = currentX;
    let finalY = currentY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      const newX = Math.max(8, Math.min(window.innerWidth - 180, dragStartRef.current.posX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      finalX = newX;
      finalY = newY;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (!windowRef.current) return;
        const newRight = Math.max(0, window.innerWidth - newX - currentW);
        const newBottom = Math.max(0, window.innerHeight - newY - currentH);
        windowRef.current.style.right = `${newRight}px`;
        windowRef.current.style.bottom = `${newBottom}px`;
      });
    };

    const handleMouseUp = () => {
      setIsDraggingCompact(false);
      dragStartRef.current = null;
      document.body.style.userSelect = prevUserSelect;
      if (windowRef.current) {
        windowRef.current.style.transition = '';
      }
      setCompactPos({ x: finalX, y: finalY });
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  type ResizeDirection = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
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
    const startRightPx = Math.max(0, window.innerWidth - fixedRight);
    const startBottomPx = Math.max(0, window.innerHeight - fixedBottom);

    // Global cursor lock & user select prevention during rapid resize
    const cursorMap: Record<ResizeDirection, string> = {
      n: 'ns-resize',
      s: 'ns-resize',
      w: 'ew-resize',
      e: 'ew-resize',
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
    };
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = cursorMap[direction];
    document.body.style.userSelect = 'none';

    // Disable CSS transitions on DOM node immediately for 0ms lag
    if (windowRef.current) {
      windowRef.current.style.transition = 'none';
    }

    let finalW = startW;
    let finalH = startH;
    let finalX = startPosX;
    let finalY = startPosY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        if (!windowRef.current) return;

        if (isCompactWindow) {
          let targetX = startPosX;
          let targetY = startPosY;
          let targetW = startW;
          let targetH = startH;
          let targetRightPx = startRightPx;
          let targetBottomPx = startBottomPx;

          // Horizontal expansion/shrinking
          if (direction === 'nw' || direction === 'w' || direction === 'sw') {
            targetX = Math.max(8, Math.min(fixedRight - minW, startPosX + dx));
            targetW = fixedRight - targetX;
            targetRightPx = startRightPx; // Right edge is mathematically fixed!
          } else if (direction === 'ne' || direction === 'e' || direction === 'se') {
            targetW = Math.max(minW, Math.min(window.innerWidth - startPosX - 16, startW + dx));
            targetRightPx = Math.max(0, window.innerWidth - (targetX + targetW));
          }

          // Vertical expansion/shrinking
          if (direction === 'nw' || direction === 'n' || direction === 'ne') {
            targetY = Math.max(8, Math.min(fixedBottom - minH, startPosY + dy));
            targetH = fixedBottom - targetY;
            targetBottomPx = startBottomPx; // Bottom edge is mathematically fixed!
          } else if (direction === 'sw' || direction === 's' || direction === 'se') {
            targetH = Math.max(minH, Math.min(window.innerHeight - startPosY - 16, startH + dy));
            targetBottomPx = Math.max(0, window.innerHeight - (targetY + targetH));
          }

          finalW = targetW;
          finalH = targetH;
          finalX = targetX;
          finalY = targetY;

          // DIRECT DOM MUTATION: 0ms delay, 120 FPS hardware acceleration, zero React re-renders during drag
          windowRef.current.style.width = `${targetW}px`;
          windowRef.current.style.height = `${targetH}px`;
          windowRef.current.style.right = `${targetRightPx}px`;
          windowRef.current.style.bottom = `${targetBottomPx}px`;
        } else {
          // Docked window pinned to bottom-right (right: 0, bottom: 0)
          let targetW = startW;
          let targetH = startH;

          if (direction === 'nw' || direction === 'w' || direction === 'sw') {
            targetW = Math.max(minW, Math.min(window.innerWidth - 16, startW - dx));
          }
          if (direction === 'nw' || direction === 'n' || direction === 'ne') {
            targetH = Math.max(minH, Math.min(window.innerHeight - 16, startH - dy));
          }

          finalW = targetW;
          finalH = targetH;

          windowRef.current.style.width = `${targetW}px`;
          windowRef.current.style.height = `${targetH}px`;
        }
      });
    };

    const onMouseUp = () => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      if (windowRef.current) {
        windowRef.current.style.transition = '';
      }
      setIsResizing(false);
      if (isCompactWindow) {
        setCompactSize({ width: finalW, height: finalH });
        setCompactPos({ x: finalX, y: finalY });
      } else {
        setWindowSize({ width: finalW, height: finalH });
      }
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
  const lightboxPresence = useAnimatedPresence(Boolean(lightboxImage), 200);
  const lastLightboxImageRef = useRef<NoteImageAttachment | null>(null);
  if (lightboxImage) {
    lastLightboxImageRef.current = lightboxImage;
  }
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLightboxPanning, setIsLightboxPanning] = useState(false);
  const lightboxPanStartRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [snippingSnapshot, setSnippingSnapshot] = useState<string | null>(null);
  const [filePreviewModal, setFilePreviewModal] = useState<{
    fileId?: string;
    url: string;
    name: string;
    ext: string;
    size: string;
  } | null>(null);
  const lastFilePreviewModalRef = useRef<typeof filePreviewModal>(null);
  if (filePreviewModal) {
    lastFilePreviewModalRef.current = filePreviewModal;
  }
  const currentFilePreview = filePreviewModal || lastFilePreviewModalRef.current;
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
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
  const [isDraftExpanded, setIsDraftExpanded] = useState(false);
  const savedSelectionRangeRef = useRef<Range | null>(null);
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
  const [selectionBounds, setSelectionBounds] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
    lineRects: Array<{ top: number; left: number; width: number; height: number }>;
  } | null>(null);
  const writingToolAbortControllerRef = useRef<AbortController | null>(null);
  const writingToolLoadingRef = useRef(false);
  writingToolLoadingRef.current = writingToolLoading;
  const aiDraftRef = useRef<any>(null);
  aiDraftRef.current = aiDraft;
  const [showFloatingAiMenu, setShowFloatingAiMenu] = useState(false);
  const floatingAiPresence = useAnimatedPresence(showFloatingAiMenu, 180);
  const floatingAiContainerRef = useRef<HTMLDivElement>(null);

  // Auto-close Floating Writing Tools menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!showFloatingAiMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (floatingAiContainerRef.current && !floatingAiContainerRef.current.contains(e.target as Node)) {
        setShowFloatingAiMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFloatingAiMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFloatingAiMenu]);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(getStoredGeminiKey());
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [showApiKeyPassword, setShowApiKeyPassword] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<{
    success: boolean;
    message: string;
    model?: string;
  } | null>(null);
  const [apiKeyShake, setApiKeyShake] = useState(false);
  const [mathAnimatedRowIndex, setMathAnimatedRowIndex] = useState<number | null>(null);

  // Active text formatting states for toolbar highlighting
  const [activeFormats, setActiveFormats] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    headingLevel: 0 | 1 | 2 | 3; // 0 = normal text, 1 = h1, 2 = h2, 3 = h3
    bullet: boolean;
    number: boolean;
  }>({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    headingLevel: 0,
    bullet: false,
    number: false,
  });

  // Initial load
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // One-time self-healing data repair: restore notes corrupted by old regex noteType bug
  useEffect(() => {
    if (notes.length > 0) {
      notes.forEach((n) => {
        if (
          n.noteType === 'checklist' &&
          (!n.checklistContent || !n.checklistContent.trim()) &&
          n.content &&
          n.content !== '<p><br></p>'
        ) {
          updateNote(n.id, { noteType: 'note' });
        }
      });
    }
  }, [notes, updateNote]);

  const activeNote = useMemo(() => {
    if (editorMode === 'checklist') {
      const checklistNotes = notes.filter((n) => n.noteType === 'checklist');
      if (activeChecklistId) {
        const found = checklistNotes.find((n) => n.id === activeChecklistId);
        if (found) return found;
      }
      if (activeNoteId) {
        const found = checklistNotes.find((n) => n.id === activeNoteId);
        if (found) return found;
      }
      return checklistNotes[0] || null;
    } else {
      const textNotes = notes.filter((n) => n.noteType !== 'checklist');
      if (activeTextNoteId) {
        const found = textNotes.find((n) => n.id === activeTextNoteId);
        if (found) return found;
      }
      if (activeNoteId) {
        const found = textNotes.find((n) => n.id === activeNoteId);
        if (found) return found;
      }
      return textNotes[0] || null;
    }
  }, [notes, activeTextNoteId, activeChecklistId, activeNoteId, editorMode]);
  const isNoteLocked = Boolean(activeNote?.isLocked && !unlockedNoteIds.includes(activeNote?.id || ''));

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

  // ──────── Ultra-fast memoized character count (zero DOM reflow) ────────
  const localCharCount = useMemo(() => {
    if (!localContent) return 0;
    return localContent
      .replace(/data:[^"'\s)]+/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z0-9#]+;/gi, ' ')
      .trim().length;
  }, [localContent]);

  // ──────── Helper: Chèn HTML trực tiếp vào khung soạn thảo tại con trỏ ────────
  const insertHtmlIntoEditor = useCallback((html: string, options?: { skipSave?: boolean }) => {
    const targetEl = editorRef.current;
    if (!targetEl) return '';
    targetEl.focus();

    // Sanitize injected HTML to prevent XSS execution
    const safeHtml = sanitizeNoteHTML(html);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && targetEl.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);

      // Check if cursor or selection touches an attachment card or image wrapper
      const anchorNode = sel.anchorNode;
      const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
      const insideCard = anchorEl?.closest('.apple-file-attachment, .apple-img-wrapper');

      if (insideCard) {
        // Move selection right after the card to avoid corrupting or nesting inside it
        range.setStartAfter(insideCard);
        range.collapse(true);
      } else if (!range.collapsed) {
        // If selection spans attachments, collapse safely instead of deleting contents
        const frag = range.cloneContents();
        if (frag.querySelector('.apple-file-attachment, .apple-img-wrapper')) {
          range.collapse(false);
        } else {
          range.deleteContents();
        }
      }

      const el = document.createElement('div');
      el.innerHTML = safeHtml;
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
      targetEl.innerHTML = (targetEl.innerHTML || '') + safeHtml;
    }

    const updated = targetEl.innerHTML;
    setLocalContent(updated);
    localContentRef.current = updated;
    if (!options?.skipSave && activeNoteIdRef.current) {
      updateNote(activeNoteIdRef.current, { content: updated });
    }
    return updated;
  }, [isMinimized, updateNote]);

  // ──────── Image & Screenshot & File Handlers ────────
  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeNote) return;

    if (editorMode === 'checklist') {
      toast('Chế độ To-do chỉ quản lý việc cần làm, vui lòng chuyển sang Ghi chú để đính kèm hình ảnh.', { icon: 'ℹ️' });
      return;
    }

    toast.loading('Đang xử lý hình ảnh...', { id: 'note-img-process' });
    try {
      const newAttachments: NoteImageAttachment[] = [];
      let combinedHtml = '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const { dataUrl, size } = await compressImageFile(file);
        const att: NoteImageAttachment = {
          id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
          url: dataUrl,
          name: file.name || `Anh_${(activeNote.images?.length || 0) + newAttachments.length + 1}.jpg`,
          size,
          createdAt: new Date().toISOString(),
        };
        newAttachments.push(att);
        combinedHtml += generateInlineImageHtml(dataUrl, att.name || 'Hình ảnh');
      }

      if (newAttachments.length > 0) {
        const updatedHtml = insertHtmlIntoEditor(combinedHtml, { skipSave: true });
        const currentImages = activeNote.images || [];
        const nextImages = [...currentImages, ...newAttachments];

        await updateActiveNote({
          content: updatedHtml,
          images: nextImages,
        });

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

    if (editorMode === 'checklist') {
      toast('Chế độ To-do chỉ quản lý việc cần làm, vui lòng chuyển sang Ghi chú để đính kèm tệp tin.', { icon: 'ℹ️' });
      return;
    }

    toast.loading('Đang xử lý tệp tin...', { id: 'note-file-process' });
    try {
      const newAttachments: NoteImageAttachment[] = [];
      let combinedHtml = '';

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
          newAttachments.push(newAttachment);
          combinedHtml += generateInlineImageHtml(dataUrl, file.name);
        } else {
          // File tài liệu: lưu nhị phân trực tiếp vào IndexedDB (không nhúng base64 nặng vào HTML)
          const { id, sizeStr } = await attachmentService.saveAttachment(file, file.name);
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          combinedHtml += generateFileCardHtml(id, file.name, ext, sizeStr);
        }
      }

      if (combinedHtml) {
        const updatedHtml = insertHtmlIntoEditor(combinedHtml, { skipSave: true });
        const currentImages = activeNote.images || [];
        const nextImages = [...currentImages, ...newAttachments];

        await updateActiveNote({
          content: updatedHtml,
          images: nextImages,
        });

        playAppleChime();
        toast.success(`Đã đính kèm ${files.length} tệp tin vào văn bản ghi chú!`, { id: 'note-file-process' });
      } else {
        toast.dismiss('note-file-process');
      }
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
      const nextImages = [...currentImages, newAttachment];

      // Đẩy ảnh chụp màn hình trực tiếp vào khung soạn thảo văn bản
      const imgHtml = generateInlineImageHtml(croppedDataUrl, fileName);
      const updatedHtml = insertHtmlIntoEditor(imgHtml, { skipSave: true });

      // Note và To-do hoàn toàn tách biệt: không can thiệp checklistContent
      await updateActiveNote({
        content: updatedHtml,
        images: nextImages,
      });

      playAppleChime();
      toast.success('✂️ Đã chèn ảnh chụp màn hình vào văn bản ghi chú!', { id: 'note-crop-save' });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu ảnh chụp', { id: 'note-crop-save' });
    }
  };

  // ──────── Apple Intelligence Writing Tools (In-place Draft) ────────
  const handleCancelWritingTool = () => {
    if (writingToolAbortControllerRef.current) {
      writingToolAbortControllerRef.current.abort();
      writingToolAbortControllerRef.current = null;
    }
    setWritingToolLoading(false);
    toast.dismiss('ai-writing');
    toast('Đã dừng tác vụ AI.', { icon: '⏹️' });
  };

  const handleExecuteWritingTool = async (action: WritingToolAction) => {
    if (writingToolLoading) {
      toast('Đang có tác vụ AI đang xử lý. Vui lòng đợi hoặc bấm Hủy.', { icon: '⏳', id: 'writing-busy' });
      return;
    }
    setAiDraft(null);
    setAiDraftCopied(false);
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
        savedSelectionRangeRef.current = sel.getRangeAt(0).cloneRange();
        if (canvasRef.current) {
          const range = sel.getRangeAt(0);
          const selRect = range.getBoundingClientRect();
          const canvasRect = canvasRef.current.getBoundingClientRect();
          const lineRects = getStrictSelectionLineRects(range, canvasRect);
          let minLeft = selRect.left - canvasRect.left;
          let maxRight = selRect.right - canvasRect.left;
          let minTop = selRect.top - canvasRect.top;
          let maxBottom = selRect.bottom - canvasRect.top;

          if (lineRects.length > 0) {
            minLeft = Math.min(...lineRects.map((r) => r.left));
            maxRight = Math.max(...lineRects.map((r) => r.left + r.width));
            minTop = Math.min(...lineRects.map((r) => r.top));
            maxBottom = Math.max(...lineRects.map((r) => r.top + r.height));
          }

          setSelectionBounds({
            top: minTop,
            bottom: maxBottom,
            left: minLeft,
            right: maxRight,
            width: Math.max(20, maxRight - minLeft),
            height: Math.max(16, maxBottom - minTop),
            lineRects,
          });
        }
      }
    } else {
      savedSelectionRangeRef.current = null;
      setSelectionBounds(null);
    }
    if (!targetText.trim()) {
      toast.error('Ghi chú chưa có nội dung để AI xử lý!');
      return;
    }

    writingToolAbortControllerRef.current?.abort();
    const controller = new AbortController();
    writingToolAbortControllerRef.current = controller;

    setWritingToolLoading(true);
    toast.loading('AI Writing Tool đang tạo bản nháp...', { id: 'ai-writing' });
    try {
      const result = await runWritingTool(targetText, action, controller.signal);
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
      if (err.name === 'AbortError' || err.message?.includes('aborted') || controller.signal.aborted) {
        return;
      }
      toast.error(err.message || 'Không thể xử lý văn bản', { id: 'ai-writing' });
    } finally {
      if (writingToolAbortControllerRef.current === controller) {
        writingToolAbortControllerRef.current = null;
      }
      setWritingToolLoading(false);
    }
  };

  const handleApplyAiDraft = (mode: 'replace' | 'append') => {
    if (!aiDraft) return;

    if (editorMode === 'checklist') {
      if (mode === 'replace') {
        const newChecklist = normalizeChecklistDraft(aiDraft.result);
        setLocalChecklist(newChecklist);
        localChecklistRef.current = newChecklist;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, {
            content: '<p><br></p>',
            checklistContent: newChecklist,
            images: [],
          });
        }
      } else {
        const draftChecklist = normalizeChecklistDraft(aiDraft.result);
        const baseChecklist = localChecklist.trim() && localChecklist.trim() !== '- [ ] '
          ? localChecklist.trim()
          : '';
        const newChecklist = [baseChecklist, draftChecklist]
          .filter(Boolean)
          .join('\n');
        setLocalChecklist(newChecklist);
        localChecklistRef.current = newChecklist;
        if (activeNoteIdRef.current) {
          updateNote(activeNoteIdRef.current, {
            content: '<p><br></p>',
            checklistContent: newChecklist,
            images: [],
          });
        }
      }
    } else {
      const editor = editorRef.current;
      if (editor) {
        editor.focus();
        const savedRange = savedSelectionRangeRef.current;

        if (mode === 'replace') {
          if (aiDraft.isSelectionOnly && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
            let startBlock: Node | null = savedRange.startContainer;
            while (startBlock && startBlock.parentNode !== editor) {
              startBlock = startBlock.parentNode;
            }
            let endBlock: Node | null = savedRange.endContainer;
            while (endBlock && endBlock.parentNode !== editor) {
              endBlock = endBlock.parentNode;
            }

            const newBlocks = convertTextToNoteBlocks(aiDraft.result);
            const frag = document.createDocumentFragment();
            for (const b of newBlocks) {
              frag.appendChild(b);
            }

            if (startBlock && endBlock && startBlock.parentNode === editor && endBlock.parentNode === editor) {
              const blocksToRemove: Node[] = [];
              let curr: Node | null = startBlock;
              while (curr) {
                blocksToRemove.push(curr);
                if (curr === endBlock) break;
                curr = curr.nextSibling;
              }
              editor.insertBefore(frag, startBlock);
              for (const b of blocksToRemove) {
                b.parentNode?.removeChild(b);
              }
            } else {
              savedRange.deleteContents();
              savedRange.insertNode(frag);
            }
          } else {
            editor.innerHTML = ensureHtml(aiDraft.result);
          }
        } else {
          // 'append' mode (Chèn dưới):
          // Preserve multi-line paragraph structure exactly without collapsing lines
          const newBlocks = convertTextToNoteBlocks(aiDraft.result);
          const frag = document.createDocumentFragment();

          // Spacing separator before inserted content if editor already has text
          if (editor.textContent?.trim().length) {
            const sep = document.createElement('p');
            sep.appendChild(document.createElement('br'));
            frag.appendChild(sep);
          }
          for (const b of newBlocks) {
            frag.appendChild(b);
          }

          let targetBlock: HTMLElement | null = null;
          if (savedRange && editor.contains(savedRange.endContainer)) {
            let curr: Node | null = savedRange.endContainer;
            while (curr && curr.parentNode !== editor) {
              curr = curr.parentNode;
            }
            if (curr && curr.parentNode === editor) {
              targetBlock = curr as HTMLElement;
            }
          }

          if (targetBlock && targetBlock.parentNode === editor) {
            targetBlock.after(frag);
          } else {
            editor.appendChild(frag);
          }
        }

        const updated = editor.innerHTML;
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
    setIsDraftExpanded(false);
    setSelectionState(null);
    setSelectionBounds(null);
    savedSelectionRangeRef.current = null;
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
    setIsDraftExpanded(false);
    savedSelectionRangeRef.current = null;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionBounds(null);
    }
  };

  // Switch between Ghi chú (Notes) and To-do (Reminders) modules - 2 ngăn hoàn toàn độc lập
  const handleSwitchNoteMode = async (targetMode: 'note' | 'checklist') => {
    const isTargetChecklist = targetMode === 'checklist';
    const isCurrentChecklist = editorMode === 'checklist';
    if (isTargetChecklist === isCurrentChecklist) return;

    playPopSound();
    savePendingDraft(activeNoteIdRef.current);

    // Drop the previous editor's live DOM immediately; the next mode is hydrated
    // only from its own store fields by the active-note synchronization effect.
    if (editorRef.current) editorRef.current.replaceChildren();
    setLocalContent('');
    localContentRef.current = '';

    if (isTargetChecklist) {
      setEditorMode('checklist');
      setTypeFilter('checklist');
      setLocalChecklist('- [ ] ');
      localChecklistRef.current = '- [ ] ';

      const checklistNotes = notes.filter((n) => n.noteType === 'checklist');
      if (checklistNotes.length > 0) {
        const targetId = (activeChecklistId && checklistNotes.some((n) => n.id === activeChecklistId))
          ? activeChecklistId
          : checklistNotes[0].id;
        activeNoteIdRef.current = null; // Bắt buộc re-sync toàn bộ state ngăn to-do
        selectNote(targetId);
      } else {
        activeNoteIdRef.current = null;
        await createNote('checklist');
      }
      toast.success('Chế độ To-do việc cần làm', { id: 'note-mode-toggle', duration: 1200 });
    } else {
      setEditorMode('text');
      setTypeFilter('note');
      setLocalChecklist('- [ ] ');
      localChecklistRef.current = '- [ ] ';

      const textNotes = notes.filter((n) => n.noteType !== 'checklist');
      if (textNotes.length > 0) {
        const targetId = (activeTextNoteId && textNotes.some((n) => n.id === activeTextNoteId))
          ? activeTextNoteId
          : textNotes[0].id;
        activeNoteIdRef.current = null; // Bắt buộc re-sync toàn bộ state ngăn ghi chú
        selectNote(targetId);
      } else {
        activeNoteIdRef.current = null;
        await createNote('note');
      }
      toast.success('Chế độ Ghi chú văn bản', { id: 'note-mode-toggle', duration: 1200 });
    }
  };

  // Unlock active note with 6-digit PIN auto-verification
  const handleUnlockPasscodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setUnlockPasscode(clean);
    if (unlockError) setUnlockError('');

    if (clean.length === 6 && activeNote) {
      if (clean === activeNote.password) {
        // Pre-hydrate content synchronously before unlocking to prevent any blank renders
        const noteContent = activeNote.content || '';
        const html = ensureHtml(noteContent);
        setLocalContent(html);
        localContentRef.current = html;

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
      const noteContent = activeNote.content || '';
      const html = ensureHtml(noteContent);
      setLocalContent(html);
      localContentRef.current = html;

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
    setLockCurrentPassword('');
    setLockNewPassword('');
    setLockConfirmPassword('');
    setLockConfigMismatch(false);
    setShowReminderModal(false);
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

  /** Returns heading level (1–3) for the node at the current cursor position, 0 if not a heading */
  const detectHeadingLevel = (sel: Selection | null): 0 | 1 | 2 | 3 => {
    if (!sel) return 0;
    const anchor = sel.anchorNode;
    const el = anchor instanceof Element ? anchor : (anchor as Text | null)?.parentElement;
    if (el?.closest('h1')) return 1;
    if (el?.closest('h2')) return 2;
    if (el?.closest('h3')) return 3;
    return 0;
  };

  const handleEditorSelect = useCallback(() => {
    if (!editorRef.current || !canvasRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelectionState(null);
      setToolbarCoords(null);
      setShowFloatingAiMenu(false);
      if (!writingToolLoadingRef.current && !aiDraftRef.current) {
        setSelectionBounds(null);
      }
      return;
    }
    const anchor = sel.anchorNode;
    const focus = sel.focusNode;
    if (!editorRef.current.contains(anchor) && !editorRef.current.contains(focus)) {
      setSelectionState(null);
      setToolbarCoords(null);
      setShowFloatingAiMenu(false);
      if (!writingToolLoadingRef.current && !aiDraftRef.current) {
        setSelectionBounds(null);
      }
      return;
    }
    const text = sel.toString();
    if (!text.trim()) {
      setSelectionState(null);
      setToolbarCoords(null);
      setShowFloatingAiMenu(false);
      if (!writingToolLoadingRef.current && !aiDraftRef.current) {
        setSelectionBounds(null);
      }
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      const selRect = range.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();

      if (selRect.width > 0 || selRect.height > 0) {
        const lineRects = getStrictSelectionLineRects(range, canvasRect);

        let minLeft = selRect.left - canvasRect.left;
        let maxRight = selRect.right - canvasRect.left;
        let minTop = selRect.top - canvasRect.top;
        let maxBottom = selRect.bottom - canvasRect.top;

        if (lineRects.length > 0) {
          minLeft = Math.min(...lineRects.map((r) => r.left));
          maxRight = Math.max(...lineRects.map((r) => r.left + r.width));
          minTop = Math.min(...lineRects.map((r) => r.top));
          maxBottom = Math.max(...lineRects.map((r) => r.top + r.height));
        }

        setSelectionBounds({
          top: minTop,
          bottom: maxBottom,
          left: minLeft,
          right: maxRight,
          width: Math.max(20, maxRight - minLeft),
          height: Math.max(16, maxBottom - minTop),
          lineRects,
        });

        const firstRect = lineRects.length > 0 ? lineRects[0] : { top: minTop, left: minLeft, width: maxRight - minLeft, height: 20 };
        const lastRect = lineRects.length > 0 ? lineRects[lineRects.length - 1] : firstRect;

        const toolbarHeight = 38;
        const toolbarWidth = 330;
        const toolbarHalfWidth = toolbarWidth / 2;

        const lastCharX = lastRect.left + lastRect.width;
        const spaceOnRight = canvasRect.width - (lastCharX + 10);

        let top = lastRect.top;
        let centerX = lastCharX + 10 + toolbarHalfWidth;

        // Ưu tiên cao nhất: Đặt thanh công cụ ngay đằng sau ký tự cuối cùng của vùng chọn trên cùng dòng
        if (spaceOnRight >= toolbarWidth + 12) {
          centerX = lastCharX + 10 + toolbarHalfWidth;
          // Căn top từ lastRect.top trở xuống để TUYỆT ĐỐI không che dòng văn bản phía trên
          top = Math.max(4, Math.min(canvasRect.height - toolbarHeight - 8, lastRect.top));
        } else {
          // Nếu cuối dòng sát mép phải: đặt ngay bên dưới dòng cuối cùng của đoạn bôi đen
          const belowLastLine = lastRect.top + lastRect.height + 8;
          if (belowLastLine + toolbarHeight <= canvasRect.height - 8) {
            top = belowLastLine;
            centerX = Math.max(toolbarHalfWidth + 12, Math.min(canvasRect.width - toolbarHalfWidth - 12, lastCharX));
          } else {
            // Trường hợp sát đáy canvas: đặt phía trên vùng chọn
            top = Math.max(4, firstRect.top - toolbarHeight - 8);
            centerX = Math.max(toolbarHalfWidth + 12, Math.min(canvasRect.width - toolbarHalfWidth - 12, lastCharX));
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
          const headingLevel = detectHeadingLevel(sel);
          setActiveFormats({ bold, italic, underline, strike, headingLevel, bullet, number });
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
      const headingLevel = detectHeadingLevel(sel);
      setActiveFormats({ bold, italic, underline, strike, headingLevel, bullet, number });
    } catch (_) {}

    setSelectionState(null);
    setToolbarCoords(null);
    setShowFloatingAiMenu(false);
    if (!writingToolLoadingRef.current && !aiDraftRef.current) {
      setSelectionBounds(null);
    }
  }, []);

  // Listen to document selectionchange for real-time tracking
  useEffect(() => {
    document.addEventListener('selectionchange', handleEditorSelect);
    return () => {
      document.removeEventListener('selectionchange', handleEditorSelect);
    };
  }, [handleEditorSelect]);

  const handleApplyFormat = (
    format: 'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number' | 'h1' | 'h2' | 'h3'
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
      case 'h1': {
        const sel = window.getSelection();
        const anchor = sel?.anchorNode;
        const el = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (el?.closest('h1')) {
          document.execCommand('formatBlock', false, '<p>'); // toggle off
        } else {
          document.execCommand('formatBlock', false, '<h1>');
          const headingNode = (window.getSelection()?.anchorNode as Element)?.closest?.('h1') || (window.getSelection()?.anchorNode?.parentElement?.closest?.('h1'));
          headingNode?.querySelectorAll('b, strong').forEach((bNode) => {
            bNode.replaceWith(...Array.from(bNode.childNodes));
          });
        }
        break;
      }
      case 'h2': {
        const sel = window.getSelection();
        const anchor = sel?.anchorNode;
        const el = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (el?.closest('h2')) {
          document.execCommand('formatBlock', false, '<p>'); // toggle off
        } else {
          document.execCommand('formatBlock', false, '<h2>');
          const headingNode = (window.getSelection()?.anchorNode as Element)?.closest?.('h2') || (window.getSelection()?.anchorNode?.parentElement?.closest?.('h2'));
          headingNode?.querySelectorAll('b, strong').forEach((bNode) => {
            bNode.replaceWith(...Array.from(bNode.childNodes));
          });
        }
        break;
      }
      case 'h3': {
        const sel = window.getSelection();
        const anchor = sel?.anchorNode;
        const el = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (el?.closest('h3')) {
          document.execCommand('formatBlock', false, '<p>'); // toggle off
        } else {
          document.execCommand('formatBlock', false, '<h3>');
          const headingNode = (window.getSelection()?.anchorNode as Element)?.closest?.('h3') || (window.getSelection()?.anchorNode?.parentElement?.closest?.('h3'));
          headingNode?.querySelectorAll('b, strong').forEach((bNode) => {
            bNode.replaceWith(...Array.from(bNode.childNodes));
          });
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
      const headingLevel = detectHeadingLevel(window.getSelection());
      setActiveFormats({ bold, italic, underline, strike, headingLevel, bullet, number });
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
    if (writingToolLoading) {
      toast('Đang có tác vụ AI đang xử lý. Vui lòng đợi hoặc bấm Hủy.', { icon: '⏳', id: 'writing-busy' });
      return;
    }
    setAiDraft(null);
    setAiDraftCopied(false);
    if (!selectionState || !selectionState.text.trim()) return;
    const targetText = selectionState.text.trim();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode) && canvasRef.current) {
      const range = sel.getRangeAt(0);
      savedSelectionRangeRef.current = range.cloneRange();
      const selRect = range.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const lineRects = getStrictSelectionLineRects(range, canvasRect);
      let minLeft = selRect.left - canvasRect.left;
      let maxRight = selRect.right - canvasRect.left;
      let minTop = selRect.top - canvasRect.top;
      let maxBottom = selRect.bottom - canvasRect.top;

      if (lineRects.length > 0) {
        minLeft = Math.min(...lineRects.map((r) => r.left));
        maxRight = Math.max(...lineRects.map((r) => r.left + r.width));
        minTop = Math.min(...lineRects.map((r) => r.top));
        maxBottom = Math.max(...lineRects.map((r) => r.top + r.height));
      }

      setSelectionBounds({
        top: minTop,
        bottom: maxBottom,
        left: minLeft,
        right: maxRight,
        width: Math.max(20, maxRight - minLeft),
        height: Math.max(16, maxBottom - minTop),
        lineRects,
      });
    }

    writingToolAbortControllerRef.current?.abort();
    const controller = new AbortController();
    writingToolAbortControllerRef.current = controller;

    setWritingToolLoading(true);
    setShowFloatingAiMenu(false);
    toast.loading('AI Writing Tool đang tạo bản nháp...', { id: 'ai-writing' });
    try {
      const result = await runWritingTool(targetText, action, controller.signal);
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
      if (err.name === 'AbortError' || err.message?.includes('aborted') || controller.signal.aborted) {
        return;
      }
      toast.error(err.message || 'Không thể xử lý văn bản', { id: 'ai-writing' });
    } finally {
      if (writingToolAbortControllerRef.current === controller) {
        writingToolAbortControllerRef.current = null;
      }
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
        savedSelectionRangeRef.current = null;
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

    // 1. Xóa phần tử hình ảnh trong editor DOM bằng selector an toàn
    if (editorRef.current) {
      const imgs = Array.from(editorRef.current.querySelectorAll('img'));
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || '';
        const matches =
          (imageUrl &&
            (src === imageUrl ||
              src.includes(imageUrl.substring(0, 80)) ||
              imageUrl.includes(src.substring(0, 80)))) ||
          (imageId && (img.getAttribute('data-image-id') === imageId || img.id === imageId));
        if (matches) {
          const wrapper = img.closest('.apple-img-wrapper') || img;
          const parentP = wrapper.parentElement;
          wrapper.remove();
          if (parentP && parentP.tagName.toLowerCase() === 'p' && parentP.children.length === 0 && !parentP.textContent?.trim()) {
            parentP.remove();
          }
        }
      });
    }

    const baseContent = editorRef.current ? editorRef.current.innerHTML : (localContentRef.current || activeNote.content || '');
    const updatedHtml = imageUrl ? removeAttachmentFromHtml(baseContent, imageUrl) : baseContent;

    // 2. Lọc triệt để trong mảng activeNote.images
    const currentImages = activeNote.images || [];
    const updatedImages = currentImages.filter((img) => {
      if (imageId && (img.id === imageId || (img.id && imageId.includes(img.id)))) return false;
      if (imageUrl && (img.url === imageUrl || (img.url && (img.url.includes(imageUrl.substring(0, 80)) || imageUrl.includes(img.url.substring(0, 80)))))) return false;
      return true;
    });

    setLocalContent(updatedHtml);
    localContentRef.current = updatedHtml;
    if (editorRef.current && editorRef.current.innerHTML !== updatedHtml) {
      editorRef.current.innerHTML = updatedHtml;
    }

    await updateNote(activeNote.id, { images: updatedImages, content: updatedHtml });

    // Đóng ngay lightbox nếu ảnh này đang được mở
    setLightboxImage(null);
    setLightboxZoom(1);

    playPopSound();
    toast.success('Đã xóa hình ảnh khỏi ghi chú', { id: 'note-img-del' });
  };

  const handleDeleteFileFromPreview = async (fileUrl: string, fileName?: string, fileId?: string) => {
    if (fileId) {
      attachmentService.deleteAttachment(fileId).catch(console.error);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // 1. Xóa đúng phần tử tệp/ảnh trong editor DOM
    if (editorRef.current) {
      const elements = Array.from(editorRef.current.querySelectorAll('.apple-file-attachment, .apple-img-wrapper, img'));
      elements.forEach((el) => {
        const isFile = el.classList.contains('apple-file-attachment');
        if (isFile) {
          const fid = el.getAttribute('data-file-id');
          const u = el.getAttribute('data-file-url');
          const n = el.getAttribute('data-file-name');
          const a = el.querySelector('a');
          if (
            (fileId && fid === fileId) ||
            (fileUrl && (u === fileUrl || a?.getAttribute('href') === fileUrl)) ||
            (fileName && (n === fileName || a?.getAttribute('download') === fileName))
          ) {
            const parent = el.parentElement;
            el.remove();
            if (parent && parent.tagName.toLowerCase() === 'p' && parent.children.length === 0 && !parent.textContent?.trim()) {
              parent.remove();
            }
          }
        } else {
          const img = el.tagName.toLowerCase() === 'img' ? (el as HTMLImageElement) : el.querySelector('img');
          const src = img?.getAttribute('src') || '';
          const alt = img?.getAttribute('alt') || '';
          if ((fileUrl && src === fileUrl) || (fileName && alt === fileName)) {
            const targetContainer = el.closest('.apple-img-wrapper') || el;
            const parent = targetContainer.parentElement;
            targetContainer.remove();
            if (parent && parent.tagName.toLowerCase() === 'p' && parent.children.length === 0 && !parent.textContent?.trim()) {
              parent.remove();
            }
          }
        }
      });
    }

    // 2. Dọn dẹp an toàn qua DOMParser (tuyệt đối không dùng regex làm hỏng thẻ lân cận)
    const baseContent = editorRef.current ? editorRef.current.innerHTML : (localContentRef.current || activeNote?.content || '');
    const updatedHtml = removeAttachmentFromHtml(baseContent, fileUrl, fileName);

    // 3. Nếu là hình ảnh, gỡ bỏ khỏi activeNote.images
    const updatedImages = (activeNote?.images || []).filter(
      (img) => (fileUrl ? img.url !== fileUrl : true) && (fileName ? img.name !== fileName : true)
    );

    setLocalContent(updatedHtml);
    localContentRef.current = updatedHtml;
    if (editorRef.current && editorRef.current.innerHTML !== updatedHtml) {
      editorRef.current.innerHTML = updatedHtml;
    }

    if (activeNoteIdRef.current) {
      await updateNote(activeNoteIdRef.current, {
        content: updatedHtml,
        images: updatedImages,
      });
    }

    setFilePreviewModal(null);
    setIsPreviewFullscreen(false);
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

      if (editorMode === 'checklist') {
        if (imageFiles.length > 0) {
          e.preventDefault();
          toast('Chế độ To-do chỉ quản lý danh sách việc cần làm. Vui lòng chuyển sang Ghi chú để dán hình ảnh.', {
            icon: 'ℹ️',
            id: 'note-paste-checklist-hint',
          });
          return;
        }

        const text = e.clipboardData?.getData('text/plain');
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (text && activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          const cleanLines = text
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const cleaned = l.replace(/^(?:-\s*)?\[([ xX])\]\s*/, '').replace(/^[-*•]\s*/, '').trim();
              return cleaned ? `- [ ] ${cleaned}` : '';
            })
            .filter(Boolean);

          if (cleanLines.length > 0) {
            const currentLines = localChecklist.split('\n').filter((l) => l.trim() && l.trim() !== '- [ ]');
            const combined = [...currentLines, ...cleanLines].join('\n');
            setLocalChecklist(combined);
            localChecklistRef.current = combined;
            if (activeNoteIdRef.current) {
              updateNote(activeNoteIdRef.current, { checklistContent: combined });
            }
            toast.success(`Đã thêm ${cleanLines.length} đầu việc vào danh sách to-do!`, { id: 'note-paste-todo' });
          }
        }
        return;
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        toast.loading('Đang dán ảnh từ clipboard...', { id: 'note-img-paste' });
        try {
          const newAttachments: NoteImageAttachment[] = [];
          let combinedHtml = '';
          for (const f of imageFiles) {
            const { dataUrl, size } = await compressImageFile(f);
            newAttachments.push({
              id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
              url: dataUrl,
              name: f.name || `Anh_dan_${new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-')}.jpg`,
              size,
              createdAt: new Date().toISOString(),
            });
            combinedHtml += generateInlineImageHtml(dataUrl, f.name || 'Hình ảnh dán');
          }
          const updatedHtml = insertHtmlIntoEditor(combinedHtml, { skipSave: true });
          const currentImages = activeNote.images || [];
          const nextImages = [...currentImages, ...newAttachments];
          await updateActiveNote({
            content: updatedHtml,
            images: nextImages,
          });
          playAppleChime();
          toast.success(`Đã dán ${newAttachments.length} hình ảnh vào ghi chú!`, { id: 'note-img-paste' });
        } catch (err: any) {
          toast.error(err.message || 'Lỗi khi dán hình ảnh', { id: 'note-img-paste' });
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, isMinimized, activeNote, editorMode, updateActiveNote, insertHtmlIntoEditor, localChecklist, updateNote]);

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

    let isCancelled = false;
    let localBlobUrl: string | null = null;

    const loadPreview = async () => {
      try {
        let blob: Blob | null = null;
        if (filePreviewModal.fileId) {
          const res = await attachmentService.getAttachmentBlob(filePreviewModal.fileId);
          blob = res?.blob || null;
        }

        if (!blob) {
          if (filePreviewModal.url.startsWith('data:') || filePreviewModal.url.startsWith('blob:')) {
            blob = await dataUrlToBlob(filePreviewModal.url);
          } else if (filePreviewModal.url.startsWith('http')) {
            const res = await fetch(filePreviewModal.url);
            blob = await res.blob();
          }
        }

        if (isCancelled || !blob) {
          if (!isCancelled) setIsPreviewLoading(false);
          return;
        }

        // Tạo fresh blob URL cho session preview hiện tại
        localBlobUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(localBlobUrl);

        if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'log', 'xml', 'yaml', 'yml'].includes(ext)) {
          const text = await blob.text();
          if (!isCancelled) {
            setPreviewTextContent(text);
            setIsPreviewLoading(false);
          }
        } else if (['xlsx', 'xls'].includes(ext)) {
          const buf = await blob.arrayBuffer();
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' });
          const sheets: ExcelSheetPreview[] = workbook.SheetNames.map((name) => {
            const sheet = workbook.Sheets[name];
            const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
            let maxCols = 0;
            rawData.forEach((row) => {
              if (Array.isArray(row) && row.length > maxCols) maxCols = row.length;
            });
            return {
              name,
              rows: rawData.slice(0, 300),
              totalRows: rawData.length,
              totalCols: maxCols,
            };
          });
          if (!isCancelled) {
            setExcelPreview({ sheets, activeSheetIndex: 0 });
            setIsPreviewLoading(false);
          }
        } else if (['docx'].includes(ext)) {
          const res = await parseDocxFromDataUrl(localBlobUrl);
          if (!isCancelled) {
            setDocxPreview(res);
            setIsPreviewLoading(false);
          }
        } else if (['pptx'].includes(ext)) {
          const res = await parsePptxFromDataUrl(localBlobUrl);
          if (!isCancelled) {
            setPptxPreview(res);
            setIsPreviewLoading(false);
          }
        } else {
          if (!isCancelled) setIsPreviewLoading(false);
        }
      } catch (err) {
        console.error('Lỗi khi nạp bản xem trước tệp:', err);
        if (!isCancelled) setIsPreviewLoading(false);
      }
    };

    loadPreview();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFilePreviewModal(null);
        setIsPreviewFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      isCancelled = true;
      window.removeEventListener('keydown', handleEsc);
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [filePreviewModal]);

  // Active note images computed strictly from actual note content
  const noteImages: NoteImageAttachment[] = useMemo(() => {
    if (!activeNote) return [];

    const html = localContentRef.current || activeNote.content || '';
    if (!html) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgEls = Array.from(doc.querySelectorAll('img'));

    if (imgEls.length === 0) return [];

    const storedImages = activeNote.images || [];

    return imgEls
      .map((img, index) => {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || `Hình ảnh ${index + 1}`;
        const matched = storedImages.find(
          (si) => si.url && (si.url === src || src.includes(si.url.substring(0, 80)) || si.url.includes(src.substring(0, 80)))
        );
        return {
          id: matched?.id || `img_${index}_${src.slice(-12)}`,
          url: src,
          name: matched?.name || alt,
          size: matched?.size,
          createdAt: matched?.createdAt || activeNote.updatedAt,
        };
      })
      .filter((img) => Boolean(img.url));
  }, [activeNote?.content, activeNote?.images, localContent]);

  const currentImageIndex = lightboxImage
    ? noteImages.findIndex(
        (img) => (img.id && img.id === lightboxImage.id) || (img.url && img.url === lightboxImage.url)
      )
    : -1;

  const handleResetLightboxZoom = useCallback(() => {
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
    setIsLightboxPanning(false);
  }, []);

  const handleZoomInLightbox = useCallback(() => {
    setLightboxZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)));
  }, []);

  const handleZoomOutLightbox = useCallback(() => {
    setLightboxZoom((z) => {
      const nextZoom = Math.max(0.5, +(z - 0.25).toFixed(2));
      if (nextZoom <= 1) {
        setLightboxPan({ x: 0, y: 0 });
      }
      return nextZoom;
    });
  }, []);

  const handleToggleDoubleZoom = useCallback(() => {
    if (lightboxZoom > 1.05) {
      handleResetLightboxZoom();
    } else {
      setLightboxZoom(2);
    }
  }, [lightboxZoom, handleResetLightboxZoom]);

  const handlePrevImage = useCallback(() => {
    if (noteImages.length <= 1 || currentImageIndex === -1) return;
    const prevIdx = (currentImageIndex - 1 + noteImages.length) % noteImages.length;
    setLightboxImage(noteImages[prevIdx]);
    handleResetLightboxZoom();
  }, [noteImages, currentImageIndex, handleResetLightboxZoom]);

  const handleNextImage = useCallback(() => {
    if (noteImages.length <= 1 || currentImageIndex === -1) return;
    const nextIdx = (currentImageIndex + 1) % noteImages.length;
    setLightboxImage(noteImages[nextIdx]);
    handleResetLightboxZoom();
  }, [noteImages, currentImageIndex, handleResetLightboxZoom]);

  // Global mousemove and mouseup listeners for Lightbox Pan Dragging
  useEffect(() => {
    if (!isLightboxPanning) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!lightboxPanStartRef.current) return;
      const dx = e.clientX - lightboxPanStartRef.current.startX;
      const dy = e.clientY - lightboxPanStartRef.current.startY;
      setLightboxPan({
        x: lightboxPanStartRef.current.originX + dx,
        y: lightboxPanStartRef.current.originY + dy,
      });
    };
    const onMouseUp = () => {
      setIsLightboxPanning(false);
      lightboxPanStartRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isLightboxPanning]);

  // Keyboard controls for Lightbox (Escape, ArrowLeft, ArrowRight, Zoom)
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setLightboxImage(null);
        handleResetLightboxZoom();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomInLightbox();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOutLightbox();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetLightboxZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [lightboxImage, handlePrevImage, handleNextImage, handleZoomInLightbox, handleZoomOutLightbox, handleResetLightboxZoom]);

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
        if (!current) return;
        const newTitle = localTitleRef.current;

        if (current.noteType === 'checklist') {
          const newChecklist = localChecklistRef.current;
          if (current.title !== newTitle || (current as any).checklistContent !== newChecklist) {
            updateNote(noteId, {
              title: newTitle,
              checklistContent: newChecklist,
              content: '<p><br></p>',
              images: [],
            });
          }
        } else {
          const newContent = localContentRef.current;
          
          // Safety guard: Don't overwrite an existing note with empty content if editor was not even rendered or typed in
          if (
            current.content &&
            current.content.trim().length > 0 &&
            (!newContent || newContent === '<p><br></p>') &&
            !editorRef.current
          ) {
            return;
          }

          // Only trigger update if content or title actually changed
          if (current.title !== newTitle || current.content !== newContent) {
            updateNote(noteId, {
              title: newTitle,
              content: newContent,
              checklistContent: '',
            });
          }
        }
      }
    },
    [notes, updateNote]
  );

  const handleCreateNewNote = async (type: 'note' | 'checklist' = 'note') => {
    savePendingDraft(activeNoteIdRef.current);
    // Auto-sync filter & editorMode so new note is immediately visible and opened
    if (type === 'note') {
      setTypeFilter('note');
      setEditorMode('text');
    } else if (type === 'checklist') {
      setTypeFilter('checklist');
      setEditorMode('checklist');
    }
    await createNote(type);
  };

  const handleSetTypeFilter = (filter: 'all' | 'note' | 'checklist') => {
    setTypeFilter(filter);
    if (filter === 'all') return;

    // Check if active note matches the new filter; if not, switch to first matching note
    if (activeNote) {
      const isChecklist = activeNote.noteType === 'checklist';
      const isMatch = filter === 'note' ? !isChecklist : isChecklist;
      if (isMatch) return;
    }

    const matching = notes.find((n) => {
      const isChecklist = n.noteType === 'checklist';
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
    if (isMobileScreen) {
      setShowSidebar(false);
    }
  };

  const handleCloseNote = useCallback(() => {
    savePendingDraft(activeNoteIdRef.current);
    setIsWindowClosing(true);
    if (closeWindowTimerRef.current) clearTimeout(closeWindowTimerRef.current);
    closeWindowTimerRef.current = setTimeout(() => {
      setUnlockedNoteIds([]); // Relock tất cả ghi chú khi đóng cửa sổ
      activeNoteIdRef.current = null;
      setIsWindowClosing(false);
      closeNote();
    }, 140);
  }, [closeNote, savePendingDraft]);

  // Clean up closing timer on unmount
  useEffect(() => {
    return () => {
      if (closeWindowTimerRef.current) {
        clearTimeout(closeWindowTimerRef.current);
      }
    };
  }, []);

  // Handle Escape key to close note window smoothly if no inner popup is active
  useEffect(() => {
    if (!isOpen || isWindowClosing) return;

    const handleWindowEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // If any modal/popover/preview is currently open, let their own handlers dismiss them first
      if (
        lightboxImage ||
        filePreviewModal ||
        showApiKeySetting ||
        showReminderModal ||
        todoReminderTarget ||
        showLockConfigModal ||
        showWritingToolsMenu ||
        showCompactAiMenu ||
        showFloatingAiMenu ||
        showSmtpConfig
      ) {
        if (showFloatingAiMenu) setShowFloatingAiMenu(false);
        if (showCompactAiMenu) setShowCompactAiMenu(false);
        if (showWritingToolsMenu) setShowWritingToolsMenu(false);
        if (showApiKeySetting) setShowApiKeySetting(false);
        if (showReminderModal) setShowReminderModal(false);
        if (todoReminderTarget) setTodoReminderTarget(null);
        if (showLockConfigModal) setShowLockConfigModal(false);
        if (showSmtpConfig) setShowSmtpConfig(false);
        return;
      }

      e.preventDefault();
      handleCloseNote();
    };

    window.addEventListener('keydown', handleWindowEscape);
    return () => window.removeEventListener('keydown', handleWindowEscape);
  }, [
    isOpen,
    isWindowClosing,
    lightboxImage,
    filePreviewModal,
    showApiKeySetting,
    showReminderModal,
    todoReminderTarget,
    showLockConfigModal,
    showWritingToolsMenu,
    showCompactAiMenu,
    showFloatingAiMenu,
    showSmtpConfig,
    handleCloseNote,
  ]);

  // Mutual modal logic: prevent overlapping popovers
  const handleToggleApiKeySetting = () => {
    if (showApiKeySetting) {
      setShowApiKeySetting(false);
    } else {
      setShowReminderModal(false);
      setShowFloatingAiMenu(false);
      setShowLockConfigModal(false);
      setGeminiApiKeyInput(getStoredGeminiKey());
      setShowApiKeySetting(true);
    }
  };

  // Sync local draft when active note switches or editorMode switches
  useEffect(() => {
    if (activeNote) {
      const modeMismatch = (activeNote.noteType === 'checklist' && editorMode !== 'checklist') ||
                           (activeNote.noteType !== 'checklist' && editorMode === 'checklist');

      if (activeNoteIdRef.current !== activeNote.id || modeMismatch) {
        if (activeNoteIdRef.current && activeNoteIdRef.current !== activeNote.id) {
          savePendingDraft(activeNoteIdRef.current);
        }
        activeNoteIdRef.current = activeNote.id;
        const initialTitle = activeNote?.title || '';
        const initialContent = activeNote?.content || '';
        const initialChecklist = (activeNote as any).checklistContent || '';

        setLocalTitle(initialTitle);
        localTitleRef.current = initialTitle;

        const isChecklist = activeNote.noteType === 'checklist';

        if (isChecklist) {
          setEditorMode('checklist');
          // Ghi chú và To-do hoàn toàn tách biệt: checklist CHỈ lấy từ checklistContent
          // Tuyệt đối không nạp HTML/file attachments từ note content vào checklist
          const rawChecklist = (activeNote as any).checklistContent || '';
          const checklistData = cleanChecklistText(rawChecklist);
          setLocalChecklist(checklistData);
          localChecklistRef.current = checklistData;
          setLocalContent('');
          localContentRef.current = '';

          // Dọn dẹp triệt để nếu note checklist này từng bị dính content hoặc file từ các phiên bản trước
          if (
            (activeNote.images && activeNote.images.length > 0) ||
            (activeNote.content && activeNote.content !== '<p><br></p>')
          ) {
            updateNote(activeNote.id, {
              content: '<p><br></p>',
              images: [],
            });
          }
        } else {
          setEditorMode('text');
          const html = ensureHtml(initialContent);
          setLocalContent(html);
          localContentRef.current = html;
          setLocalChecklist('- [ ] ');
          localChecklistRef.current = '- [ ] ';
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
  }, [activeNote, editorMode, savePendingDraft]);

  // Ensure editorRef.current has the content when mounted, switching to text mode, active note changes, OR when unlocked!
  useLayoutEffect(() => {
    if (isOpen && editorMode === 'text' && !isNoteLocked && editorRef.current) {
      const source = localContentRef.current || activeNote?.content || '';
      const html = ensureHtml(source);
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
      }
    }
  }, [isOpen, editorMode, activeNote?.id, isNoteLocked, activeNote?.content]);

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
        const isChecklist = n.noteType === 'checklist';

        // 2 Ngăn độc lập: Ngăn Ghi chú chỉ hiển thị note văn bản, Ngăn To-do chỉ hiển thị việc cần làm
        if (editorMode === 'checklist' && !isChecklist) return false;
        if (editorMode === 'text' && isChecklist) return false;

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

  const countNotes = notes.filter((n) => n.noteType !== 'checklist').length;
  const countChecklists = notes.filter((n) => n.noteType === 'checklist').length;

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

    // Safety guard: If target.innerHTML is suddenly empty, but localContentRef had existing content (>20 chars),
    // and this is not an intentional user deletion, do NOT wipe!
    if ((!html || html === '<p><br></p>' || html === '<br>') && localContentRef.current && localContentRef.current.length > 20) {
      const nativeEvent = e.nativeEvent as InputEvent;
      const isDeleting = nativeEvent?.inputType?.startsWith('delete');
      if (!isDeleting) {
        target.innerHTML = localContentRef.current;
        return;
      }
    }

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
          const resultHtml = `&nbsp;<span class="apple-math-result-text">${mathRes.resultStr}</span>&nbsp;`;
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

    // ── Markdown auto-format shortcuts triggered on Space ──────────────────────
    // Guards: skip during IME composition, skip delete events
    const isInsertingSpace =
      nativeEvent?.data === ' ' &&
      nativeEvent?.inputType === 'insertText' &&
      !nativeEvent?.isComposing;
    if (isInsertingSpace && !isDeleting) {
      const sel = window.getSelection();
      if (sel && sel.focusNode && editorRef.current?.contains(sel.focusNode)) {
        const node = sel.focusNode;
        const offset = sel.focusOffset;
        const fullText = node.textContent || '';
        // Text before the space that was just inserted (space is already in DOM at offset-1)
        const beforeSpace = fullText.substring(0, offset - 1);
        // Only trigger when this text is at the very START of the block (no other content before it)
        const trimmedBefore = beforeSpace.trimStart();

        /**
         * applyBlockShortcut:
         *  - deleteCount: number of trigger chars to remove (not counting the space itself)
         *  - execFn: the formatting command to run
         */
        const applyBlockShortcut = (deleteCount: number, execFn: () => void) => {
          try {
            const range = sel.getRangeAt(0);
            // Select from start of trigger to current position (including the space)
            const startOffset = offset - 1 - deleteCount;
            if (startOffset < 0) return;
            range.setStart(node, startOffset);
            range.setEnd(node, offset);
            range.deleteContents();
            execFn();
            const updated = editorRef.current?.innerHTML || '';
            setLocalContent(updated);
            localContentRef.current = updated;
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              if (activeNoteIdRef.current) updateNote(activeNoteIdRef.current, { content: updated });
            }, 300);
          } catch (_) {}
        };

        // "- " → unordered list
        if (trimmedBefore === '-') {
          applyBlockShortcut(1, () => document.execCommand('insertUnorderedList', false));
          return;
        }
        // "* " → unordered list
        if (trimmedBefore === '*') {
          applyBlockShortcut(1, () => document.execCommand('insertUnorderedList', false));
          return;
        }
        // "1. " or "1) " → ordered list
        if (trimmedBefore === '1.' || trimmedBefore === '1)') {
          applyBlockShortcut(trimmedBefore.length, () => document.execCommand('insertOrderedList', false));
          return;
        }
        // "### " → H3 (must check before ## and #)
        if (trimmedBefore === '###') {
          applyBlockShortcut(3, () => {
            document.execCommand('formatBlock', false, '<h3>');
            const h = window.getSelection()?.anchorNode;
            const hEl = h instanceof Element ? h : h?.parentElement;
            hEl?.closest('h3')?.querySelectorAll('b, strong').forEach((b) => b.replaceWith(...Array.from(b.childNodes)));
          });
          return;
        }
        // "## " → H2
        if (trimmedBefore === '##') {
          applyBlockShortcut(2, () => {
            document.execCommand('formatBlock', false, '<h2>');
            const h = window.getSelection()?.anchorNode;
            const hEl = h instanceof Element ? h : h?.parentElement;
            hEl?.closest('h2')?.querySelectorAll('b, strong').forEach((b) => b.replaceWith(...Array.from(b.childNodes)));
          });
          return;
        }
        // "# " → H1
        if (trimmedBefore === '#') {
          applyBlockShortcut(1, () => {
            document.execCommand('formatBlock', false, '<h1>');
            const h = window.getSelection()?.anchorNode;
            const hEl = h instanceof Element ? h : h?.parentElement;
            hEl?.closest('h1')?.querySelectorAll('b, strong').forEach((b) => b.replaceWith(...Array.from(b.childNodes)));
          });
          return;
        }
      }
    }
    // ── End Markdown shortcuts ──────────────────────────────────────────────────
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (text && !e.clipboardData.types.includes('Files')) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
    }
  };

  /**
   * Word-like keyboard handling for rich text note editor:
   * - Enter in empty list item: unlists item to normal paragraph (like Word)
   * - Shift+Enter: soft line break (<br>) within list item or paragraph
   * - Tab / Shift+Tab: indent / outdent list item or insert 4-space tab without losing focus
   * - Backspace at start of list item: unlists item back to regular text
   * - Ctrl+B, Ctrl+I, Ctrl+U: standard bold/italic/underline
   * - Zero interference with Vietnamese IME (EVKey/Unikey/typing composition)
   */
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. Never intercept Vietnamese IME composition (EVKey, Unikey, etc.)
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    // 2. Tab & Shift+Tab handling (Word-like indentation)
    if (e.key === 'Tab') {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const liNode = (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : range.commonAncestorContainer.parentElement)?.closest('li');

      if (liNode) {
        // Inside a list: Tab indents, Shift+Tab outdents
        if (e.shiftKey) {
          document.execCommand('outdent', false);
        } else {
          document.execCommand('indent', false);
        }
      } else {
        // Outside a list: insert 4 spaces or tab indentation without blurring the editor
        if (e.shiftKey) {
          document.execCommand('outdent', false);
        } else {
          document.execCommand('insertText', false, '    ');
        }
      }

      if (editorRef.current) {
        handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
      }
      return;
    }

    // 3. Enter key handling — Word-like behavior
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const liNode = (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement)?.closest('li');

        if (liNode) {
          // 3a. Shift+Enter inside a list → soft line break (<br>) within same bullet
          if (e.shiftKey) {
            e.preventDefault();
            document.execCommand('insertLineBreak', false);
            if (editorRef.current) {
              handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
            }
            return;
          }

          // 3b. Enter on EMPTY list item → exit list (become normal paragraph)
          const textContent = liNode.textContent || '';
          const isEmpty = textContent.trim().length === 0 && !liNode.querySelector('img, .apple-file-attachment');
          if (isEmpty) {
            e.preventDefault();
            document.execCommand('outdent', false);
            if (editorRef.current) {
              handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
            }
            return;
          }

          // 3c. Enter on NON-EMPTY list item → let browser handle it naturally.
          // The browser contentEditable already creates the next <li> (with bullet or incremented number).
          // We only need to sync state after the browser finishes.
          // Do NOT preventDefault here — allow the default browser behavior.
          // Sync after a microtask so the DOM is updated.
          requestAnimationFrame(() => {
            if (editorRef.current) {
              handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
            }
          });
          return;
        }
      }
    }

    // 4. Backspace at start of list item (Word-like bullet removal)
    if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const liNode = (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement)?.closest('li');

        if (liNode) {
          const preRange = range.cloneRange();
          preRange.selectNodeContents(liNode);
          preRange.setEnd(range.startContainer, range.startOffset);
          if (preRange.toString().length === 0 && !preRange.cloneContents().querySelector('img, .apple-file-attachment')) {
            e.preventDefault();
            document.execCommand('outdent', false);
            if (editorRef.current) {
              handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
            }
            return;
          }
        }
      }
    }

    // 5. Standard Shortcuts: Ctrl+B, Ctrl+I, Ctrl+U
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        document.execCommand('bold', false);
        if (editorRef.current) {
          handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
        }
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        document.execCommand('italic', false);
        if (editorRef.current) {
          handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
        }
        return;
      }
      if (k === 'u') {
        e.preventDefault();
        document.execCommand('underline', false);
        if (editorRef.current) {
          handleEditorInput({ currentTarget: editorRef.current, nativeEvent: e.nativeEvent } as any);
        }
        return;
      }
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
        const fileId = badge.getAttribute('data-file-id');
        if (fileId) {
          attachmentService.deleteAttachment(fileId).catch(console.error);
        }
        const fileName = badge.getAttribute('data-file-name') || 'tệp đính kèm';
        const parentP = badge.parentElement;
        badge.remove();
        if (parentP && parentP.tagName.toLowerCase() === 'p' && parentP.children.length === 0 && !parentP.textContent?.trim()) {
          parentP.remove();
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

    // 1b. Nhấp vào nút Tải xuống tệp đính kèm
    const fileDownloadBtn = target.closest('.apple-file-download-btn');
    if (fileDownloadBtn) {
      const badge = fileDownloadBtn.closest('.apple-file-attachment') as HTMLElement | null;
      if (badge) {
        const fileId = badge.getAttribute('data-file-id');
        const fileName = badge.getAttribute('data-file-name') || 'tep_tin';
        if (fileId) {
          e.preventDefault();
          e.stopPropagation();
          attachmentService.downloadAttachment(fileId, fileName);
          return;
        }
      }
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
        const parentP = wrapper.parentElement;
        wrapper.remove();
        if (parentP && parentP.tagName.toLowerCase() === 'p' && parentP.children.length === 0 && !parentP.textContent?.trim()) {
          parentP.remove();
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
        handleResetLightboxZoom();
        playPopSound();
      }
      return;
    }

    // 4. Nhấp vào nút Xem trước (Preview) hoặc click vào thẻ tệp đính kèm
    const previewBtn = target.closest('.apple-file-preview-btn');
    const badge = target.closest('.apple-file-attachment') as HTMLElement | null;
    if (previewBtn || (badge && !target.closest('.apple-file-delete-btn') && !target.closest('.apple-file-download-btn') && !target.closest('a'))) {
      const targetBadge = badge || (previewBtn?.closest('.apple-file-attachment') as HTMLElement | null);
      if (targetBadge) {
        e.preventDefault();
        e.stopPropagation();
        const fileId = targetBadge.getAttribute('data-file-id');
        const url = targetBadge.getAttribute('data-file-url') || targetBadge.querySelector('a')?.getAttribute('href') || '';
        const name = targetBadge.getAttribute('data-file-name') || targetBadge.querySelector('a')?.getAttribute('download') || 'Tệp đính kèm';
        const ext = targetBadge.getAttribute('data-file-ext') || name.split('.').pop()?.toLowerCase() || '';
        const size = targetBadge.getAttribute('data-file-size') || '';

        if (fileId) {
          attachmentService.getAttachment(fileId).then((att) => {
            if (att) {
              setFilePreviewModal({ fileId, url: att.url, name, ext, size: att.sizeStr || size });
              playPopSound();
            } else {
              toast.error('Không tìm thấy tệp đính kèm trong bộ nhớ');
            }
          });
          return;
        }

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
        handleResetLightboxZoom();
        playPopSound();
      }
      return;
    }
  };

  // ──────── Parse Checklist Rows & match taskReminders ────────
  const checklistRows: ChecklistRow[] = useMemo(() => {
    const raw = localChecklist || '';
    const lines = raw.split('\n');
    const rows: ChecklistRow[] = [];
    const taskReminders = activeNote?.taskReminders || [];

    lines.forEach((line, idx) => {
      const match = line.match(/^(?:-\s*)?\[([ xX])\][ \t]?(.*)$/);
      if (match) {
        const taskText = match[2];
        const trimmed = taskText.trim();
        // Match primarily by trimmed task text, or by task id
        const reminder = taskReminders.find(
          (tr) => (tr.taskText.trim() === trimmed || tr.id === `task-${idx}`) && !tr.reminderCompleted
        );
        const taskId = reminder ? reminder.id : `task-${idx}`;

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

    const match = targetLine.match(/^(?:-\s*)?\[([ xX])\][ \t]?(.*)$/);
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

    const match = targetLine.match(/^(?:-\s*)?\[([ xX])\][ \t]?(.*)$/);
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
      const match = targetLine.match(/^(?:-\s*)?\[([ xX])\][ \t]?(.*)$/);
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
    const title = localTitle.trim() || activeNote?.title || 'Ghi chú';
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
  };

  // ──────── Main Note Reminder Handlers ────────
  const handleOpenReminderModal = () => {
    setShowApiKeySetting(false);
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

  const handleValidateAndSaveApiKey = async () => {
    const keyToSave = geminiApiKeyInput.trim();
    if (!keyToSave) {
      setApiKeyShake(true);
      setTimeout(() => setApiKeyShake(false), 500);
      toast.error('Vui lòng nhập Gemini API Key');
      return;
    }

    setIsTestingApiKey(true);
    setApiKeyTestResult(null);
    toast.loading('Đang xác thực kết nối với Google Gemini...', { id: 'test-gemini-key' });
    try {
      const res = await testGeminiApiKey(keyToSave);
      toast.dismiss('test-gemini-key');
      if (res.success) {
        setStoredGeminiKey(keyToSave);
        setApiKeyTestResult(res);
        playAppleChime();
        toast.success(`🎉 Đã xác thực & lưu Gemini API Key thành công (${res.model})!`);
        setShowApiKeySetting(false);
      } else {
        setApiKeyTestResult({
          success: false,
          message: res.message,
        });
        setApiKeyShake(true);
        setTimeout(() => setApiKeyShake(false), 500);
        toast.error(`Xác thực thất bại: ${res.message}`);
      }
    } catch (err: any) {
      toast.dismiss('test-gemini-key');
      setApiKeyTestResult({
        success: false,
        message: err.message || 'Không thể kết nối tới Google Gemini',
      });
      setApiKeyShake(true);
      setTimeout(() => setApiKeyShake(false), 500);
      toast.error('Lỗi khi kiểm tra kết nối API key');
    } finally {
      setIsTestingApiKey(false);
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
  if (!isOpen && !isWindowClosing) return null;

  const currentColorConfig = COLOR_MAP[activeNote?.color || 'amber'];
  const currentW = isCompactWindow
    ? compactSize.width
    : windowSize.width;
  const currentH = isCompactWindow
    ? compactSize.height
    : Math.max(windowSize.height, 580);

  const rightPx = isCompactWindow && compactPos
    ? Math.max(0, window.innerWidth - compactPos.x - currentW)
    : 0;
  const bottomPx = isCompactWindow && compactPos
    ? Math.max(0, window.innerHeight - compactPos.y - currentH)
    : 0;

  return createPortal(
    <>
      {/* Mobile Dimmed Backdrop Overlay */}
      {isMobileScreen && (
        <div
          className={cn(
            "fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] will-change-[opacity] [transform:translateZ(0)]",
            isWindowClosing ? "liquid-backdrop-exit" : "liquid-backdrop-enter"
          )}
          onClick={handleCloseNote}
          aria-hidden="true"
        />
      )}
      {/* ─────────────────── Apple Liquid Glass Floating Window (Single Unified Window) ─────────────────── */}
      <div
        ref={windowRef}
        role="region"
        aria-label="Cửa sổ ghi chú nhanh"
        style={
          isMobileScreen
            ? {
                left: 0,
                right: 0,
                bottom: 0,
                top: 'max(0.5rem, env(safe-area-inset-top, 0px))',
                width: '100vw',
                height: 'calc(100% - max(0.5rem, env(safe-area-inset-top, 0px)))',
              }
            : {
                right: `${rightPx}px`,
                bottom: `${bottomPx}px`,
                width: `${currentW}px`,
                height: `${currentH}px`,
              }
        }
        className={cn(
          "fixed z-[9999] bg-white/95 dark:bg-[#181822]/95 backdrop-blur-3xl border border-white/80 dark:border-white/15 flex flex-col overflow-hidden font-sans select-none will-change-[transform,opacity] [transform:translateZ(0)]",
          isMobileScreen
            ? "rounded-t-[28px] rounded-b-none border-b-0 max-w-none max-h-none shadow-[0_-12px_40px_rgba(0,0,0,0.22)] pb-[env(safe-area-inset-bottom,0px)]"
            : cn(
                "max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]",
                isCompactWindow ? "rounded-[26px]" : "rounded-tl-[26px] rounded-tr-none rounded-br-none rounded-bl-none",
                (isDraggingCompact || isResizing)
                  ? "shadow-[0_32px_85px_rgba(0,0,0,0.3)] transition-none select-none pointer-events-auto"
                  : "shadow-[0_20px_60px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] transition-[right,bottom,width,height,border-radius,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              ),
          isWindowClosing
            ? (isMobileScreen ? "apple-bottom-sheet-exit pointer-events-none" : "liquid-droplet-exit pointer-events-none")
            : (isMobileScreen ? "apple-bottom-sheet-enter" : "liquid-droplet-enter")
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

          if (editorMode === 'checklist') {
            toast('Chế độ To-do chỉ quản lý danh sách việc cần làm. Vui lòng chuyển sang Ghi chú để đính kèm tệp tin.', {
              icon: 'ℹ️',
              id: 'note-drop-checklist-hint',
            });
            return;
          }

          const files = Array.from(e.dataTransfer.files);
          if (files.length === 0) return;

          toast.loading('Đang xử lý tệp kéo thả...', { id: 'note-drop-process' });
          try {
            const newAttachments: NoteImageAttachment[] = [];
            let combinedHtml = '';

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                const { dataUrl, size } = await compressImageFile(file);
                const newAttachment: NoteImageAttachment = {
                  id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
                  url: dataUrl,
                  name: file.name || `Anh_${(activeNote.images?.length || 0) + newAttachments.length + 1}.jpg`,
                  size,
                  createdAt: new Date().toISOString(),
                };
                newAttachments.push(newAttachment);
                combinedHtml += generateInlineImageHtml(dataUrl, newAttachment.name || 'Hình ảnh');
              } else {
                const { id, sizeStr } = await attachmentService.saveAttachment(file, file.name);
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                combinedHtml += generateFileCardHtml(id, file.name, ext, sizeStr);
              }
            }

            if (combinedHtml) {
              const updatedHtml = insertHtmlIntoEditor(combinedHtml, { skipSave: true });
              const currentImages = activeNote.images || [];
              const nextImages = [...currentImages, ...newAttachments];
              await updateActiveNote({
                content: updatedHtml,
                images: nextImages,
              });
              playAppleChime();
              toast.success(`Đã thêm ${files.length} tệp trực tiếp vào ghi chú!`, { id: 'note-drop-process' });
            }
          } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xử lý tệp', { id: 'note-drop-process' });
          }
        }}
      >
        {/* Mobile Sheet Drag Indicator Handle */}
        {isMobileScreen && (
          <div className="w-full flex items-center justify-center pt-2.5 pb-1 shrink-0 bg-transparent">
            <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20" />
          </div>
        )}

        {/* Invisible Resize Hitboxes (All 4 Edges: n, s, w, e & All 4 Corners: nw, ne, sw, se) - Desktop only */}
        {!isMobileScreen && (
          <>
            {/* 4 Edges */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'n')}
              className="absolute top-0 inset-x-6 h-2.5 cursor-ns-resize z-50 select-none bg-transparent touch-none"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, 's')}
              className="absolute bottom-0 inset-x-6 h-2.5 cursor-ns-resize z-50 select-none bg-transparent touch-none"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, 'w')}
              className="absolute left-0 inset-y-6 w-2.5 cursor-ew-resize z-50 select-none bg-transparent touch-none"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, 'e')}
              className="absolute right-0 inset-y-6 w-2.5 cursor-ew-resize z-50 select-none bg-transparent touch-none"
            />

            {/* 4 Corners */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
              className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize z-50 select-none bg-transparent rounded-tl-[28px] touch-none"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
              className="absolute top-0 right-0 w-6 h-6 cursor-nesw-resize z-50 select-none bg-transparent rounded-tr-[28px] touch-none"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
              className="absolute bottom-0 left-0 w-6 h-6 cursor-nesw-resize z-50 select-none bg-transparent rounded-bl-[28px] touch-none"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, 'se')}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 select-none bg-transparent rounded-br-[28px] touch-none"
            />
          </>
        )}

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
        {!isCompactWindow && (
          <>
            {/* Backdrop click outside to close sidebar — Trong suốt, không làm tối màn hình bất chợt */}
            <div
              onClick={() => setShowSidebar(false)}
              className={cn(
                "absolute inset-0 z-20 bg-transparent transition-opacity duration-200",
                showSidebar ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              )}
            />
            <div
              aria-hidden={!showSidebar}
              className={cn(
                "absolute top-0 left-0 bottom-0 w-full max-w-[285px] z-30 border-r border-black/[0.08] dark:border-white/10 flex flex-col bg-white/95 dark:bg-[#181820]/95 backdrop-blur-3xl shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
                showSidebar ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
              )}
            >
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

                  {/* Nút tạo sổ ghi chú mới trên sidebar chuẩn Apple Design */}
                  <button
                    type="button"
                    onClick={() => handleCreateNewNote(editorMode === 'checklist' ? 'checklist' : 'note')}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#0071e3] dark:text-[#2997ff] bg-[#0071e3]/10 hover:bg-[#0071e3]/20 dark:bg-[#0071e3]/15 dark:hover:bg-[#0071e3]/25 transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                    title="Tạo sổ ghi chú mới"
                    aria-label="Tạo ghi chú mới"
                  >
                    <SFSquareAndPencil size={14} />
                  </button>

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
                const isChecklistNote = note.noteType === 'checklist';
                const isLockedAndHidden = note.isLocked && !unlockedNoteIds.includes(note.id);
                const hasNoteReminder = Boolean(note.reminderAt && !note.reminderCompleted);
                const hasTaskReminder = Boolean((note.taskReminders || []).some((tr) => !tr.reminderCompleted));

                // Quick parse checklist stats for snippet & progress bar
                let checklistSnippet = '';
                let checklistTotalCount = 0;
                let checklistDoneCount = 0;
                let checklistPercentVal = 0;
                if (isChecklistNote) {
                  const plain = (note.checklistContent || note.content || '').replace(/<[^>]+>/g, '\n');
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
                            {unlockedNoteIds.includes(note.id) ? <SFLockOpen size={13} /> : <SFLock size={13} />}
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
                              <SFLock size={11} className="text-[#0071e3] dark:text-[#2997ff] shrink-0" />
                            </span>
                          )}
                          <h5 className={`text-[12.5px] font-semibold truncate leading-snug ${
                            isSelected ? 'text-[#1d1d1f] dark:text-white' : 'text-[#1d1d1f]/90 dark:text-[#f5f5f7]/85'
                          }`}>
                            {note?.title || (isChecklistNote ? 'Danh sách việc mới' : 'Ghi chú mới')}
                          </h5>
                        </div>

                        {/* Snippet / Progress */}
                        {isLockedAndHidden ? (
                          <p className="text-[11px] text-[#86868b] dark:text-[#76767b] italic flex items-center gap-1">
                            <SFLock size={10} /> Đã khóa
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] text-[#86868b] dark:text-[#76767b] font-mono shrink-0">
                              {new Date(note.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </span>
                            {note.isLocked && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded-full font-medium bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] shrink-0">
                                {isLockedAndHidden ? 'Đã khóa' : 'Bảo vệ'}
                              </span>
                            )}
                            {(hasNoteReminder || hasTaskReminder) && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 font-medium shrink-0" title="Có cài lịch nhắc nhở">
                                <SFClock size={10} className="shrink-0" />
                                <span>Nhắc</span>
                              </span>
                            )}
                          </div>
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          {/* Apple Window Title Bar */}
          <div
            onMouseDown={handleCompactHeaderMouseDown}
            className={cn(
              "h-12 px-3 sm:px-4 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-white/50 dark:bg-white/[0.02] select-none",
              isCompactWindow ? (isDraggingCompact ? "cursor-apple-grabbing" : "cursor-apple-grab") : "cursor-default"
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
                const isChecklistActive = editorMode === 'checklist';
                return (
                  <div
                    className={cn(
                      "relative p-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] backdrop-blur-2xl border border-black/[0.06] dark:border-white/12 shadow-2xs ml-1 shrink-0 select-none",
                      isCompactWindow ? "w-[62px]" : "w-[176px]"
                    )}
                  >
                    {/* Inner 2-column flex grid for 100% symmetric tabs */}
                    <div className="relative grid grid-cols-2 w-full h-7 items-center overflow-hidden rounded-full">
                      {/* Fluid Sliding Pill Indicator: Chiều rộng chính xác 50% của capsule, dịch chuyển 100% đối xứng hoàn hảo */}
                      <div
                        className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#0071e3] shadow-[0_2px_8px_rgba(0,113,227,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none will-change-transform"
                        style={{
                          transform: `translate3d(${isChecklistActive ? '100%' : '0%'}, 0, 0)`,
                        }}
                      />

                      {/* Nút 1: Ghi chú */}
                      <button
                        type="button"
                        onClick={() => handleSwitchNoteMode('note')}
                        className={`relative z-10 w-full h-full flex items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap px-1.5 ${
                          !isChecklistActive
                            ? 'text-white font-bold'
                            : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white'
                        }`}
                        title="Chế độ Ghi chú văn bản"
                      >
                        <SFSquareAndPencil
                          size={13}
                          className={`shrink-0 transition-transform duration-200 ${!isChecklistActive ? 'text-white scale-105' : 'text-[#76767b] dark:text-[#a1a1a6]'}`}
                        />
                        {!isCompactWindow && <span className="leading-none text-center">Ghi chú</span>}
                      </button>

                      {/* Nút 2: To-do */}
                      <button
                        type="button"
                        onClick={() => handleSwitchNoteMode('checklist')}
                        className={`relative z-10 w-full h-full flex items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap px-1.5 ${
                          isChecklistActive
                            ? 'text-white font-bold'
                            : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white'
                        }`}
                        title="Chế độ To-do việc cần làm"
                      >
                        <SFCheckmarkSquare
                          size={13}
                          className={`shrink-0 transition-transform duration-200 ${isChecklistActive ? 'text-white scale-105' : 'text-[#76767b] dark:text-[#a1a1a6]'}`}
                        />
                        {!isCompactWindow && <span className="leading-none text-center">To-do</span>}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Dedicated + Button to create a new note */}
              <button
                type="button"
                onClick={() => handleCreateNewNote(editorMode === 'checklist' ? 'checklist' : 'note')}
                className="w-7 h-7 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#0071e3]/15 hover:text-[#0071e3] dark:hover:text-[#2997ff] text-[#76767b] flex items-center justify-center transition-all cursor-pointer active:scale-90 ml-0.5 shadow-2xs"
                title="Tạo ghi chú / to-do mới (+)"
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
                        <SFLockOpen size={14} />
                      ) : (
                        <SFLock size={14} />
                      )
                    ) : (
                      <SFLock size={14} />
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
                      <SFGearshape size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* 2. Apple Window Mode Toggle: Phóng to / Thu nhỏ nằm kế bên nút đóng (Chỉ trên Desktop) */}
              <button
                type="button"
                onClick={handleToggleCompactMode}
                className="hidden sm:flex w-7 h-7 rounded-full items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
                title={isCompactWindow ? 'Phóng to thành tab chính cố định (Góc dưới phải)' : 'Thu nhỏ thành cửa sổ nhỏ linh động di chuyển'}
                aria-label={isCompactWindow ? 'Phóng to tab chính' : 'Thu nhỏ cửa sổ'}
              >
                {isCompactWindow ? <SFArrowUpLeftAndArrowDownRight size={13.5} /> : <SFArrowDownRightAndArrowUpLeft size={13.5} />}
              </button>

              {/* 3. Close window — nút đóng ngoài cùng bên phải */}
              <CloseButton
                onClick={handleCloseNote}
                size="sm"
                title="Đóng (Esc)"
              />
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
                className="flex-1 flex flex-col items-center justify-center p-6 text-center font-sans bg-transparent select-none cursor-text liquid-backdrop-enter will-change-[opacity]"
              >
                <div className={cn(
                  "w-full max-w-[340px] p-6 rounded-[26px] bg-white/90 dark:bg-[#1c1c24]/90 border border-black/10 dark:border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.12)] flex flex-col items-center relative apple-modal-enter will-change-[transform,opacity]",
                  unlockShake && "apple-shake"
                )}>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#0071e3]/20 to-[#0071e3]/5 border border-[#0071e3]/25 flex items-center justify-center text-[#0071e3] dark:text-[#2997ff] shadow-md shadow-[#0071e3]/20 mb-3">
                    <SFLock size={26} />
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
              "flex-1 flex flex-col min-h-0 overflow-hidden apple-note-canvas font-sans bg-transparent dark:bg-[#16161e]",
              isCompactWindow ? "pt-3.5 pb-2.5 px-4" : "p-5 sm:p-6"
            )}>
              {/* Title input - Apple macOS 27 Title 1 Typography */}
              <div className="mb-1 shrink-0">
                <input
                  type="text"
                  value={localTitle}
                  onChange={handleTitleChange}
                  placeholder={editorMode === 'checklist' ? 'Tiêu đề danh sách to-do...' : 'Tiêu đề ghi chú...'}
                  style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                  className="w-full macos-title-1 font-bold text-[#1d1d1f] dark:text-[#f5f5f7] bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-none placeholder:text-[#86868b]/40 tracking-tight p-0 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200"
                />
              </div>

              {/* Note Metadata Row: Timestamp, Auto-save status, Per-Note Reminder Button, Color Tags — ẨN trong compact mode */}
              {!isCompactWindow && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-[#86868b] dark:text-[#76767b] pb-2.5 pt-1 border-b border-black/[0.04] dark:border-white/[0.06] mb-3 shrink-0">
                <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                  {editorMode === 'checklist' ? (
                    <span className="font-medium text-[#86868b] dark:text-[#a1a1a6] truncate">
                      {checklistCompleted}/{checklistTotal} việc hoàn thành ({checklistPercent}%)
                    </span>
                  ) : (
                    <span className="font-medium text-[#86868b] dark:text-[#a1a1a6] truncate">
                      {new Date(activeNote.updatedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {localCharCount} ký tự
                    </span>
                  )}
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

              {/* In-place Quick Formatting & Tools Strip — ẨN trong compact mode HOẶC khi đang ở chế độ To-do */}
              {!isCompactWindow && editorMode !== 'checklist' && (
              <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-black/[0.06] dark:border-white/10 shrink-0 select-none relative">
                {/* Collapsible Rich-Text Formatting Controls with Liquid Spring Physics */}
                <div
                  className="flex items-center gap-0.5 shrink-0 overflow-x-auto scrollbar-none py-0.5 max-w-[400px] opacity-100 translate-x-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                >
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
                    onClick={() => handleApplyFormat('h1')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center font-black text-[10px] transition-all cursor-pointer ${
                      activeFormats.headingLevel === 1
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Tiêu đề lớn H1 (phím tắt: # + Space)"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('h2')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center font-black text-[10px] transition-all cursor-pointer ${
                      activeFormats.headingLevel === 2
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Tiêu đề mục H2 (phím tắt: ## + Space)"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFormat('h3')}
                    className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center font-black text-[10px] transition-all cursor-pointer ${
                      activeFormats.headingLevel === 3
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/6 dark:hover:bg-white/10'
                    }`}
                    title="Tiêu đề phụ H3 (phím tắt: ### + Space)"
                  >
                    H3
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
                    <SFListBullet size={13.5} />
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
                    <SFListNumber size={13.5} />
                  </button>
                </div>

                {/* Tools Dropdown trigger with outside click listener ref (Writing tools) */}
                <div ref={compactAiMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (writingToolLoading) {
                        toast('Đang có tác vụ AI đang xử lý. Vui lòng đợi hoặc bấm Hủy.', { icon: '⏳', id: 'writing-busy' });
                        return;
                      }
                      setShowCompactAiMenu(!showCompactAiMenu);
                    }}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs ${
                      showCompactAiMenu
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : 'bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/10'
                    }`}
                    title="Công cụ AI soạn thảo & xử lý văn bản"
                  >
                    <SFWandAndSparkles size={11.5} className="text-[#0071e3] dark:text-[#2997ff]" />
                    <span>Writing Tools</span>
                    <SFChevronDown size={10} className={`transition-transform duration-150 ${showCompactAiMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {compactAiPresence.shouldRender && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-3xl border border-black/10 dark:border-white/15 shadow-[0_24px_60px_-8px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.15)] p-1.5 z-50 space-y-0.5 text-left max-h-[380px] overflow-y-auto select-none ${
                        compactAiPresence.isExiting
                          ? 'apple-popover-close-tr'
                          : 'apple-popover-tr'
                      }`}
                    >
                      <div className="px-2.5 py-1 text-[10.5px] font-bold text-[#86868b] dark:text-[#a1a1a6] border-b border-black/[0.06] dark:border-white/10 mb-1 flex items-center justify-between">
                        <span>Writing Tools</span>
                        <span className="text-[9.5px] bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] px-1.5 py-0.5 rounded-full font-semibold">Intelligence</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('summarize');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#0071e3]/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-amber-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-purple-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-emerald-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-rose-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-indigo-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-sky-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-blue-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <SFGlobe size={12} />
                        </div>
                        <span className="truncate">Dịch sang tiếng Anh</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCompactAiMenu(false);
                          handleExecuteWritingTool('translate_vi');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-teal-500/10 dark:hover:bg-white/10 hover:translate-x-1 active:scale-[0.98] transition-all duration-160 cursor-pointer"
                      >
                        <div className="w-5.5 h-5.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <SFGlobe size={12} />
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
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-0 py-0.5">
                  {/* Apple Inset Grouped Container */}
                  <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.015] dark:bg-white/[0.025] shadow-xs overflow-hidden flex flex-col">
                    {/* Integrated Sleek Progress Header */}
                    {checklistTotal > 0 && (
                      <div className="px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11.5px]">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                            <span>Tiến độ:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {checklistCompleted}/{checklistTotal}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-normal">
                              ({checklistPercent}%)
                            </span>
                          </div>
                          <div>
                            {checklistCompleted < checklistTotal ? (
                              <button
                                type="button"
                                onClick={() => handleToggleAllChecklist(true)}
                                className="text-[11.5px] font-medium text-[#0071e3] dark:text-[#2997ff] hover:underline cursor-pointer transition-colors"
                              >
                                Xong tất cả
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleAllChecklist(false)}
                                className="text-[11.5px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer transition-colors"
                              >
                                Bỏ chọn
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Fluid Mini Progress Track */}
                        <div className="w-full h-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300 ease-out rounded-full"
                            style={{ width: `${checklistPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Interactive Checklist Rows with Hairline Dividers */}
                    <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                      {checklistRows.map((row) => (
                        <div
                          key={`row-${row.lineIndex}`}
                          className={`group flex items-center gap-3 px-3.5 py-2 transition-colors duration-150 relative ${
                            mathAnimatedRowIndex === row.lineIndex
                              ? 'animate-math-flash bg-[#0071e3]/10'
                              : row.completed
                              ? 'bg-black/[0.01] dark:bg-white/[0.01]'
                              : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.035]'
                          }`}
                        >
                          {/* Apple Circular Checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleChecklistRow(row.lineIndex)}
                            className={`w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
                              row.completed
                                ? 'bg-emerald-500 text-white shadow-2xs scale-100'
                                : 'border-[1.5px] border-black/30 dark:border-white/35 hover:border-[#0071e3] dark:hover:border-[#2997ff]'
                            }`}
                            title={row.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu đã hoàn thành'}
                          >
                            {row.completed && <SFCheckmark size={11} className="stroke-[3]" />}
                          </button>

                          {/* Inline Editable Task Text Input */}
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
                            className={`checklist-item-input flex-1 bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 text-[13.5px] leading-snug py-0.5 ${
                              row.completed
                                ? 'line-through text-[#86868b] dark:text-[#76767b]'
                                : 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                            }`}
                          />

                          {/* Apple Reminders Action Group: Refined Date Badge/Button + Clean Soft Delete Button */}
                          <div className="flex items-center gap-1 shrink-0 ml-auto select-none opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                            {row.reminderAt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTodoReminderTarget({
                                    lineIndex: row.lineIndex,
                                    taskId: row.taskId,
                                    taskText: row.text,
                                    reminderAt: toDatetimeLocal(new Date(row.reminderAt!)),
                                  });
                                }}
                                className="!opacity-100 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight text-[#0071e3] dark:text-[#2997ff] bg-[#0071e3]/10 dark:bg-[#2997ff]/15 hover:bg-[#0071e3]/18 dark:hover:bg-[#2997ff]/25 active:scale-95 transition-all cursor-pointer border border-[#0071e3]/20 dark:border-[#2997ff]/25 shadow-2xs"
                                title="Nhấp để đổi giờ hoặc hủy nhắc cho việc này"
                              >
                                <SFClock size={13} className="text-[#0071e3] dark:text-[#2997ff] shrink-0" />
                                <span className="leading-none">{formatReminderBadge(row.reminderAt)}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setTodoReminderTarget({
                                    lineIndex: row.lineIndex,
                                    taskId: row.taskId,
                                    taskText: row.text,
                                    reminderAt: toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)),
                                  });
                                }}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868b] dark:text-[#a1a1a6] hover:text-[#0071e3] dark:hover:text-[#2997ff] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-90 transition-all cursor-pointer"
                                title="Hẹn giờ nhắc cho công việc này"
                                aria-label="Hẹn giờ nhắc"
                              >
                                <SFClock size={16} />
                              </button>
                            )}

                            {/* Delete row button (Apple Reminders Subtle Round Button) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklistRow(row.lineIndex)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868b] dark:text-[#a1a1a6] hover:text-[#ff3b30] dark:hover:text-[#ff453a] hover:bg-rose-500/10 active:scale-90 transition-all cursor-pointer"
                              title="Xóa công việc này"
                              aria-label="Xóa công việc"
                            >
                              <SFXmark size={12.5} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add New Item Row inside grouped list */}
                      <button
                        type="button"
                        onClick={() => handleInsertChecklistRowAfter()}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[#86868b] dark:text-[#76767b] hover:text-[#0071e3] dark:hover:text-[#2997ff] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
                      >
                        <SFPlus size={14} className="text-[#0071e3] dark:text-[#2997ff] shrink-0" />
                        <span>Thêm mục mới...</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Seamless Flowing Writing Canvas */
                <div ref={canvasRef} className="flex-1 flex flex-col min-h-0 relative">
                  {/* Apple AI Creative Text Transformation Effect - Ethereal Rearrange & Defocus Shimmer */}
                  {writingToolLoading && selectionBounds?.lineRects && selectionBounds.lineRects.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden">
                      {selectionBounds.lineRects.map((rect, idx) => (
                        <div
                          key={`morph-line-${idx}-${rect.top.toFixed(0)}-${rect.left.toFixed(0)}`}
                          className="absolute overflow-hidden apple-ai-text-morphing-pill"
                          style={{
                            top: `${Math.max(0, rect.top - 1)}px`,
                            left: `${Math.max(0, rect.left - 2)}px`,
                            width: `${Math.max(6, rect.width + 4)}px`,
                            height: `${Math.max(18, rect.height + 2)}px`,
                            animationDelay: `${idx * 0.12}s`,
                          }}
                        >
                          {/* Inner undulating glyph rearrangement aura */}
                          <div
                            className="absolute inset-0 apple-ai-character-rearrange-aura"
                            style={{
                              animationDelay: `${idx * 0.16}s`,
                            }}
                          />
                        </div>
                      ))}
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

                  {/* Main ContentEditable Editor */}
                  <div
                    ref={(el) => {
                      (editorRef as any).current = el;
                      if (el) {
                        const source = localContentRef.current || activeNote?.content || '';
                        const html = ensureHtml(source);
                        if (el.innerHTML !== html) {
                          el.innerHTML = html;
                        }
                      }
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    onKeyDown={handleEditorKeyDown}
                    onInput={handleEditorInput}
                    onSelect={handleEditorSelect}
                    onMouseDown={handleEditorMouseDown}
                    onMouseUp={handleEditorSelect}
                    onKeyUp={handleEditorSelect}
                    onScroll={handleEditorSelect}
                    onPaste={handleEditorPaste}
                    onClick={handleEditorClick}
                    className="flex-1 w-full bg-transparent border-0 outline-none shadow-none ring-0 focus:ring-0 focus:outline-none focus:border-none font-sans text-[14.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] p-0 pr-1 selection:bg-purple-500/25 selection:text-[#1d1d1f] dark:selection:text-white overflow-y-auto min-h-0 [&_h1]:text-2xl [&_h1]:font-bold [&_h1_*]:font-bold [&_h1]:text-[#1d1d1f] dark:[&_h1]:text-white [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:leading-tight [&_h2]:text-xl [&_h2]:font-bold [&_h2_*]:font-bold [&_h2]:text-[#1d1d1f] dark:[&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3_*]:font-semibold [&_h3]:text-[#1d1d1f] dark:[&_h3]:text-white [&_h3]:mt-2 [&_h3]:mb-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_img]:!max-w-[320px] [&_img]:!max-h-[220px] [&_img]:!w-auto [&_img]:!h-auto [&_img]:object-contain [&_img]:rounded-xl [&_img]:cursor-zoom-in [&_.apple-img-wrapper]:my-2 [&_.apple-img-wrapper_img]:!m-0 [&_.apple-img-wrapper_img]:!p-0 [&_.apple-img-wrapper_img]:!border-0 [&_.apple-img-wrapper_img]:!shadow-none [&_.apple-img-wrapper_img]:!block [&_.apple-file-attachment]:transition-all hover:[&_.apple-file-attachment]:bg-black/[0.07] dark:hover:[&_.apple-file-attachment]:bg-white/[0.08] cursor-text scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/30"
                    style={{
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                      paddingBottom: '24px',
                    }}
                  />

                  {/* Floating AI Progress & Cancel Pill - Anchored strictly at end of highlighted text */}
                  {writingToolLoading && (() => {
                    const canvasW = canvasRef.current?.clientWidth || 500;
                    const canvasH = canvasRef.current?.clientHeight || 400;
                    const pillWidth = 165;
                    const pillHeight = 28;

                    let pillTop = 10;
                    let pillLeft = Math.max(12, canvasW - pillWidth - 12);

                    if (selectionBounds?.lineRects && selectionBounds.lineRects.length > 0) {
                      const lastLine = selectionBounds.lineRects[selectionBounds.lineRects.length - 1];
                      const endX = lastLine.left + lastLine.width;
                      const lineTop = lastLine.top;
                      const lineH = lastLine.height;

                      // Check if there is enough room on the same line after the last character
                      const spaceOnSameLine = canvasW - (endX + 8);
                      if (spaceOnSameLine >= pillWidth + 8) {
                        // Sit immediately after the last character on the same line
                        pillLeft = endX + 8;
                        pillTop = Math.max(4, lineTop + (lineH - pillHeight) / 2);
                      } else {
                        // If end of line is too close to edge, place right below the end of text
                        pillLeft = Math.max(8, Math.min(canvasW - pillWidth - 12, endX - pillWidth + 30));
                        pillTop = Math.min(canvasH - pillHeight - 8, lineTop + lineH + 6);
                      }
                    } else if (selectionBounds) {
                      pillLeft = Math.max(8, Math.min(canvasW - pillWidth - 12, selectionBounds.right + 8));
                      pillTop = Math.max(4, selectionBounds.bottom + 6);
                    }

                    return (
                      <div
                        className="absolute z-50 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl border border-purple-500/35 dark:border-purple-400/45 shadow-[0_8px_24px_rgba(0,0,0,0.14),0_2px_8px_rgba(168,85,247,0.2)] select-none animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                        style={{
                          top: `${pillTop}px`,
                          left: `${pillLeft}px`,
                        }}
                      >
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#a855f7] border-t-transparent animate-spin shrink-0" />
                        <span className="text-[11.5px] font-semibold bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent select-none whitespace-nowrap">
                          Đang xử lý...
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelWritingTool}
                          className="ml-1 px-2 py-0.5 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white dark:text-rose-400 dark:hover:text-white text-[10.5px] font-semibold transition-all duration-150 cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs"
                          title="Dừng xử lý ngay lập tức"
                        >
                          <SFXmark size={10} />
                          <span>Hủy</span>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Classic Apple Liquid Glass Clean Draft Card (Spacious, Fully Readable & Expandable) */}
                  {aiDraft && (() => {
                    const canvasW = canvasRef.current?.clientWidth || 500;
                    const canvasH = canvasRef.current?.clientHeight || 420;
                    // Mở rộng bề ngang card để đọc văn bản thoải mái, không bị bóp nghẽn dòng
                    const cardWidth = Math.min(560, Math.max(340, canvasW - 24));
                    // Chiều cao mục tiêu tối ưu theo không gian thực tế của canvas
                    const targetCardHeight = Math.min(270, Math.max(185, canvasH - 28));

                    let top = 8;
                    if (selectionBounds) {
                      const spaceBelow = canvasH - selectionBounds.bottom;
                      // Ưu tiên 1: Đặt ngay bên dưới vùng chọn để người dùng đối chiếu trực tiếp văn bản gốc và bản dịch
                      if (spaceBelow >= targetCardHeight + 10) {
                        top = selectionBounds.bottom + 8;
                      } else if (selectionBounds.top >= targetCardHeight + 10) {
                        // Nếu bên dưới không đủ chỗ: Đặt ngay phía trên vùng chọn
                        top = selectionBounds.top - targetCardHeight - 8;
                      } else {
                        // Vùng chọn phủ dài: Ghim an toàn trong canvas để nút chức năng luôn hiển thị 100%
                        top = Math.max(6, canvasH - targetCardHeight - 8);
                      }
                    } else {
                      top = Math.max(6, canvasH - targetCardHeight - 8);
                    }

                    // Khóa an toàn 2 đầu tuyệt đối: Không bao giờ vượt quá đỉnh và không bao giờ tràn đáy
                    top = Math.max(6, Math.min(canvasH - targetCardHeight - 8, top));
                    const calculatedMaxHeight = Math.min(targetCardHeight, Math.max(160, canvasH - top - 8));
                    const contentMaxHeight = Math.max(95, calculatedMaxHeight - 88);

                    return (
                      <div
                        className="absolute z-50 p-3 rounded-2xl bg-white/95 dark:bg-[#1e1e26]/95 backdrop-blur-2xl border border-purple-500/25 dark:border-purple-400/35 shadow-[0_20px_50px_rgba(0,0,0,0.22),0_4px_24px_rgba(168,85,247,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] select-none flex flex-col gap-2 will-change-[top,width,height]"
                        style={{
                          top: isDraftExpanded ? '8px' : `${top}px`,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: `${isDraftExpanded ? Math.max(340, canvasW - 16) : cardWidth}px`,
                          height: `${isDraftExpanded ? Math.max(200, canvasH - 16) : calculatedMaxHeight}px`,
                          transition: 'top 280ms cubic-bezier(0.16, 1, 0.3, 1), width 280ms cubic-bezier(0.16, 1, 0.3, 1), height 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {/* Header (shrink-0) */}
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-black/[0.06] dark:border-white/10 shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-[#6366f1] via-[#a855f7] to-[#ec4899] text-white flex items-center justify-center shadow-xs shrink-0">
                              <SFWandAndSparkles size={11} className="text-white" />
                            </div>
                            <span className="text-[12.5px] font-bold tracking-tight text-[#1d1d1f] dark:text-white truncate">
                              {aiDraft.title || 'Bản nháp Writing Tools'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsDraftExpanded((prev) => !prev)}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-90"
                              title={isDraftExpanded ? "Thu nhỏ về dạng hộp nổi" : "Phóng to toàn khung để kiểm tra văn bản dễ nhất"}
                              aria-label={isDraftExpanded ? "Thu nhỏ" : "Phóng to"}
                            >
                              {isDraftExpanded ? (
                                <SFArrowDownRightAndArrowUpLeft size={11.5} />
                              ) : (
                                <SFArrowUpLeftAndArrowDownRight size={11.5} />
                              )}
                            </button>
                            <CloseButton
                              onClick={handleDiscardAiDraft}
                              size="sm"
                              label="Đóng"
                              title="Hủy bản nháp"
                            />
                          </div>
                        </div>

                        {/* Content Preview inside clean inset glass box (flex-1 overflow-y-auto min-h-0) */}
                        <div
                          className="text-[13.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] select-text overflow-y-auto scrollbar-thin pr-1.5 whitespace-pre-wrap font-normal bg-black/[0.025] dark:bg-white/[0.04] p-3 rounded-xl border border-black/[0.04] dark:border-white/[0.06] flex-1 min-h-0"
                        >
                          {aiDraft.result}
                        </div>

                        {/* Action buttons bar (ALWAYS shrink-0 so it is NEVER cut off) */}
                        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.06] shrink-0">
                          <button
                            type="button"
                            onClick={handleCopyAiDraft}
                            className="px-2.5 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] text-[11px] font-medium transition-all cursor-pointer border border-black/5 dark:border-white/10 active:scale-95 flex items-center gap-1 shadow-2xs"
                            title="Sao chép kết quả"
                          >
                            <SFDocumentOnDocument size={11.5} />
                            <span>{aiDraftCopied ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAiDraft('append')}
                            className="px-3 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] text-[11px] font-medium transition-all cursor-pointer border border-black/5 dark:border-white/10 active:scale-95 flex items-center gap-1 shadow-2xs"
                            title="Chèn nguyên vẹn từng đoạn xuống dưới phần chọn"
                          >
                            <SFPlus size={11} />
                            <span>Chèn dưới</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAiDraft('replace')}
                            className="px-3.5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Thay thế đoạn văn bản đã chọn"
                          >
                            <SFCheckmark size={11.5} className="stroke-[3]" />
                            <span>Thay thế</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ──────────────── Apple Liquid Glass Floating Selection Toolbar (Follows Highlighted Text) ──────────────── */}
                  {selectionState && toolbarCoords && !writingToolLoading && !aiDraft && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        top: `${toolbarCoords.top}px`,
                        left: `${toolbarCoords.left}px`,
                        transform: 'translateX(-50%)',
                      }}
                      className="absolute z-30 flex items-center gap-1 p-1 rounded-full bg-white/90 dark:bg-[#1c1c24]/90 backdrop-blur-3xl border border-white/80 dark:border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.95)] select-none apple-floating-toolbar-enter"
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
                          <SFUnderline size={13} />
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
                          <SFStrikethrough size={13} />
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
                          <SFListBullet size={14} />
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
                          <SFListNumber size={14} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('h1')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer font-black text-[10px] ${
                            activeFormats.headingLevel === 1
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Tiêu đề lớn H1 (# + Space)"
                          aria-label="Tiêu đề H1"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('h2')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer font-black text-[10px] ${
                            activeFormats.headingLevel === 2
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Tiêu đề mục H2 (## + Space)"
                          aria-label="Tiêu đề H2"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleApplyFormat('h3')}
                          className={`w-7 h-7 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer font-black text-[10px] ${
                            activeFormats.headingLevel === 3
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          title="Tiêu đề phụ H3 (### + Space)"
                          aria-label="Tiêu đề H3"
                        >
                          H3
                        </button>
                      </div>

                      {/* Apple Writing Tools Button & Contextual Popover */}
                      <div ref={floatingAiContainerRef} className="relative pl-0.5">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (writingToolLoading) {
                              toast('Đang có tác vụ AI đang xử lý. Vui lòng đợi hoặc bấm Hủy.', { icon: '⏳', id: 'writing-busy' });
                              return;
                            }
                            setShowFloatingAiMenu((prev) => !prev);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 relative overflow-hidden group ${
                            showFloatingAiMenu
                              ? 'bg-[#0071e3] text-white shadow-xs scale-105'
                              : 'bg-black/[0.05] dark:bg-white/[0.1] hover:bg-black/10 dark:hover:bg-white/15 text-[#1d1d1f] dark:text-white border border-black/[0.08] dark:border-white/[0.12] shadow-2xs hover:scale-105'
                          }`}
                          title={showFloatingAiMenu ? 'Đóng Writing Tools' : 'Công cụ soạn thảo AI'}
                          aria-label="Công cụ soạn thảo AI"
                        >
                          <SFWandAndSparkles size={13.5} />
                        </button>

                        {/* Apple Writing Tools Contextual Menu — Tự động tính chiều cao để không bao giờ bị cắt xén ngoài đỉnh/đáy */}
                        {floatingAiPresence.shouldRender && (
                          <div
                            onMouseDown={(e) => {
                              if (!(e.target as HTMLElement).closest('button, input')) {
                                e.preventDefault();
                              }
                            }}
                            style={{
                              maxHeight: toolbarCoords.maxMenuHeight ? `${toolbarCoords.maxMenuHeight}px` : '220px',
                            }}
                            className={`absolute right-0 w-60 rounded-[20px] bg-white/95 dark:bg-[#1e1e24]/95 backdrop-blur-3xl border border-black/10 dark:border-white/15 shadow-[0_24px_60px_-8px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.15)] p-1.5 z-50 space-y-0.5 text-left overflow-y-auto scrollbar-thin select-none ${
                              toolbarCoords.openMenuUp
                                ? (floatingAiPresence.isExiting ? 'bottom-full mb-2 apple-popover-close-br' : 'bottom-full mb-2 apple-popover-br')
                                : (floatingAiPresence.isExiting ? 'top-full mt-2 apple-popover-close-tr' : 'top-full mt-2 apple-popover-tr')
                            }`}
                          >
                            <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 mb-1">
                              <div className="flex items-center gap-1.5 text-[#0071e3] dark:text-[#2997ff]">
                                <SFWandAndSparkles size={12.5} />
                                <span className="text-[11.5px] font-bold text-[#1d1d1f] dark:text-white">
                                  Writing Tools
                                </span>
                              </div>
                              <span className="text-[9.5px] bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] px-1.5 py-0.5 rounded-full font-semibold">
                                Intelligence
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
                                <SFGlobe size={12.5} />
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
                                <SFGlobe size={12.5} />
                              </div>
                              <span className="truncate">Dịch sang tiếng Việt</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Quick Tools Bar - Apple Liquid Glass Dock — ẨN trong compact mode */}
              {!isCompactWindow && (
              <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                {/* Left: Content Insertion & Quick Tools (Tách biệt hoàn toàn: Chỉ hiển thị trong chế độ Ghi chú văn bản) */}
                {editorMode === 'checklist' ? (
                  <div className="flex items-center gap-2 text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium select-none pl-1">
                    <SFCheckmarkSquare size={14} className="text-[#0071e3] dark:text-[#2997ff]" />
                    <span>To-do • Danh sách việc cần làm</span>
                  </div>
                ) : (
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
                      <SFScissors size={15.5} />
                    </button>

                    {/* 3. Nút Đính kèm tệp tin đa dạng (Sáng button khi hover, không đổi viền) */}
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.12] dark:hover:bg-white/[0.18] hover:brightness-110 text-emerald-600 dark:text-emerald-400 border border-black/[0.05] dark:border-white/[0.08] transition-all cursor-pointer active:scale-90 shadow-2xs hover:shadow-xs"
                      title="Đính kèm tệp tin đa dạng (PDF, Word, Excel, ZIP, Text... vào văn bản)"
                      aria-label="Đính kèm tệp tin"
                    >
                      <SFPaperclip size={15.5} />
                    </button>
                  </div>
                )}

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
                {typeFilter === 'checklist' ? 'Tạo To-do ngay' : 'Tạo ghi chú ngay'}
              </button>
            </div>
          )}

                  </div>
      </div>

      {/* ─────────────────── Apple Gemini API Key Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      <AppleLiquidDialog
        isOpen={showApiKeySetting}
        onClose={() => {
          setShowApiKeySetting(false);
          setApiKeyTestResult(null);
        }}
        zIndex={10015}
        ariaLabel="Cài đặt Gemini API Key"
        containerClassName={cn(
          "w-full max-w-[440px] bg-white/90 dark:bg-[#1c1c24]/90 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-5.5 space-y-4 text-left",
          apiKeyShake && "apple-shake"
        )}
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
                Cung cấp trí tuệ cho Writing Tools
              </p>
            </div>
          </div>
          <CloseButton
            onClick={() => {
              setShowApiKeySetting(false);
              setApiKeyTestResult(null);
            }}
            size="sm"
          />
        </div>

        <div className="space-y-2.5">
          <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Nhập Google Gemini API Key:
          </label>
          <div className="relative flex items-center">
            <input
              type={showApiKeyPassword ? 'text' : 'password'}
              value={geminiApiKeyInput}
              onChange={(e) => {
                setGeminiApiKeyInput(e.target.value);
                setApiKeyTestResult(null);
              }}
              placeholder="AIzaSy..."
              className="w-full pl-3 pr-10 py-2.5 rounded-xl text-[12.5px] font-mono bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20 outline-none focus:border-[#0071e3] dark:focus:border-[#2997ff] text-[#1d1d1f] dark:text-white transition-all shadow-2xs"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowApiKeyPassword(!showApiKeyPassword)}
              className="absolute right-2.5 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer p-1"
              title={showApiKeyPassword ? 'Ẩn khóa' : 'Hiện khóa'}
            >
              {showApiKeyPassword ? <SFEyeSlash size={14} /> : <SFEye size={14} />}
            </button>
          </div>

          {/* Validation Error Badge */}
          {apiKeyTestResult && !apiKeyTestResult.success && (
            <div
              className="text-[11.5px] px-3 py-2 rounded-xl font-medium flex items-start gap-2 bg-rose-500/12 text-rose-700 dark:text-rose-400 border border-rose-500/25 leading-snug animate-in fade-in duration-150"
            >
              <SFXmark size={14} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 break-words">
                <span className="font-semibold">Xác thực thất bại:</span> {apiKeyTestResult.message}
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Hệ thống sẽ tự động quét và kết nối với model Gemini Flash mới nhất khả dụng cho tài khoản của bạn. Khóa API hợp lệ sẽ được lưu an toàn trên máy của bạn.
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/10">
          {getStoredGeminiKey() ? (
            <button
              type="button"
              onClick={() => {
                setStoredGeminiKey('');
                setGeminiApiKeyInput('');
                setApiKeyTestResult(null);
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
              onClick={() => {
                setShowApiKeySetting(false);
                setApiKeyTestResult(null);
              }}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isTestingApiKey || !geminiApiKeyInput.trim()}
              onClick={handleValidateAndSaveApiKey}
              className="px-4.5 py-1.5 rounded-full text-[12px] font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0"
            >
              {isTestingApiKey ? (
                <>
                  <SFArrowClockwise size={12.5} className="animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <SFCheckmark size={12} className="stroke-[2.5]" />
                  <span>Xác thực & Lưu</span>
                </>
              )}
            </button>
          </div>
        </div>
      </AppleLiquidDialog>

      {/* ─────────────────── Apple Liquid Glass Master Reminder Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      <AppleLiquidDialog
        isOpen={Boolean(showReminderModal && activeNote)}
        onClose={() => setShowReminderModal(false)}
        zIndex={10005}
        title="Cài lịch nhắc nhở"
        overlayClassName="p-4"
        contentClassName="w-full max-w-[460px] max-h-[85vh] flex flex-col bg-white/90 dark:bg-[#1c1c24]/90 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden text-left"
      >
        {activeNote && (
          <>
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
                {activeNote?.title ? `Cho "${activeNote.title}"` : 'Hẹn giờ thông báo tự động'}
              </p>
            </div>
          </div>
          <CloseButton
            onClick={() => setShowReminderModal(false)}
            size="sm"
          />
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
            <AppleDateTimePicker
              value={reminderDate}
              onChange={setReminderDate}
            />
          </div>

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
                    <SFEnvelope size={14} />
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
                      placeholder="Địa chỉ email nhận (VD: your_email@gmail.com)"
                      className="flex-1 px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-black/20 border border-black/15 dark:border-white/20 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white shadow-2xs"
                    />
                    <button
                      type="button"
                      disabled={isSendingTestEmail}
                      onClick={handleSendTestEmail}
                      className="px-3 py-2 rounded-xl text-[11.5px] font-medium bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] border border-[#0071e3]/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      title="Gửi thử một email mẫu để kiểm tra hòm thư"
                    >
                      {isSendingTestEmail ? <SFArrowClockwise size={12} className="animate-spin" /> : <SFPaperplaneFill size={12} />}
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
        </>
        )}
      </AppleLiquidDialog>

      {/* ─────────────────── Dedicated Apple Liquid Glass To-do Item Reminder Modal ─────────────────── */}
      <AppleLiquidDialog
        isOpen={Boolean(todoReminderTarget)}
        onClose={() => setTodoReminderTarget(null)}
        zIndex={10006}
        title="Hẹn giờ việc cần làm"
        overlayClassName="p-4"
        contentClassName="w-full max-w-[380px] flex flex-col bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden text-left"
      >
        {todoReminderTarget && (
          <>
            {/* Header */}
            <div className="p-4 sm:px-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-black/[0.01] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#0071e3]/20 to-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-2xs shrink-0">
                  <SFCheckmarkSquare size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-[14.5px] text-[#1d1d1f] dark:text-white leading-tight truncate">
                    Hẹn Giờ Nhắc Việc
                  </h4>
                  <p className="text-[11.5px] text-[#6e6e73] dark:text-[#a1a1a6] truncate mt-0.5 max-w-[240px]">
                    To-do: {todoReminderTarget.taskText || 'Việc cần làm'}
                  </p>
                </div>
              </div>
              <CloseButton
                onClick={() => setTodoReminderTarget(null)}
                size="sm"
              />
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-3.5">
              {/* Task Title Preview Pill */}
              <div className="px-3.5 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/10 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0" />
                <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                  {todoReminderTarget.taskText || '(Chưa nhập tên công việc)'}
                </span>
              </div>

              {/* Quick Preset Buttons (Apple Reminders 1-tap presets) */}
              <div className="space-y-1.5">
                <div className="text-[11.5px] font-semibold text-[#86868b] dark:text-[#a1a1a6]">
                  Gợi ý nhanh
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setHours(18, 0, 0, 0);
                      if (d.getTime() <= Date.now()) d.setHours(21, 0, 0, 0);
                      setTodoReminderTarget((prev) => (prev ? { ...prev, reminderAt: toDatetimeLocal(d) } : null));
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 dark:hover:bg-[#0071e3]/20 hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.05] dark:border-white/10 text-[11.5px] font-medium text-left transition-colors cursor-pointer"
                  >
                    🌇 Tối nay (18:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(9, 0, 0, 0);
                      setTodoReminderTarget((prev) => (prev ? { ...prev, reminderAt: toDatetimeLocal(d) } : null));
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 dark:hover:bg-[#0071e3]/20 hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.05] dark:border-white/10 text-[11.5px] font-medium text-left transition-colors cursor-pointer"
                  >
                    🌅 Sáng mai (09:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(14, 0, 0, 0);
                      setTodoReminderTarget((prev) => (prev ? { ...prev, reminderAt: toDatetimeLocal(d) } : null));
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 dark:hover:bg-[#0071e3]/20 hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.05] dark:border-white/10 text-[11.5px] font-medium text-left transition-colors cursor-pointer"
                  >
                    ☀️ Chiều mai (14:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 60 * 60 * 1000);
                      setTodoReminderTarget((prev) => (prev ? { ...prev, reminderAt: toDatetimeLocal(d) } : null));
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 dark:hover:bg-[#0071e3]/20 hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.05] dark:border-white/10 text-[11.5px] font-medium text-left transition-colors cursor-pointer"
                  >
                    ⏱️ Sau 1 giờ nữa
                  </button>
                </div>
              </div>

              {/* Date & Time Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
                  <SFClock size={12} className="text-[#0071e3]" />
                  <span>Chọn ngày & giờ tùy chỉnh:</span>
                </label>
                <AppleDateTimePicker
                  value={todoReminderTarget.reminderAt}
                  onChange={(newVal) =>
                    setTodoReminderTarget((prev) => (prev ? { ...prev, reminderAt: newVal } : null))
                  }
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:px-5 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-black/[0.01] dark:bg-white/[0.02]">
              {todoReminderTarget.reminderAt ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSaveIndividualTaskReminder(
                      todoReminderTarget.lineIndex,
                      todoReminderTarget.taskId,
                      todoReminderTarget.taskText,
                      null
                    );
                    setTodoReminderTarget(null);
                  }}
                  className="text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Xóa lịch nhắc
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTodoReminderTarget(null)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveIndividualTaskReminder(
                      todoReminderTarget.lineIndex,
                      todoReminderTarget.taskId,
                      todoReminderTarget.taskText,
                      todoReminderTarget.reminderAt,
                      activeNote?.reminderEmail || reminderEmail,
                      activeNote?.reminderNotifyEmail ?? reminderNotifyEmail
                    );
                    setTodoReminderTarget(null);
                  }}
                  className="px-4 py-1.5 rounded-full text-[12px] font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  Lưu hẹn giờ
                </button>
              </div>
            </div>
          </>
        )}
      </AppleLiquidDialog>

      {/* ─────────────────── Apple PIN Lock Config Modal (Apple Liquid Glass Blur & Translucency) ─────────────────── */}
      <AppleLiquidDialog
        isOpen={Boolean(showLockConfigModal && activeNote && (!activeNote.isLocked || unlockedNoteIds.includes(activeNote.id)))}
        onClose={() => {
          setShowLockConfigModal(false);
          setLockCurrentPassword('');
          setLockNewPassword('');
          setLockConfirmPassword('');
          setLockConfigMismatch(false);
        }}
        zIndex={10015}
        title="Cài đặt mã PIN"
        overlayClassName="p-4"
        contentClassName={cn(
          "w-full max-w-[340px] bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 text-center space-y-5 relative cursor-default",
          lockConfigMismatch && "apple-shake"
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            const input = document.getElementById('apple-pin-config-input') as HTMLInputElement | null;
            input?.focus();
          }}
          className="space-y-4"
        >
          {/* Header */}
          <div className="space-y-1.5 pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs mx-auto mb-2">
              <SFLock size={22} />
            </div>
            <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
              {activeNote?.isLocked ? 'Đổi mã PIN bảo vệ' : 'Cài mã PIN bảo vệ'}
            </h3>
            <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] min-h-[18px]">
              {activeNote?.isLocked && lockCurrentPassword.length < 6
                ? lockConfigMismatch
                  ? 'Mã PIN hiện tại không đúng! Vui lòng thử lại'
                  : 'Nhập mã PIN 6 số hiện tại để xác thực'
                : lockNewPassword.length < 6
                ? 'Nhập mã PIN 6 số mới'
                : lockConfigMismatch
                ? 'Mã xác nhận không khớp! Vui lòng nhập lại'
                : 'Nhập lại mã PIN mới để xác nhận'}
            </p>
          </div>

          {/* 6 Visual PIN Dots */}
          <div className="flex items-center justify-center gap-3.5 my-3 cursor-pointer relative py-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const isVerifyingOld = Boolean(activeNote?.isLocked && lockCurrentPassword.length < 6);
              const isConfirming = !isVerifyingOld && lockNewPassword.length === 6;
              const currentPin = isVerifyingOld
                ? lockCurrentPassword
                : isConfirming
                ? lockConfirmPassword
                : lockNewPassword;
              const isFilled = i < currentPin.length;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-150",
                    lockConfigMismatch
                      ? "bg-rose-500 shadow-xs scale-110"
                      : isFilled
                      ? "bg-[#0071e3] dark:bg-[#2997ff] shadow-xs scale-110"
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
              value={
                activeNote?.isLocked && lockCurrentPassword.length < 6
                  ? lockCurrentPassword
                  : lockNewPassword.length < 6
                  ? lockNewPassword
                  : lockConfirmPassword
              }
              onKeyDown={(e) => {
                if (['Backspace', 'Tab', 'Escape'].includes(e.key)) {
                  if (e.key === 'Escape') {
                    setShowLockConfigModal(false);
                    setLockCurrentPassword('');
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
                    } else if (activeNote?.isLocked && lockCurrentPassword.length > 0) {
                      setLockCurrentPassword((prev) => prev.slice(0, -1));
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

                // Step 1: Verify Current PIN if note is currently locked
                if (activeNote?.isLocked && lockCurrentPassword.length < 6) {
                  const nextCurrent = lockCurrentPassword + digit;
                  setLockCurrentPassword(nextCurrent);
                  if (nextCurrent.length === 6) {
                    if (nextCurrent === activeNote.password) {
                      // Verified! Move to entering new PIN
                      playAppleChime();
                      setLockConfigMismatch(false);
                    } else {
                      // Current PIN is incorrect!
                      setLockConfigMismatch(true);
                      toast.error('Mã PIN hiện tại không chính xác!', { id: 'note-old-pin-err' });
                      setTimeout(() => {
                        setLockCurrentPassword('');
                        setLockConfigMismatch(false);
                        const input = document.getElementById('apple-pin-config-input') as HTMLInputElement | null;
                        input?.focus();
                      }, 600);
                    }
                  }
                  return;
                }

                // Step 2: Enter new PIN
                if (lockNewPassword.length < 6) {
                  setLockNewPassword((prev) => prev + digit);
                  return;
                }

                // Step 3: Confirm new PIN
                if (lockConfirmPassword.length < 6) {
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
              {activeNote?.isLocked
                ? lockCurrentPassword.length < 6
                  ? 'Bước 1/3: Xác thực PIN cũ'
                  : lockNewPassword.length < 6
                  ? 'Bước 2/3: Đặt PIN mới'
                  : 'Bước 3/3: Xác nhận lại PIN mới'
                : lockNewPassword.length < 6
                ? 'Bước 1/2: Đặt PIN mới'
                : 'Bước 2/2: Xác nhận lại PIN'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/10">
            {activeNote?.isLocked ? (
              <button
                type="button"
                onClick={() => {
                  setShowLockConfigModal(false);
                  setLockCurrentPassword('');
                  setLockNewPassword('');
                  setLockConfirmPassword('');
                  setLockConfigMismatch(false);
                  setLockRemoveInput('');
                  setLockRemoveMismatch(false);
                  setShowLockRemoveModal(true);
                }}
                className="text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Gỡ khóa bảo vệ
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLockConfigModal(false);
                  setLockCurrentPassword('');
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
      </AppleLiquidDialog>

      {/* ─────────────────── Apple Liquid Glass Remove Note PIN Modal (Strictly Requires Current 6-digit PIN) ─────────────────── */}
      <AppleLiquidDialog
        isOpen={Boolean(showLockRemoveModal && activeNote && activeNote.isLocked)}
        onClose={() => {
          setShowLockRemoveModal(false);
          setLockRemoveInput('');
          setLockRemoveMismatch(false);
        }}
        zIndex={10025}
        title="Gỡ bỏ mật khẩu ghi chú"
        overlayClassName="p-4"
        contentClassName={cn(
          "w-full max-w-[340px] bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 text-center space-y-4 relative cursor-default",
          lockRemoveMismatch && "apple-shake"
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            const input = document.getElementById('apple-note-pin-remove-input') as HTMLInputElement | null;
            input?.focus();
          }}
          className="space-y-4"
        >
          {/* Header Icon */}
          <div className="space-y-1.5 pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-xs mx-auto mb-2">
              <SFLockOpen size={22} />
            </div>
            <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
              Xác nhận gỡ mã PIN
            </h3>
            <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] min-h-[18px]">
              {lockRemoveMismatch
                ? 'Mã PIN hiện tại không đúng! Vui lòng thử lại'
                : 'Nhập mã PIN 6 số hiện tại để gỡ bỏ bảo vệ'}
            </p>
          </div>

          {/* 6 Visual Apple Passcode Dots */}
          <div className="flex items-center justify-center gap-3.5 my-3 cursor-pointer relative py-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const isFilled = i < lockRemoveInput.length;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-150",
                    lockRemoveMismatch
                      ? "bg-rose-500 shadow-xs scale-110"
                      : isFilled
                      ? "bg-[#0071e3] dark:bg-[#2997ff] shadow-xs scale-110"
                      : "border-2 border-black/20 dark:border-white/25 bg-transparent"
                  )}
                />
              );
            })}

            {/* Hidden Active Input for True Numeric Keypad / Keyboard capture */}
            <input
              id="apple-note-pin-remove-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={lockRemoveInput}
              onKeyDown={(e) => {
                if (['Backspace', 'Tab', 'Escape'].includes(e.key)) {
                  if (e.key === 'Escape') {
                    setShowLockRemoveModal(false);
                    setLockRemoveInput('');
                    setLockRemoveMismatch(false);
                  }
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    setLockRemoveInput((prev) => prev.slice(0, -1));
                    setLockRemoveMismatch(false);
                  }
                  return;
                }
                if (!/^[0-9]$/.test(e.key)) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                const digit = e.key;
                if (lockRemoveInput.length < 6) {
                  const nextVal = lockRemoveInput + digit;
                  setLockRemoveInput(nextVal);
                  if (nextVal.length === 6) {
                    if (nextVal === activeNote?.password) {
                      updateActiveNote({ isLocked: false, password: '' });
                      setUnlockedNoteIds((prev) => prev.filter((id) => id !== activeNote.id));
                      setShowLockRemoveModal(false);
                      setLockRemoveInput('');
                      setLockRemoveMismatch(false);
                      playAppleChime();
                      toast.success('🛡️ Đã gỡ bỏ mật khẩu ghi chú thành công!', { id: 'note-lock-removed' });
                    } else {
                      setLockRemoveMismatch(true);
                      toast.error('Mã PIN không chính xác! Đang làm mới...', { id: 'note-pin-remove-err' });
                      setTimeout(() => {
                        setLockRemoveInput('');
                        setLockRemoveMismatch(false);
                        const input = document.getElementById('apple-note-pin-remove-input') as HTMLInputElement | null;
                        input?.focus();
                      }, 600);
                    }
                  }
                }
              }}
              onChange={() => {}}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end pt-2 border-t border-black/[0.06] dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setShowLockRemoveModal(false);
                setLockRemoveInput('');
                setLockRemoveMismatch(false);
              }}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
            >
              Hủy
            </button>
          </div>
        </div>
      </AppleLiquidDialog>


      {/* ─────────────────── Snipping Tool Interactive Overlay ─────────────────── */}
      {snippingSnapshot && (
        <SnippingToolOverlay
          snapshotDataUrl={snippingSnapshot}
          onCropComplete={handleSnippingCropComplete}
          onCancel={() => setSnippingSnapshot(null)}
        />
      )}



      {/* ─────────────────── Liquid Glass Full-Size Image Lightbox Portal ─────────────────── */}
      {lightboxPresence.shouldRender &&
        (() => {
          const activeImg = lightboxImage || lastLightboxImageRef.current;
          if (!activeImg) return null;
          return createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Xem ảnh chi tiết"
              onClick={(e) => {
                if (e.target === e.currentTarget && !lightboxPresence.isExiting) {
                  e.stopPropagation();
                  setLightboxImage(null);
                  handleResetLightboxZoom();
                }
              }}
              className={cn(
                "fixed inset-0 z-[10002] bg-black/80 dark:bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 select-none will-change-[backdrop-filter,opacity]",
                lightboxPresence.isExiting
                  ? "liquid-backdrop-exit pointer-events-none"
                  : "liquid-backdrop-enter pointer-events-auto"
              )}
            >
              {/* Top Floating Pill Capsule Toolbar */}
              <header
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "w-full max-w-xl flex items-center justify-between px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white shrink-0 z-20 transition-all duration-200 ease-out",
                  lightboxPresence.isExiting
                    ? "-translate-y-4 opacity-0 scale-95 pointer-events-none"
                    : "translate-y-0 opacity-100 scale-100"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-white/80 shrink-0">
                    <SFPhoto size={13} />
                  </div>
                  <span className="text-[13px] font-semibold truncate max-w-xs text-white">
                    {activeImg.name || 'Ảnh ghi chú'}
                  </span>
                  {activeImg.size && (
                    <span className="text-[11px] font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                      {formatFileSize(activeImg.size)}
                    </span>
                  )}
                </div>

                {/* Pure Icon Buttons - Apple Dark Liquid Glass Capsule */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyImage(activeImg)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 active:scale-90 text-white/90 hover:text-white border border-white/15 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-105 cursor-pointer shadow-xs shrink-0"
                    title="Sao chép ảnh (Ctrl+C)"
                  >
                    <SFSquareOnSquare size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadImage(activeImg.url, activeImg.name)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-105 cursor-pointer shadow-xs shrink-0"
                    title="Tải ảnh về máy"
                  >
                    <SFArrowDownToLine size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteImage(activeImg.id, activeImg.url);
                      setLightboxImage(null);
                      handleResetLightboxZoom();
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-105 cursor-pointer shadow-xs shrink-0"
                    title="Xóa ảnh khỏi ghi chú"
                  >
                    <SFTrash size={14} />
                  </button>

                  <CloseButton
                    onClick={() => {
                      setLightboxImage(null);
                      handleResetLightboxZoom();
                    }}
                    size="md"
                    className="w-8 h-8 min-w-[32px] min-h-[32px] bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/15 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-105 active:scale-90 shadow-xs"
                    title="Đóng xem ảnh (Esc)"
                  />
                </div>
              </header>

              {/* Main Stage with Floating Image & Chevrons & Outside Click Listener */}
              <main
                onClick={(e) => {
                  if (e.target === e.currentTarget && !lightboxPresence.isExiting) {
                    e.stopPropagation();
                    setLightboxImage(null);
                    handleResetLightboxZoom();
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
                    className={cn(
                      "absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all cursor-pointer shadow-lg z-20",
                      lightboxPresence.isExiting && "opacity-0 scale-90 pointer-events-none"
                    )}
                    title="Ảnh trước (Phím Mũi tên trái)"
                  >
                    <SFChevronLeft size={18} />
                  </button>
                )}

                <div
                  className={cn(
                    "relative flex items-center justify-center max-w-full max-h-full will-change-[transform,opacity,filter]",
                    lightboxPresence.isExiting
                      ? "apple-lightbox-stage-exit pointer-events-none"
                      : "apple-lightbox-stage-enter pointer-events-auto"
                  )}
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const delta = e.deltaY < 0 ? 0.2 : -0.2;
                    setLightboxZoom((z) => {
                      const next = Math.min(4, Math.max(0.5, +(z + delta).toFixed(2)));
                      if (next <= 1) {
                        setLightboxPan({ x: 0, y: 0 });
                      }
                      return next;
                    });
                  }}
                >
                  <img
                    src={activeImg.url}
                    alt={activeImg.name || 'Ảnh chi tiết'}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleToggleDoubleZoom();
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return; // Only left mouse button
                      e.preventDefault();
                      e.stopPropagation();
                      setIsLightboxPanning(true);
                      lightboxPanStartRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        originX: lightboxPan.x,
                        originY: lightboxPan.y,
                      };
                    }}
                    style={{
                      transform: `translate3d(${lightboxPan.x}px, ${lightboxPan.y}px, 0) scale(${lightboxZoom})`,
                      cursor: lightboxZoom > 1 ? (isLightboxPanning ? 'grabbing' : 'grab') : 'zoom-in',
                      transition: isLightboxPanning ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    className="max-h-[calc(100vh-170px)] max-w-[90vw] object-contain rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.5)] border border-white/15 select-none will-change-transform"
                  />
                </div>

                {/* Next Image Chevron */}
                {noteImages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    className={cn(
                      "absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all cursor-pointer shadow-lg z-20",
                      lightboxPresence.isExiting && "opacity-0 scale-90 pointer-events-none"
                    )}
                    title="Ảnh kế tiếp (Phím Mũi tên phải)"
                  >
                    <SFChevronRight size={18} />
                  </button>
                )}
              </main>

              {/* Bottom Floating Pill - Zoom Controls & Counter */}
              <footer
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white text-[12px] shrink-0 z-20 transition-all duration-200 ease-out",
                  lightboxPresence.isExiting
                    ? "translate-y-4 opacity-0 scale-95 pointer-events-none"
                    : "translate-y-0 opacity-100 scale-100"
                )}
              >
                <button
                  type="button"
                  onClick={handleZoomOutLightbox}
                  className="w-7 h-7 rounded-full hover:bg-white/15 active:scale-90 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer text-sm font-bold"
                  title="Thu nhỏ (-)"
                >
                  -
                </button>

                <button
                  type="button"
                  onClick={handleResetLightboxZoom}
                  className="px-2.5 py-0.5 rounded-full hover:bg-white/15 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer font-mono text-[11px]"
                  title="Tỉ lệ ban đầu 100% (Phím 0 hoặc nhấp đúp)"
                >
                  {Math.round(lightboxZoom * 100)}%
                </button>

                <button
                  type="button"
                  onClick={handleZoomInLightbox}
                  className="w-7 h-7 rounded-full hover:bg-white/15 active:scale-90 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer text-sm font-bold"
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
          );
        })()}

      {/* ─────────────────── Apple QuickLook File Preview Modal ─────────────────── */}
      {/* ─────────────────── Apple QuickLook File Preview Modal ─────────────────── */}
      <AppleLiquidDialog
        isOpen={Boolean(filePreviewModal)}
        onClose={() => {
          setFilePreviewModal(null);
          setIsPreviewFullscreen(false);
        }}
        zIndex={10010}
        title={currentFilePreview ? `Xem trước tệp ${currentFilePreview.name}` : 'Xem trước tệp'}
        overlayClassName={isPreviewFullscreen ? "p-0" : "p-3 sm:p-6"}
        contentClassName={cn(
          "relative bg-white dark:bg-[#1c1c24] flex flex-col overflow-hidden transition-all duration-220 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width,height,transform]",
          isPreviewFullscreen
            ? "fixed inset-0 w-full h-full max-w-none max-h-none rounded-none shadow-none border-0 z-50"
            : "w-full max-w-4xl h-[85vh] max-h-[850px] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.55)] border border-black/10 dark:border-white/12"
        )}
      >
        {currentFilePreview && (
          <>
            {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] shrink-0">
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    className="shrink-0"
                    dangerouslySetInnerHTML={{ __html: getAppleDocSvg(currentFilePreview.ext) }}
                  />
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate" title={currentFilePreview.name}>
                      {currentFilePreview.name}
                    </h3>
                    <p className="text-[11px] text-[#86868b] font-mono">
                      {currentFilePreview.ext.toUpperCase()} {currentFilePreview.size && `• ${currentFilePreview.size}`}
                      {currentFilePreview.ext.toLowerCase() === 'docx' && docxPreview && ` • ${docxPreview.length} đoạn văn`}
                    </p>
                  </div>
                </div>

                {/* Thứ tự nút chuẩn Apple: Tải về -> Xóa -> Phóng to/Thu nhỏ -> Đóng (Thống nhất màu sắc trung tính thanh lịch) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 1. Nút Tải về */}
                  <button
                    type="button"
                    onClick={() => {
                      if (currentFilePreview.fileId) {
                        attachmentService.downloadAttachment(currentFilePreview.fileId, currentFilePreview.name);
                      } else {
                        const dlUrl = previewBlobUrl || currentFilePreview.url;
                        const a = document.createElement('a');
                        a.href = dlUrl;
                        a.download = currentFilePreview.name;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => a.remove(), 120);
                      }
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.16] text-[#48484a] hover:text-[#1d1d1f] dark:text-[#ebebf5] dark:hover:text-white border border-black/[0.06] dark:border-white/10 transition-all duration-200 ease-out hover:scale-105 active:scale-90 cursor-pointer shadow-2xs shrink-0"
                    title="Tải xuống tệp tin"
                  >
                    <SFArrowDownToLine size={14} />
                  </button>

                  {/* 2. Nút Xóa */}
                  <button
                    type="button"
                    onClick={() => handleDeleteFileFromPreview(currentFilePreview.url, currentFilePreview.name, currentFilePreview.fileId)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.16] text-[#48484a] hover:text-[#1d1d1f] dark:text-[#ebebf5] dark:hover:text-white border border-black/[0.06] dark:border-white/10 transition-all duration-200 ease-out hover:scale-105 active:scale-90 cursor-pointer shadow-2xs shrink-0"
                    title="Xóa tệp này khỏi ghi chú"
                  >
                    <SFTrash size={14} />
                  </button>

                  {/* 3. Nút Phóng to / Thu nhỏ */}
                  <button
                    type="button"
                    onClick={() => setIsPreviewFullscreen((prev) => !prev)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.16] text-[#48484a] hover:text-[#1d1d1f] dark:text-[#ebebf5] dark:hover:text-white border border-black/[0.06] dark:border-white/10 transition-all duration-200 ease-out hover:scale-105 active:scale-90 cursor-pointer shadow-2xs shrink-0"
                    title={isPreviewFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
                  >
                    {isPreviewFullscreen ? <SFArrowDownRightAndArrowUpLeft size={14} /> : <SFArrowUpLeftAndArrowDownRight size={14} />}
                  </button>

                  {/* 4. Nút Đóng */}
                  <CloseButton
                    onClick={() => {
                      setFilePreviewModal(null);
                      setIsPreviewFullscreen(false);
                    }}
                    size="md"
                    className="w-8 h-8 min-w-[32px] min-h-[32px] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.16] text-[#48484a] hover:text-[#1d1d1f] dark:text-[#ebebf5] dark:hover:text-white border border-black/[0.06] dark:border-white/10 transition-all duration-200 ease-out hover:scale-105 active:scale-90 shadow-2xs"
                    title="Đóng xem trước (Esc)"
                  />
                </div>
              </div>

              {/* Preview Body - Multi-format In-App QuickLook */}
              <div
                className={cn(
                  "flex-1 overflow-auto bg-[#f0f2f5] dark:bg-[#121217]",
                  ['docx', 'xlsx', 'xls', 'pdf', 'pptx'].includes(currentFilePreview.ext.toLowerCase())
                    ? "p-0 flex flex-col items-center"
                    : "p-3 sm:p-4 flex items-center justify-center"
                )}
              >
                {isPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center p-8 text-[#86868b] space-y-3">
                    <SFArrowClockwise className="w-8 h-8 animate-spin text-[#0071e3]" />
                    <span className="text-[13px] font-medium">Đang giải nạp và chuẩn bị xem trước tệp...</span>
                  </div>
                ) : currentFilePreview.ext.toLowerCase() === 'pdf' ? (
                  <iframe
                    key={previewBlobUrl || currentFilePreview.url}
                    src={previewBlobUrl || currentFilePreview.url}
                    className="w-full h-full rounded-xl border border-black/10 dark:border-white/10 shadow-sm bg-white"
                    title={currentFilePreview.name}
                  />
                ) : ['xlsx', 'xls'].includes(currentFilePreview.ext.toLowerCase()) ? (
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
                ) : currentFilePreview.ext.toLowerCase() === 'docx' && docxPreview && docxPreview.length > 0 ? (
                  <div className="w-full h-full overflow-y-auto py-8 sm:py-12 px-3 sm:px-8 flex justify-center items-start">
                    <div className="w-full max-w-4xl bg-white dark:bg-[#1c1c24] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8 sm:p-14 md:p-16 shadow-[0_10px_35px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-left font-sans select-text space-y-4 shrink-0 h-fit">
                      {docxPreview.map((b, idx) => {
                        if (b.type === 'h1') {
                          return (
                            <h1
                              key={idx}
                              className={cn(
                                "text-[22px] font-bold text-[#1d1d1f] dark:text-white pt-4 pb-2 border-b border-black/[0.08] dark:border-white/10 tracking-tight",
                                b.align === 'center' ? 'text-center' : b.align === 'right' ? 'text-right' : 'text-left'
                              )}
                            >
                              {b.text}
                            </h1>
                          );
                        }
                        if (b.type === 'h2') {
                          return (
                            <h2
                              key={idx}
                              className={cn(
                                "text-[18px] font-semibold text-[#1d1d1f] dark:text-white pt-3 pb-1 tracking-tight",
                                b.align === 'center' ? 'text-center' : b.align === 'right' ? 'text-right' : 'text-left'
                              )}
                            >
                              {b.text}
                            </h2>
                          );
                        }
                        if (b.type === 'h3') {
                          return (
                            <h3
                              key={idx}
                              className={cn(
                                "text-[15.5px] font-semibold text-[#1d1d1f] dark:text-white pt-2",
                                b.align === 'center' ? 'text-center' : b.align === 'right' ? 'text-right' : 'text-left'
                              )}
                            >
                              {b.text}
                            </h3>
                          );
                        }
                        if (b.type === 'li') {
                          return (
                            <div key={idx} className="flex items-start gap-3 text-[14.5px] leading-[1.8] text-[#1d1d1f] dark:text-[#f5f5f7] pl-4">
                              <span className="text-[#0071e3] select-none font-bold mt-0.5">•</span>
                              <span className="flex-1">{b.text}</span>
                            </div>
                          );
                        }
                        if (b.type === 'table' && b.tableRows) {
                          return (
                            <div key={idx} className="overflow-x-auto my-4 rounded-xl border border-black/[0.08] dark:border-white/10 shadow-xs bg-white dark:bg-[#16161c]">
                              <table className="w-full border-collapse text-[13px]">
                                <tbody>
                                  {b.tableRows.map((tr, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      className={
                                        rIdx === 0
                                          ? 'bg-black/[0.035] dark:bg-white/[0.06] font-semibold border-b border-black/[0.08] dark:border-white/10'
                                          : 'border-b border-black/[0.04] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.02]'
                                      }
                                    >
                                      {tr.map((tc, cIdx) => (
                                        <td key={cIdx} className="px-3.5 py-2.5 border-r border-black/[0.04] dark:border-white/[0.06] last:border-r-0">
                                          {tc}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        return (
                          <p
                            key={idx}
                            className={cn(
                              "text-[14.5px] leading-[1.85] text-[#2c2c2e] dark:text-[#e5e5ea] whitespace-pre-wrap font-normal",
                              b.bold && "font-semibold text-[#1d1d1f] dark:text-white",
                              b.align === 'center' ? 'text-center' : b.align === 'right' ? 'text-right' : 'text-justify'
                            )}
                          >
                            {b.text}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : currentFilePreview.ext.toLowerCase() === 'pptx' && pptxPreview && pptxPreview.length > 0 ? (
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
                ) : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(currentFilePreview.ext.toLowerCase()) ? (
                  <img
                    src={previewBlobUrl || currentFilePreview.url}
                    alt={currentFilePreview.name}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-black/10 dark:border-white/10"
                  />
                ) : ['mp3', 'wav', 'm4a', 'ogg'].includes(currentFilePreview.ext.toLowerCase()) ? (
                  <div className="p-8 flex flex-col items-center gap-4 bg-white dark:bg-[#1a1a20] rounded-2xl border border-black/10 dark:border-white/10 shadow-md">
                    <div className="w-16 h-16 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center text-[24px]">🎵</div>
                    <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">{currentFilePreview.name}</h4>
                    <audio controls src={previewBlobUrl || currentFilePreview.url} className="w-72 sm:w-96" />
                  </div>
                ) : ['mp4', 'webm', 'mov'].includes(currentFilePreview.ext.toLowerCase()) ? (
                  <video controls src={previewBlobUrl || currentFilePreview.url} className="max-w-full max-h-full rounded-2xl shadow-lg border border-black/10 dark:border-white/10" />
                ) : ['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'log', 'xml', 'yaml', 'yml'].includes(currentFilePreview.ext.toLowerCase()) ? (
                  <div className="w-full h-full overflow-auto p-4 rounded-xl bg-white dark:bg-[#1a1a20] border border-black/10 dark:border-white/10 font-mono text-[12.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap select-text">
                    {previewTextContent !== null ? previewTextContent : 'Đang nạp nội dung văn bản...'}
                  </div>
                ) : (
                  <div className="text-center py-10 px-6 max-w-md">
                    <div
                      className="inline-block mb-4 p-4 rounded-3xl bg-black/[0.04] dark:bg-white/[0.06] shadow-inner"
                      dangerouslySetInnerHTML={{
                        __html: getAppleDocSvg(currentFilePreview.ext).replace('width="26" height="32"', 'width="64" height="78"')
                      }}
                    />
                    <h4 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5 break-words">
                      {currentFilePreview.name}
                    </h4>
                    <p className="text-[12.5px] text-[#86868b] leading-relaxed mb-5">
                      Tệp định dạng <strong>.{currentFilePreview.ext.toUpperCase()}</strong> ({currentFilePreview.size || 'tệp đính kèm'}). Bạn có thể tải về để mở bằng ứng dụng tương ứng trên máy tính.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentFilePreview.fileId) {
                          attachmentService.downloadAttachment(currentFilePreview.fileId, currentFilePreview.name);
                        } else {
                          const dlUrl = previewBlobUrl || currentFilePreview.url;
                          const a = document.createElement('a');
                          a.href = dlUrl;
                          a.download = currentFilePreview.name;
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => a.remove(), 120);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <SFArrowDownToLine size={14} />
                      <span>Tải xuống tệp tin ({currentFilePreview.size || 'tệp đính kèm'})</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
      </AppleLiquidDialog>
    </>,
    document.body
  );
};
