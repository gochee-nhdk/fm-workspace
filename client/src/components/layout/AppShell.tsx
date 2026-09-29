import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  SFSquareGrid2x2,
  SFGearshapeFill,
  SFMagnifyingglass,
  SFLine3Horizontal,
  SFXmark,
  SFTablecells,
  SFMoonFill,
  SFSunMaxFill,
  SFSidebarLeft,
  SFSquareAndPencil,
} from '@/components/ui/AppleIcon';
import { CommandPalette } from '@/components/ui/command-palette';
import { ExcelImportModal } from '@/components/excel/ExcelImportModal';
import { QuickNoteWindow } from '@/components/notes/QuickNoteWindow';
import { QuickNoteFloatingButton } from '@/components/notes/QuickNoteFloatingButton';
import { useUiStore, resolveTheme } from '@/stores/ui-store';
import { useNoteStore } from '@/stores/note-store';
import { Button } from '@/components/ui/button';
import { CloseButton } from '@/components/ui/close-button';
import { reminderService } from '@/services/reminderService';
import { useScrollInterpolation, useTabIndicator } from '@/lib/motion';

const navItems = [
  { to: '/', label: 'Bàn làm việc chính', icon: <SFSquareGrid2x2 size={16} /> },
  { to: '/settings', label: 'Cài đặt & Dữ liệu', icon: <SFGearshapeFill size={16} /> },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bàn làm việc',
  '/settings': 'Cài đặt & Dữ liệu',
};

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('fm_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('fm_sidebar_collapsed', String(next));
      return next;
    });
  };

  const { theme, setTheme } = useUiStore();
  const { loadNotes, openNote, toggleNote, notes } = useNoteStore();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const scrollRatio = useScrollInterpolation(mainRef, 48);

  // ✅ Initialize notes on app startup
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // ✅ Synchronize CSS variable --sidebar-width for exact visual centering of toasts & modals
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isSidebarCollapsed ? '72px' : '268px'
    );
  }, [isSidebarCollapsed]);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // ✅ Global Ctrl+K / ⌘K, Ctrl+\, and Alt+N / Ctrl+J listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
      // Alt + N (⌥N) or Ctrl + J (⌘J) for Quick Notes
      if ((e.altKey && e.key.toLowerCase() === 'n') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        toggleNote();
      }
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleNote]);

  // ✅ Listen for fm:open-import event dispatched from any child page
  useEffect(() => {
    const handleOpenImport = () => setImportModalOpen(true);
    window.addEventListener('fm:open-import', handleOpenImport);
    return () => window.removeEventListener('fm:open-import', handleOpenImport);
  }, []);

  // Background reminder notifications monitor
  useEffect(() => {
    const stop = reminderService.startMonitoring();
    return () => {
      stop();
    };
  }, []);

  // Logo click: go home via React Router
  const handleLogoClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      if (location.pathname === '/') {
        window.location.reload();
      } else {
        navigate('/');
      }
    },
    [location.pathname, navigate]
  );

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'FM Workspace';

  return (
    <div className="h-screen w-full bg-[#f8f9fc] dark:bg-[#070709] flex flex-col md:flex-row text-[#1d1d1f] dark:text-[#f5f5f7] font-sans antialiased relative overflow-hidden select-none">
      {/* ─────────────────── Dynamic Chromatic Refraction Canvas (Image 1 & 2) ─────────────────── */}
      <div className="ambient-glow-azure" />
      <div className="ambient-glow-sunset" />
      <div className="ambient-glow-violet" />

      {/* ─────────────────── visionOS Desktop Sidebar (Image 2) ─────────────────── */}
      <aside
        className={`hidden md:flex flex-col ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-[268px]'
        } vision-glass-sidebar shrink-0 h-full select-none z-30 transition-[width] duration-280 ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden will-change-[width]`}
      >

        {/* Workspace Brand Header */}
        <div
          className={`border-b border-black/[0.06] dark:border-white/10 flex items-center ${
            isSidebarCollapsed
              ? 'py-3 px-2 flex-col gap-2.5 justify-center'
              : 'h-[68px] px-3.5 justify-between gap-2.5'
          }`}
        >
          <button
            type="button"
            onClick={handleLogoClick}
            className={`flex items-center ${
              isSidebarCollapsed ? 'justify-center' : 'gap-2.5 text-left min-w-0 flex-1'
            } group cursor-pointer outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 border-none select-none [-webkit-tap-highlight-color:transparent]`}
            title="Về trang chủ"
          >
            {/* Apple-grade crisp circular 3D glass logo (44px) */}
            <div className="w-11 h-11 rounded-full overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-[0_4px_14px_rgba(250,196,38,0.38),0_1px_3px_rgba(0,0,0,0.06)] border-2 border-white dark:border-white/20 shrink-0 group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover rounded-full pointer-events-none" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1 flex flex-col justify-center select-none font-sans">
                <span className="font-extrabold text-[14px] leading-tight tracking-tight text-[#1d1d1f] dark:text-white whitespace-nowrap group-hover:text-[#FAC426] group-active:text-[#E5B01E] dark:group-hover:text-[#FAC426] transition-colors duration-150">
                  FARMERS MARKET
                </span>
                <span className="text-[9.5px] leading-tight font-bold text-[#0088FF] dark:text-[#0091FF] group-hover:text-[#FAC426] group-active:text-[#E5B01E] dark:group-hover:text-[#FAC426] transition-colors duration-150 tracking-wider uppercase mt-1 whitespace-nowrap">
                  FM WORKSPACE
                </span>
              </div>
            )}
          </button>

          {/* Apple Sidebar Toggle Toolbar Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:text-[#0088FF] dark:hover:text-[#0091FF] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer outline-none shrink-0"
            title={isSidebarCollapsed ? 'Mở rộng thanh bên (Ctrl+\\)' : 'Thu gọn thanh bên (Ctrl+\\)'}
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            <SFSidebarLeft size={16} className={`transition-transform duration-280 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation Items - Native macOS Sidebar Styling */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto select-none">
          {!isSidebarCollapsed && (
            <div className="px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#86868b] dark:text-[#a1a1a6]">
              Không gian làm việc
            </div>
          )}

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={isSidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isSidebarCollapsed ? 'justify-center w-10 h-10 aspect-square shrink-0 mx-auto px-0' : 'gap-3 px-3.5 py-2.5'
                } rounded-full text-[13px] transition-all duration-200 ease-out active:scale-[0.98] ${
                  isActive
                    ? 'bg-gradient-to-b from-[#0088FF] to-[#0071E3] text-white font-semibold border border-[#38a9ff]/40 shadow-[0_4px_16px_rgba(0,113,227,0.38),inset_0_1.5px_1px_rgba(255,255,255,0.45),inset_0_-1.5px_1.5px_rgba(0,0,0,0.18)] backdrop-blur-md'
                    : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`p-1 rounded-lg transition-colors shrink-0 ${
                      isActive ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]' : 'text-[#76767b] dark:text-[#8e8e93]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className={`truncate whitespace-nowrap ${isActive ? 'text-white font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]' : ''}`}>
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Bottom Controls */}
        <div className="p-3 border-t border-black/[0.06] dark:border-white/10 space-y-2 shrink-0 bg-white/40 dark:bg-[#1E1E1E]/40 backdrop-blur-xl">
          <button
            onClick={() => setImportModalOpen(true)}
            title={isSidebarCollapsed ? 'Import / Export Excel' : undefined}
            className={`flex items-center ${
              isSidebarCollapsed ? 'justify-center w-11 h-11 aspect-square shrink-0 mx-auto px-0' : 'w-full gap-3 px-4 py-2.5'
            } rounded-full text-[13px] font-medium text-[#0088FF] dark:text-[#0091FF] liquid-lens-pill hover:!bg-white/80 dark:hover:!bg-white/[0.14] transition-all duration-200 active:scale-[0.98] cursor-pointer`}
          >
            <SFTablecells size={16} className="shrink-0 text-[#0088FF] dark:text-[#0091FF]" />
            {!isSidebarCollapsed && <span>Import / Export Excel</span>}
          </button>

          {/* Privacy status pill */}
          <div
            className={`pt-1 px-2 flex items-center ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between'
            } text-[11px] text-[#7a7a7a]`}
          >
            <div className="flex items-center gap-1.5" title="IndexedDB Local - Dữ liệu bảo mật trên máy">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0088FF] dark:bg-[#0091FF] shadow-xs shadow-[#0088FF]/60 animate-pulse" />
              {!isSidebarCollapsed && <span className="text-[11px] font-normal">IndexedDB Local</span>}
            </div>
            {!isSidebarCollapsed && <span className="text-[10px] font-mono opacity-70">macOS 27 UI Kit</span>}
          </div>
        </div>
      </aside>

      {/* ─────────────────── Main Content Canvas ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 bg-[#f8f9fc] dark:bg-[#121216]">
        {/* Topbar: Translucent Liquid Glass Bar with continuous scroll-driven interpolation */}
        <header
          style={{
            backgroundColor:
              resolveTheme(theme) === 'dark'
                ? `rgba(22, 22, 28, ${0.68 + scrollRatio * 0.28})`
                : `rgba(255, 255, 255, ${0.72 + scrollRatio * 0.24})`,
            backdropFilter: `blur(${24 + scrollRatio * 20}px) saturate(${160 + scrollRatio * 35}%)`,
            WebkitBackdropFilter: `blur(${24 + scrollRatio * 20}px) saturate(${160 + scrollRatio * 35}%)`,
            borderBottomColor:
              resolveTheme(theme) === 'dark'
                ? `rgba(255, 255, 255, ${0.06 + scrollRatio * 0.08})`
                : `rgba(0, 0, 0, ${0.04 + scrollRatio * 0.06})`,
            boxShadow:
              scrollRatio > 0.02
                ? `0 4px 20px -2px rgba(0, 0, 0, ${resolveTheme(theme) === 'dark' ? 0.28 * scrollRatio : 0.06 * scrollRatio}), inset 0 -0.5px 0 rgba(255, 255, 255, 0.1)`
                : 'none',
          }}
          className="h-16 shrink-0 px-4 sm:px-6 border-b flex items-center justify-between z-20 transition-[background-color,border-color,box-shadow] duration-160 ease-out"
        >
          <div className="flex items-center gap-3.5">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-full text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Mở menu"
              aria-label="Mở menu điều hướng"
            >
              <SFLine3Horizontal size={20} />
            </button>

            {/* Mobile Circular Logo */}
            <button
              type="button"
              onClick={handleLogoClick}
              className="md:hidden w-10 h-10 rounded-full overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border-2 border-white/80 dark:border-white/20 shrink-0 active:scale-95 transition-transform cursor-pointer focus:outline-none"
              title="Về trang chủ"
            >
              <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover rounded-full" />
            </button>

            <div className="flex items-center gap-2 font-sans">
              <h2 className="text-[16px] font-bold text-[#1d1d1f] dark:text-white tracking-tight">
                {pageTitle}
              </h2>
            </div>
          </div>

          {/* Right Floating Controls */}
          <div className="flex items-center gap-2.5">
            {/* Global Search Capsule (Spotlight pill) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="liquid-lens-pill group relative flex items-center gap-2.5 px-3.5 py-2 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white text-[13px] w-44 md:w-52 lg:w-64 active:scale-[0.98] cursor-pointer"
              aria-label="Tìm kiếm nhanh (Ctrl+K)"
            >
              <div className="w-5 h-5 rounded-full bg-[#0088FF]/15 dark:bg-[#0091FF]/20 flex items-center justify-center text-[#0088FF] dark:text-[#0091FF] group-hover:scale-110 transition-transform">
                <SFMagnifyingglass size={14} />
              </div>
              <span className="flex-1 text-left truncate font-normal text-[12.5px] opacity-90 group-hover:opacity-100">
                Tìm nhanh link, CH, tài khoản...
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-md bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[#76767b] dark:text-[#a1a1a6] shadow-2xs group-hover:border-[#0088FF]/30 transition-colors">
                Ctrl + K
              </kbd>
            </button>

            {/* Quick Import Button */}
            <Button
              variant="liquiGlass"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="hidden sm:inline-flex"
              icon={<SFTablecells size={14} className="text-[#0066cc] dark:text-[#2997ff]" />}
            >
              Import Excel
            </Button>

            {/* Quick Note Button — Liquid Lens Circle */}
            <button
              onClick={() => openNote()}
              className="liquid-lens-circle w-10 h-10 group relative"
              title="Notes (Alt + N hoặc Ctrl + J)"
              aria-label="Mở Notes"
            >
              <SFSquareAndPencil size={16} className="text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform duration-200" />
              {notes.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 text-[9.5px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center shadow-xs border border-white dark:border-zinc-900 pointer-events-none">
                  {notes.length}
                </span>
              )}
            </button>

            {/* Theme Toggle — 3D Liquid Lens Circle Button (Clean light/dark toggle) */}
            <button
              onClick={() => {
                const currentResolved = resolveTheme(theme);
                setTheme(currentResolved === 'dark' ? 'light' : 'dark');
              }}
              className="liquid-lens-circle w-10 h-10 group cursor-pointer"
              title={
                resolveTheme(theme) === 'dark'
                  ? 'Chế độ Tối — Nhấp để đổi sang Sáng'
                  : 'Chế độ Sáng — Nhấp để đổi sang Tối'
              }
              aria-label="Chuyển chế độ giao diện Sáng / Tối"
              aria-pressed={resolveTheme(theme) === 'dark'}
            >
              {resolveTheme(theme) === 'dark' ? (
                <SFSunMaxFill size={16} className="text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <SFMoonFill size={16} className="text-[#0066cc] filter drop-shadow-[0_0_8px_rgba(0,102,204,0.5)] group-hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main ref={mainRef} className="flex-1 p-4 sm:p-5 lg:p-6 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div key={location.pathname} className="page-glide-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ─────────────────── Mobile Drawer Menu ─────────────────── */}
      {mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] md:hidden">
            <div
              className="fixed inset-0 bg-black/45 backdrop-blur-md transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 vision-glass-sidebar shadow-2xl p-5 flex flex-col z-10 animate-in slide-in-from-left duration-250 ease-out border-r border-[#e0e0e0] dark:border-white/10">
              <div className="flex items-center justify-between pb-4 border-b border-[#e0e0e0] dark:border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleLogoClick(e);
                  }}
                  className="flex items-center gap-2.5 text-left cursor-pointer group focus:outline-none select-none"
                  title="Về trang chủ"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-md border-2 border-white/80 dark:border-white/20 shrink-0 group-hover:scale-105 group-active:scale-95 transition-all duration-200">
                    <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover rounded-full" />
                  </div>
                  <span className="font-bold text-[15px] text-[#1d1d1f] dark:text-white group-hover:text-[#FAC426] group-active:text-[#E5B01E] dark:group-hover:text-[#FAC426] transition-colors">
                    FARMERS MARKET
                  </span>
                </button>
                <CloseButton
                  onClick={() => setMobileMenuOpen(false)}
                  size="md"
                  label="Đóng menu"
                  title="Đóng menu"
                />
              </div>

              <nav className="mt-4 space-y-1.5 flex-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[14px] transition-all duration-200 ${
                        isActive
                          ? 'bg-[#0071e3]/12 dark:bg-[#0071e3]/24 text-[#0071e3] dark:text-[#3898ff] font-semibold border border-[#0071e3]/25 dark:border-[#0071e3]/35 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(0,113,227,0.1),0_2px_8px_rgba(0,113,227,0.08)] backdrop-blur-sm'
                          : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium border border-transparent'
                      }`
                    }
                  >
                    <span className="p-1 rounded-lg transition-colors shrink-0">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 space-y-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setImportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff]"
                >
                  <SFTablecells size={16} />
                  <span>Import / Export Excel</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenImportModal={() => setImportModalOpen(true)}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false);
          window.location.reload();
        }}
      />

      {/* Quick Note Floating Capsule & Interactive Window */}
      <QuickNoteWindow />
      <QuickNoteFloatingButton />
    </div>
  );
};