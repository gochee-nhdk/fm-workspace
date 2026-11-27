import React, { useRef } from 'react';
import { SFSunMaxFill, SFMoonFill, SFPaintpalette, SFClock, SFDesktopcomputer } from '@/components/ui/AppleIcon';
import { useUiStore, resolveTheme } from '@/stores/ui-store';
import { toggleThemeWithIris } from '@/lib/themeTransition';
import { useAppleTabSpring } from '@/lib/motion';

export const ThemeSegmentedControl: React.FC = React.memo(() => {
  const { theme } = useUiStore();
  const themeTrackRef = useRef<HTMLDivElement>(null);
  const themePillRef = useRef<HTMLDivElement>(null);

  useAppleTabSpring(themeTrackRef, themePillRef, theme, {
    stiffness: 380,
    damping: 25,
    mass: 0.75,
    allowDeformation: true,
  });

  return (
    <div
      ref={themeTrackRef}
      role="tablist"
      aria-label="Tùy chọn giao diện hệ thống"
      className="relative p-1 sm:p-1.5 rounded-[16px] sm:rounded-[18px] bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] grid grid-cols-4 gap-1 select-none"
    >
      <div
        ref={themePillRef}
        data-layout-id="theme-active-pill"
        aria-hidden="true"
        className="absolute inset-y-1 sm:inset-y-1.5 left-0 rounded-xl pointer-events-none z-0 bg-white dark:bg-[#2c2c2e] shadow-[0_3px_12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-black/[0.04] dark:border-white/10 will-change-[transform,width] origin-center opacity-0 transition-opacity duration-150"
      />

      <button
        type="button"
        role="tab"
        aria-selected={theme === 'light'}
        data-tab-id="light"
        onClick={(e) => toggleThemeWithIris('light', e)}
        className={`relative z-10 py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'light'
            ? 'text-amber-600 dark:text-amber-400 font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <SFSunMaxFill size={14} className={`transition-colors duration-160 shrink-0 ${theme === 'light' ? 'text-amber-500' : ''}`} />
        <span className="text-[12px] sm:text-[13px] whitespace-nowrap">Sáng</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={theme === 'dark'}
        data-tab-id="dark"
        onClick={(e) => toggleThemeWithIris('dark', e)}
        className={`relative z-10 py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'dark'
            ? 'text-[#0071e3] dark:text-[#2997ff] font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <SFMoonFill size={14} className={`transition-colors duration-160 shrink-0 ${theme === 'dark' ? 'text-[#0071e3] dark:text-[#2997ff]' : ''}`} />
        <span className="text-[12px] sm:text-[13px] whitespace-nowrap">Tối</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={theme === 'auto_time'}
        data-tab-id="auto_time"
        onClick={(e) => toggleThemeWithIris('auto_time', e)}
        className={`relative z-10 py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'auto_time'
            ? 'text-purple-600 dark:text-purple-400 font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <SFClock size={14} className={`transition-colors duration-160 shrink-0 ${theme === 'auto_time' ? 'text-purple-600 dark:text-purple-400' : ''}`} />
        <span className="text-[12px] sm:text-[13px] whitespace-nowrap">Theo giờ</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={theme === 'system'}
        data-tab-id="system"
        onClick={(e) => toggleThemeWithIris('system', e)}
        className={`relative z-10 py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'system'
            ? 'text-emerald-600 dark:text-emerald-400 font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <SFDesktopcomputer size={14} className={`transition-colors duration-160 shrink-0 ${theme === 'system' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
        <span className="text-[12px] sm:text-[13px] whitespace-nowrap">Hệ thống</span>
      </button>
    </div>
  );
});

export const AppearanceTab: React.FC = React.memo(() => {
  const theme = useUiStore((s) => s.theme);

  return (
    <div className="space-y-6">
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
              <SFPaintpalette size={16} className="text-[#0071e3] dark:text-[#2997ff]" />
              Giao Diện Hệ Thống
            </h3>
            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
              Tùy chỉnh chế độ hiển thị sáng tối hoặc đồng bộ tự động theo thời gian thực.
            </p>
          </div>
          <div className="apple-badge-base apple-badge-info">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#2997ff]" />
            <span>
              {theme === 'auto_time'
                ? `Tự động: ${resolveTheme(theme) === 'dark' ? 'Đang Tối' : 'Đang Sáng'}`
                : theme === 'system'
                ? `Hệ thống: ${resolveTheme(theme) === 'dark' ? 'Đang Tối' : 'Đang Sáng'}`
                : theme === 'light'
                ? 'Sáng'
                : 'Tối'}
            </span>
          </div>
        </div>

        <ThemeSegmentedControl />

        <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#2997ff]" />
          Tùy chọn giao diện được lưu tự động và nhớ qua các lần tải lại trang.
        </p>
      </div>
    </div>
  );
});
