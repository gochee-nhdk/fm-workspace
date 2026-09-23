import React from 'react';
import { useNoteStore } from '@/stores/note-store';
import { SquarePen } from 'lucide-react';

export const QuickNoteFloatingButton: React.FC = () => {
  const { isOpen, isMinimized, toggleNote, notes } = useNoteStore();

  // When note window is open (either expanded or minimized), hide this launcher button
  if (isOpen) {
    return null;
  }

  const noteCount = notes.length;

  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden">
      <button
        onClick={toggleNote}
        title="Ghi chú nhanh (Alt + N hoặc Ctrl + J)"
        className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-full
          backdrop-blur-2xl bg-white/75 dark:bg-[#1c1c1e]/75
          border border-white/60 dark:border-white/15
          shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]
          hover:shadow-[0_12px_40px_rgba(245,158,11,0.22),0_4px_12px_rgba(0,0,0,0.1)]
          hover:scale-[1.03] active:scale-[0.97]
          transition-all duration-300 ease-out cursor-pointer
          overflow-hidden
        `}
      >
        {/* Specular Meniscus Highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent pointer-events-none" />

        {/* Ambient Amber Glow behind icon on hover */}
        <div className="absolute -left-2 -top-2 w-10 h-10 bg-amber-400/20 dark:bg-amber-400/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Icon */}
        <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-sm shadow-amber-500/30 group-hover:rotate-[-6deg] transition-transform duration-300">
          <SquarePen className="w-3.5 h-3.5" />
        </div>

        {/* Label */}
        <div className="flex flex-col items-start leading-none pr-1">
          <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 tracking-tight">
            Ghi chú
          </span>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-400 mt-0.5">
            Alt+N
          </span>
        </div>

        {/* Badge counter if notes exist */}
        {noteCount > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-amber-900 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/80 rounded-full border border-amber-300/40 dark:border-amber-600/30">
            {noteCount}
          </span>
        )}
      </button>
    </div>
  );
};
