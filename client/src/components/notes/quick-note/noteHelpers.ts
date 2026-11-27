import { QuickNoteColor, NoteImageAttachment } from '@/types/workspace';
import { sanitizeNoteHTML } from '@/services/backupService';
import { attachmentService } from '@/services/attachmentService';

export const COLOR_MAP: Record<
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

export interface ChecklistRow {
  lineIndex: number;
  taskId: string;
  completed: boolean;
  text: string;
  reminderAt?: string | null;
}

export const toDatetimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatReminderBadge = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `${timeStr} Hôm nay`;
    return `${timeStr} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  } catch {
    return '';
  }
};

export const playPopSound = () => {
  // Silent no-op: sound effects disabled across app
};

export const cleanChecklistText = (raw?: string | null): string => {
  if (!raw || !raw.trim()) return '- [ ] ';
  const text = raw
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

export const normalizeChecklistDraft = (raw?: string | null): string => {
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

export const convertTextToNoteBlocks = (text: string): HTMLElement[] => {
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

export const getStrictSelectionLineRects = (
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

    const curr = walker.currentNode;
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

  return merged
    .filter((m) => {
      if (m.width < 14 || m.height > 50) return false;
      if (m.height / m.width > 2.0) return false;
      return true;
    })
    .map((m) => ({
      left: Math.max(0, m.left - 4),
      width: m.width + 8,
      top: m.top - 2,
      height: m.height + 4,
    }))
    .sort((a, b) => a.top - b.top || a.left - b.left);
};

export const getAppleDocSvg = (ext: string): string => {
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

export const generateInlineImageHtml = (dataUrl: string, name: string): string => {
  return `<p><span class="apple-img-wrapper" contenteditable="false" data-media-type="image" style="position: relative; display: inline-flex; line-height: 0; font-size: 0; padding: 0; margin: 6px 0; max-width: 100%; vertical-align: middle; border-radius: 14px; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08); background: transparent;">
    <img src="${dataUrl}" alt="${name}" class="apple-note-inline-img" style="max-width: 320px; max-height: 220px; width: auto; height: auto; object-fit: contain; border-radius: 13px; display: block; margin: 0; padding: 0; border: none; box-shadow: none; vertical-align: top; line-height: 0; cursor: zoom-in;" title="Nhấp để xem ảnh đầy đủ" />
    <button type="button" class="apple-img-delete-btn" style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(24,24,27,0.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; margin: 0; outline: none; z-index: 25; box-shadow: 0 2px 10px rgba(0,0,0,0.5);" title="Xóa hình ảnh này"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"><line x1="2.5" y1="2.5" x2="11.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/><line x1="11.5" y1="2.5" x2="2.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/></svg></button>
  </span></p><p><br></p>`;
};

export const generateFileCardHtml = (fileIdOrUrl: string, fileName: string, ext: string, sizeStr: string): string => {
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

export const ensureHtml = (content: string, noteImages?: NoteImageAttachment[]): string => {
  if (!content) return '<p><br></p>';
  let cleaned = sanitizeNoteHTML(content);

  cleaned = cleaned
    .replace(/&lt;p&gt;/gi, '')
    .replace(/&lt;\/p&gt;/gi, '')
    .replace(/<p>\s*<p>/gi, '<p>')
    .replace(/<\/p>\s*<\/p>/gi, '</p>');

  cleaned = cleaned.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, lvl, attrs, inner) => {
    return `<h${lvl}${attrs}>${inner.replace(/<\/?(?:b|strong)>/gi, '')}</h${lvl}>`;
  });

  if (cleaned.includes('apple-img-action-bar')) {
    cleaned = cleaned.replace(/<span class=["']apple-img-action-bar["'][^>]*>[\s\S]*?<\/span>/gi, '');
  }

  if (typeof document !== 'undefined' && cleaned.includes('<img')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleaned, 'text/html');
      let modified = false;
      const imgs = Array.from(doc.querySelectorAll('img'));
      imgs.forEach((img, idx) => {
        let src = img.getAttribute('src') || '';
        if ((src.startsWith('blob:') || !src) && noteImages && noteImages.length > 0) {
          const matchImg = noteImages[idx] || noteImages.find((item) => item.url?.startsWith('data:image/'));
          if (matchImg?.url && matchImg.url.startsWith('data:image/')) {
            src = matchImg.url;
            img.setAttribute('src', src);
            modified = true;
          } else if (src.startsWith('blob:')) {
            img.setAttribute('src', '');
            modified = true;
          }
        } else if (src.startsWith('blob:')) {
          img.setAttribute('src', '');
          modified = true;
        }

        if (!img.closest('.apple-img-wrapper')) {
          modified = true;
          const alt = img.getAttribute('alt') || 'Hình ảnh';
          const span = document.createElement('span');
          span.className = 'apple-img-wrapper';
          span.setAttribute('contenteditable', 'false');
          span.setAttribute('data-media-type', 'image');
          span.setAttribute('style', 'position: relative; display: inline-flex; line-height: 0; font-size: 0; padding: 0; margin: 6px 0; max-width: 100%; vertical-align: middle; border-radius: 14px; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08); background: transparent;');
          span.innerHTML = `<img src="${src}" alt="${alt}" class="apple-note-inline-img" style="max-width: 320px; max-height: 220px; width: auto; height: auto; object-fit: contain; border-radius: 13px; display: block; margin: 0; padding: 0; border: none; box-shadow: none; vertical-align: top; line-height: 0; cursor: zoom-in;" title="Nhấp để xem ảnh đầy đủ" /><button type="button" class="apple-img-delete-btn" style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(24,24,27,0.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; margin: 0; outline: none; z-index: 25; box-shadow: 0 2px 10px rgba(0,0,0,0.5);" title="Xóa hình ảnh này"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"><line x1="2.5" y1="2.5" x2="11.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/><line x1="11.5" y1="2.5" x2="2.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/></svg></button>`;
          img.replaceWith(span);
        } else {
          const wrapper = img.closest('.apple-img-wrapper');
          if (wrapper) {
            if (img.getAttribute('src') !== src) {
              img.setAttribute('src', src);
              modified = true;
            }
            const existingBtn = wrapper.querySelector('.apple-img-delete-btn');
            if (!existingBtn) {
              modified = true;
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'apple-img-delete-btn';
              btn.setAttribute('style', 'position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(24,24,27,0.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; margin: 0; outline: none; z-index: 25; box-shadow: 0 2px 10px rgba(0,0,0,0.5);');
              btn.setAttribute('title', 'Xóa hình ảnh này');
              btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"><line x1="2.5" y1="2.5" x2="11.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/><line x1="11.5" y1="2.5" x2="2.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/></svg>`;
              wrapper.appendChild(btn);
            } else {
              modified = true;
              existingBtn.setAttribute('style', 'position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(24,24,27,0.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; margin: 0; outline: none; z-index: 25; box-shadow: 0 2px 10px rgba(0,0,0,0.5);');
              existingBtn.setAttribute('title', 'Xóa hình ảnh này');
              existingBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"><line x1="2.5" y1="2.5" x2="11.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/><line x1="11.5" y1="2.5" x2="2.5" y2="11.5" stroke="#ffffff" stroke-width="2.4"/></svg>`;
            }
          }
        }
      });
      if (modified) cleaned = doc.body.innerHTML;
    } catch {}
  }

  if (typeof document !== 'undefined' && cleaned.includes('apple-file-attachment')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleaned, 'text/html');
      let modified = false;
      const fileCards = Array.from(doc.querySelectorAll('.apple-file-attachment'));
      fileCards.forEach((card) => {
        const hasSvg = !!card.querySelector('svg');
        const hasActions = !!card.querySelector('.apple-file-preview-btn, .apple-file-download-btn, .apple-file-delete-btn');
        const hasOldColoredStyle =
          card.outerHTML.includes('rgba(0,113,227') ||
          card.outerHTML.includes('rgba(52,199,89') ||
          card.outerHTML.includes('rgba(255,59,48');
        if (!hasSvg || !hasActions || hasOldColoredStyle) {
          modified = true;
          const fileId = card.getAttribute('data-file-id') || '';
          const fileUrl = card.getAttribute('data-file-url') || '';
          const fileName = card.getAttribute('data-file-name') || card.querySelector('.apple-file-attachment-title')?.textContent?.trim() || 'Tệp đính kèm';
          let ext = card.getAttribute('data-file-ext') || '';
          if (!ext && fileName.includes('.')) ext = fileName.split('.').pop() || '';
          const sizeStr = card.getAttribute('data-file-size') || card.querySelector('.apple-file-attachment-size')?.textContent?.trim() || '';

          const freshHtml = generateFileCardHtml(fileId || fileUrl || '#', fileName, ext, sizeStr);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = freshHtml;
          const freshCard = tempDiv.querySelector('.apple-file-attachment');
          if (freshCard) card.replaceWith(freshCard);
        }
      });
      if (modified) cleaned = doc.body.innerHTML;
    } catch {}
  }

  if (/<(p|div|h[1-6]|ul|ol|li|b|strong|i|em|u|s|strike|br|span|img)\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/^#\s+(.*?)$/gm, '<h2>$1</h2>');
  }
  return cleaned
    .split('\n')
    .map((line) => {
      const l = line.trim();
      if (!l) return '<p><br></p>';
      if (l.startsWith('# ')) return `<h2>${l.substring(2)}</h2>`;
      if (/^(?:-\s*)?\[([ xX])\]/.test(l)) return `<p>${l}</p>`;
      if (l.startsWith('- ')) return `<ul><li>${l.substring(2)}</li></ul>`;
      const numMatch = l.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) return `<ol><li>${numMatch[2]}</li></ol>`;
      return `<p>${l}</p>`;
    })
    .join('');
};

export const extractPlainText = (html: string): string => {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  let cleaned = html.length > 50000 ? html.replace(/data:[^"'\s)]+/g, '') : html;
  cleaned = cleaned.replace(
    /<span\b[^>]*class=["'][^"']*apple-file-attachment[^"']*["'][^>]*data-file-name=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi,
    ' 📎 $1 '
  );
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

export const formatNotePreview = (content: string): string => {
  if (!content || !content.trim()) return 'Trống...';
  try {
    if (typeof document !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      doc.querySelectorAll('svg, script, style').forEach((el) => el.remove());
      doc.querySelectorAll('.apple-file-attachment').forEach((card) => {
        const name = card.getAttribute('data-file-name') || card.querySelector('.apple-file-attachment-title')?.textContent?.trim() || 'Tệp đính kèm';
        card.replaceWith(document.createTextNode(` 📎 ${name} `));
      });
      doc.querySelectorAll('.apple-img-wrapper').forEach((wrapper) => {
        const alt = wrapper.querySelector('img')?.getAttribute('alt') || 'Hình ảnh';
        wrapper.replaceWith(document.createTextNode(` 🖼️ ${alt} `));
      });
      const raw = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw) return 'Trống...';
      return raw.replace(/^(?:-\s*)?\[([ xX])\]\s*/, (_, check) =>
        check.toLowerCase() === 'x' ? '☑ ' : '☐ '
      );
    }
  } catch {}

  let plain = content.replace(
    /<span\b[^>]*class=["'][^"']*apple-file-attachment[^"']*["'][^>]*data-file-name=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi,
    ' 📎 $1 '
  );
  plain = plain.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
  plain = plain.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return plain || 'Trống...';
};

export const removeAttachmentFromHtml = (rawHtml: string, targetUrl: string, targetName?: string): string => {
  if (!rawHtml || (!targetUrl && !targetName)) return rawHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    let modified = false;

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
        if (parent && parent.tagName.toLowerCase() === 'p' && parent.children.length === 0 && !parent.textContent?.trim()) {
          parent.remove();
        }
      }
    });

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

    if (modified) return doc.body.innerHTML;
  } catch (err) {
    console.error('Lỗi khi xóa tệp khỏi HTML:', err);
  }
  return rawHtml;
};
