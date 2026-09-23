import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Plus,
  Pin,
  PinOff,
  Minus,
  X,
  Trash2,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeft,
  Search,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { useNoteStore } from '@/stores/note-store';
import { QuickNoteColor } from '@/types/workspace';
import toast from 'react-hot-toast';

const COLOR_MAP: Record<
  QuickNoteColor,
  { bg: string; dot: string; border: string; glow: string }
> = {
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-400/15',
    dot: 'bg-amber-500',
    border: 'border-amber-500/30',
    glow: 'rgba(245,158,11,0.25)',
  },
  blue: {
    bg: 'bg-[#0071e3]/10 dark:bg-[#2997ff]/15',
    dot: 'bg-[#0071e3]',
    border: 'border-[#0071e3]/30',
    glow: 'rgba(0,113,227,0.25)',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/30',
    glow: 'rgba(16,185,129,0.25)',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-400/15',
    dot: 'bg-purple-500',
    border: 'border-purple-500/30',
    glow: 'rgba(139,92,246,0.25)',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-400/15',
    dot: 'bg-rose-500',
    border: 'border-rose-500/30',
    glow: 'rgba(244,63,94,0.25)',
  },
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
    updateActiveNote,
    deleteNote,
    togglePinNote,
    changeColorNote,
  } = useNoteStore();

  const [showSidebar, setShowSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Initial load
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  if (!isOpen) return null;

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // Filter notes by search
  const filteredNotes = notes.filter((n) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateActiveNote({ title: e.target.value });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateActiveNote({ content: e.target.value });
  };

  // Add a checklist task at cursor
  const handleInsertChecklist = () => {
    if (!contentRef.current || !activeNote) return;
    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = activeNote.content;

    const prefix = start > 0 && currentText[start - 1] !== '\n' ? '\n- [ ] ' : '- [ ] ';
    const newContent = currentText.substring(0, start) + prefix + currentText.substring(end);

    updateActiveNote({ content: newContent });

    // Focus & position cursor after inserted prefix
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 50);
  };

  // 1-Click copy whole note
  const handleCopyNote = () => {
    if (!activeNote) return;
    const text = `${activeNote.title}\n\n${activeNote.content}`;
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    toast.success('Đã sao chép nội dung ghi chú!', { id: 'note-copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Minimized Floating Pill View
  if (isMinimized) {
    return createPortal(
      <aside
        aria-label="Cửa sổ ghi chú thu nhỏ"
        className="fixed bottom-6 right-6 z-[9999] animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/85 dark:bg-[#16161c]/85 hover:bg-white dark:hover:bg-[#1c1c24] backdrop-blur-3xl border border-black/10 dark:border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.18),inset_0_1.5px_1px_rgba(255,255,255,1)] hover:shadow-[0_20px_50px_rgba(0,113,227,0.25)] transition-all cursor-pointer select-none active:scale-95"
          title="Mở rộng cửa sổ ghi chú"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a] flex items-center justify-center text-white shadow-xs">
            <FileText className="w-3.5 h-3.5 drop-shadow-xs" />
          </div>
          <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[160px] truncate">
            {activeNote?.title || 'Ghi chú nhanh'}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]">
            {notes.length}
          </span>
        </button>
      </aside>,
      document.body
    );
  }

  const currentColorConfig = COLOR_MAP[activeNote?.color || 'amber'];

  return createPortal(
    <div
      role="region"
      aria-label="Cửa sổ ghi chú nhanh"
      className={`fixed inset-0 z-[9999] flex ${
        isPinned
          ? 'items-end justify-end p-4 sm:p-6 pointer-events-none'
          : 'items-center justify-center p-3 sm:p-5 md:p-6'
      } font-sans select-none animate-in fade-in duration-180`}
    >
      {/* Full Backdrop (only when NOT pinned in PiP mode) */}
      {!isPinned && (
        <div
          className="fixed inset-0 bg-black/35 dark:bg-black/70 backdrop-blur-md transition-opacity"
          onClick={closeNote}
        />
      )}

      {/* ─────────────────── Liquid Glass Note Window ─────────────────── */}
      <div
        className={`pointer-events-auto relative w-full ${
          isPinned ? 'max-w-[440px] sm:max-w-[480px]' : 'max-w-2xl'
        } h-[540px] max-h-[88vh] bg-white/95 dark:bg-[#16161c]/95 backdrop-blur-3xl rounded-[28px] border border-white/80 dark:border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.18),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-1px_1.5px_rgba(0,0,0,0.06)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.18)] flex overflow-hidden z-10 transition-all duration-220 ease-out`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Meniscus Specular Reflection */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/25 to-transparent pointer-events-none z-20" />

        {/* ───────── Collapsible Notes List Sidebar ───────── */}
        {showSidebar && (
          <div className="w-60 sm:w-64 border-r border-black/[0.06] dark:border-white/10 flex flex-col bg-black/[0.02] dark:bg-white/[0.02] shrink-0 animate-in slide-in-from-left duration-200">
            {/* Sidebar Search Bar */}
            <div className="p-3 border-b border-black/[0.06] dark:border-white/10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm ghi chú..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-full text-[12px] bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b]"
                />
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredNotes.map((note) => {
                const isSelected = note.id === activeNote?.id;
                const dotColor = COLOR_MAP[note.color || 'amber'].dot;

                return (
                  <div
                    key={note.id}
                    onClick={() => selectNote(note.id)}
                    className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-[#0071e3]/10 dark:bg-[#2997ff]/15 border border-[#0071e3]/20 dark:border-[#2997ff]/30 shadow-xs'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                        <h5
                          className={`text-[12.5px] font-semibold truncate ${
                            isSelected
                              ? 'text-[#0071e3] dark:text-[#2997ff]'
                              : 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                          }`}
                        >
                          {note.title || 'Ghi chú mới'}
                        </h5>
                      </div>
                      {note.pinned && (
                        <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] line-clamp-1">
                      {note.content.split('\n')[1] || note.content || 'Trống...'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-[#86868b] dark:text-[#76767b] mt-1 font-mono">
                      <span>
                        {new Date(note.updatedAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-0.5"
                        title="Xóa ghi chú"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ───────── Main Editor Column ───────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Apple Window Title Bar */}
          <div className="h-14 px-4 sm:px-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-white/50 dark:bg-white/[0.02]">
            {/* Left Controls: Sidebar toggle + Brand + Add Note */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  showSidebar
                    ? 'bg-[#0071e3]/15 text-[#0071e3] dark:text-[#2997ff]'
                    : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={showSidebar ? 'Ẩn danh sách ghi chú' : 'Hiện danh sách ghi chú'}
              >
                {showSidebar ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeft className="w-4 h-4" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a] flex items-center justify-center text-white shadow-xs">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white hidden sm:inline">
                  Ghi Chú Nhanh
                </span>
              </div>

              <button
                type="button"
                onClick={() => createNote()}
                className="w-7 h-7 rounded-full bg-[#0071e3]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0071e3] hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-90 ml-1"
                title="Tạo ghi chú mới"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Right Window Controls: Pin, Minimize, Close */}
            <div className="flex items-center gap-1.5">
              {/* Always-on-top Pin */}
              <button
                type="button"
                onClick={togglePinned}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isPinned
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isPinned ? 'Bỏ chế độ ghim nổi (PiP)' : 'Ghim nổi trên cùng khi làm việc'}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>

              {/* Minimize to capsule */}
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="w-7 h-7 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Thu nhỏ xuống thanh nổi"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Close window */}
              <button
                type="button"
                onClick={closeNote}
                className="w-7 h-7 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Note Editor Area - Pure Seamless Apple Notes Canvas */}
          {activeNote ? (
            <div className="flex-1 flex flex-col p-5 sm:p-6 overflow-hidden apple-note-canvas">
              {/* Title input - Apple Large Headline Typography */}
              <div className="mb-1">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={handleTitleChange}
                  placeholder="Tiêu đề ghi chú..."
                  className="w-full text-[21px] sm:text-[23px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-none placeholder:text-[#86868b]/40 tracking-tight p-0 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200"
                />
              </div>

              {/* Timestamp & Auto-save status */}
              <div className="flex items-center justify-between text-[11px] text-[#86868b] dark:text-[#76767b] pb-2.5 pt-1 border-b border-black/[0.04] dark:border-white/[0.06] mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#86868b] dark:text-[#a1a1a6]">
                    {new Date(activeNote.updatedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {activeNote.content.length} ký tự
                  </span>
                  <span className="text-[#34c759] flex items-center gap-1 font-medium">
                    <Sparkles className="w-3 h-3 text-[#34c759]" /> Tự động lưu
                  </span>
                </div>

                {/* Quick Note Color Tag Selector */}
                <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05]">
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

              {/* Editor Textarea - Seamless Flowing Writing Canvas */}
              <textarea
                ref={contentRef}
                value={activeNote.content}
                onChange={handleContentChange}
                placeholder="Gõ ghi chú, danh sách việc cần làm, thông tin cần nhớ..."
                className="flex-1 w-full bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-none resize-none font-sans text-[14.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b]/50 dark:placeholder:text-[#636366]/60 p-0 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200"
              />

              {/* Bottom Quick Tools Bar */}
              <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {/* Insert Checklist button */}
                  <button
                    type="button"
                    onClick={handleInsertChecklist}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all cursor-pointer active:scale-95 border border-black/[0.04] dark:border-white/[0.08]"
                    title="Chèn dòng danh sách việc cần làm [ ]"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#2997ff]" />
                    <span>Checklist</span>
                  </button>

                  {/* Pin note in list */}
                  <button
                    type="button"
                    onClick={() => togglePinNote(activeNote.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer border ${
                      activeNote.pinned
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-black/[0.03] dark:bg-white/[0.06] text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white border-black/[0.04] dark:border-white/[0.08]'
                    }`}
                    title={activeNote.pinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú lên đầu'}
                  >
                    <Pin className="w-3 h-3" />
                    <span>{activeNote.pinned ? 'Đã ghim' : 'Ghim'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Copy note button */}
                  <button
                    type="button"
                    onClick={handleCopyNote}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all cursor-pointer active:scale-95 border border-black/[0.04] dark:border-white/[0.08]"
                    title="Sao chép toàn bộ ghi chú"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#34c759]" />
                        <span className="text-[#34c759] font-medium">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#76767b] dark:text-[#a1a1a6]" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>

                  {/* Delete note button */}
                  <button
                    type="button"
                    onClick={() => deleteNote(activeNote.id)}
                    className="w-8 h-8 rounded-full hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Xóa ghi chú này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#76767b]">
              <FileText className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm font-medium">Chưa có ghi chú nào</p>
              <button
                type="button"
                onClick={() => createNote()}
                className="mt-3 px-4 py-1.5 rounded-full bg-[#0071e3] text-white text-xs font-semibold shadow-xs hover:bg-[#0077ed] transition-all cursor-pointer active:scale-95"
              >
                Tạo ghi chú ngay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
