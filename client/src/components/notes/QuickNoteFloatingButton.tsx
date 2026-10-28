import React from 'react';
import { useNoteStore } from '@/stores/note-store';
import { SFSquareAndPencil } from 'sf-symbols-lib';

export const QuickNoteFloatingButton: React.FC = () => {
  const { isOpen, isMinimized, toggleNote, notes } = useNoteStore();

  // When note window is open (either expanded or minimized), hide this launcher button
  if (isOpen) {
    return null;
  }

  // Count only text notes here; To-do lists are a separate note type and live
  // in their own tab, so including them makes the Notes badge misleading.
  const noteCount = notes.filter((note) => note.noteType !== 'checklist').length;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] right-[calc(env(safe-area-inset-right,0px)+1.25rem)] z-40 print:hidden">
      <button
        onClick={toggleNote}
        title="Ghi chú nhanh (Alt + N hoặc Ctrl + J)"
        aria-label="Mở ghi chú nhanh"
        className={`group relative flex items-center gap-2.5 p-2.5 sm:px-4 sm:py-2.5 rounded-full
          backdrop-blur-[36px] saturate-[210%] bg-white/80 dark:bg-[#1c1c24]/85
          border border-white/75 dark:border-white/20
          shadow-[0_16px_36px_-8px_rgba(0,0,0,0.18),inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-1.5px_1.5px_rgba(0,0,0,0.08)]
          hover:shadow-[0_20px_44px_-8px_rgba(245,158,11,0.28),inset_0_1.5px_1px_rgba(255,255,255,1)]
          hover:scale-[1.04] active:scale-[0.92]
          transition-[transform,box-shadow,background-color] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer
          overflow-visible will-change-transform
        `}
      >
        {/* Specular Meniscus Highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent pointer-events-none rounded-t-full" />

        {/* Ambient Amber Glow behind icon on hover */}
        <div className="absolute -left-2 -top-2 w-10 h-10 bg-amber-400/20 dark:bg-amber-400/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {/* Icon */}
        <div className="relative flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-sm shadow-amber-500/30 group-hover:rotate-[-8deg] group-hover:scale-105 active:scale-95 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <SFSquareAndPencil size={17} />
        </div>

        {/* Label (Desktop only) */}
        <div className="hidden sm:flex flex-col items-start leading-none pr-1 select-none">
          <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 tracking-tight">
            Ghi chú
          </span>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-400 mt-0.5">
            Alt+N
          </span>
        </div>

        {/* Badge counter if notes exist */}
        {noteCount > 0 && (
          <span className="max-sm:absolute max-sm:-top-1.5 max-sm:-right-1.5 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-bold text-amber-950 dark:text-amber-100 bg-amber-300 dark:bg-amber-600 rounded-full border-2 border-white dark:border-[#1c1c24] shadow-sm">
            {noteCount}
          </span>
        )}
      </button>
    </div>
  );
};
