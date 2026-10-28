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
  SFArrowDownDocument,
  SFMoonFill,
  SFSunMaxFill,
  SFSidebarLeft,
  SFSquareAndPencil,
} from '@/components/ui/AppleIcon';
import { CommandPalette } from '@/components/ui/command-palette';
import { SFLink, SFShieldFill, SFStorefront } from 'sf-symbols-lib';
import { ExcelImportModal } from '@/components/excel/ExcelImportModal';
import { QuickNoteFloatingButton } from '@/components/notes/QuickNoteFloatingButton';

const QuickNoteWindow = React.lazy(() =>
  import('@/components/notes/QuickNoteWindow').then((m) => ({ default: m.QuickNoteWindow }))
);
import { useUiStore, resolveTheme } from '@/stores/ui-store';
import { useNoteStore } from '@/stores/note-store';
import { Button } from '@/components/ui/button';
import { CloseButton } from '@/components/ui/close-button';
import { reminderService } from '@/services/reminderService';
import { useTabIndicator, useAppleTabSpring } from '@/lib/motion';
import { useSecurityStore } from '@/stores/security-store';
import { LocalLockScreen } from '@/components/security/LocalLockScreen';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const saved = localStorage.getItem('fm_sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    if (typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024) {
      return true;
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('fm_sidebar_collapsed', String(next));
      return next;
    });
  };

  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  const openNote = useNoteStore((state) => state.openNote);
  const toggleNote = useNoteStore((state) => state.toggleNote);
  // Count only text notes (excluding To-do checklists) to stay 100% consistent with QuickNoteFloatingButton badge
  const notesCount = useNoteStore((state) =>
    state.notes.reduce((acc, n) => (n.noteType !== 'checklist' ? acc + 1 : acc), 0)
  );

  const isLockEnabled = useSecurityStore((state) => state.isLockEnabled);
  const lockNow = useSecurityStore((state) => state.lockNow);
  const recordActivity = useSecurityStore((state) => state.recordActivity);
  const checkAutoLock = useSecurityStore((state) => state.checkAutoLock);

  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrolled = el.scrollTop > 12;
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Security: Activity monitor for auto-lock (throttled to save CPU & battery)
  useEffect(() => {
    let lastHandled = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastHandled > 15_000) {
        lastHandled = now;
        recordActivity();
      }
    };
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });

    const interval = setInterval(() => {
      checkAutoLock();
    }, 15000); // Check auto-lock every 15s

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [recordActivity, checkAutoLock]);

  const activeTabKey = location.pathname.startsWith('/settings') ? '/settings' : '/';
  const sidebarTrackRef = useRef<HTMLDivElement>(null);
  const sidebarPillRef = useRef<HTMLDivElement>(null);

  useAppleTabSpring(sidebarTrackRef, sidebarPillRef, activeTabKey, {
    stiffness: 440,
    damping: 26,
    mass: 0.65,
    allowDeformation: true,
    orientation: 'vertical',
  });

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
      {/* ─────────────────── Zero-GPU Ambient Canvas Mesh (120fps) ─────────────────── */}
      <div className="ambient-canvas-mesh" />

      {/* ─────────────────── visionOS Desktop Sidebar (Image 2) ─────────────────── */}
      <aside
        className={`hidden md:flex flex-col ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-[268px]'
        } vision-glass-sidebar shrink-0 h-full select-none z-30 transition-[width] duration-[var(--motion-duration-sidebar)] ease-[var(--motion-ease-spring)] relative overflow-hidden will-change-[width]`}
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

        {/* Navigation Items - Native macOS Sidebar Styling with fluid sliding active indicator */}
        <nav className="p-3 space-y-2 flex-1 overflow-y-auto select-none">
          {!isSidebarCollapsed && (
            <div className="px-3.5 py-1 text-[11px] font-bold uppercase tracking-tight text-[#86868b] dark:text-[#a1a1a6]">
              Không gian làm việc
            </div>
          )}

          {/* Dedicated Tab Track Container with Apple Spring Sliding Pill */}
          <div ref={sidebarTrackRef} className="relative flex flex-col gap-1.5">
            {/* Fluid Apple Spring Sliding Indicator for Sidebar Tabs */}
            <div
              ref={sidebarPillRef}
              data-layout-id="active-sidebar-pill"
              aria-hidden="true"
              className={`absolute top-0 inset-x-0 mx-auto fm-primary-pill-surface rounded-full pointer-events-none z-0 will-change-transform ${
                isSidebarCollapsed ? 'w-10' : 'w-full'
              }`}
              style={{ opacity: 0 }}
            />

            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                data-tab-id={item.to}
                title={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `relative z-10 flex items-center ${
                    isSidebarCollapsed ? 'justify-center w-10 h-10 aspect-square shrink-0 mx-auto px-0' : 'gap-3 px-3.5 h-10'
                  } rounded-full text-[13px] transition-colors duration-120 active:scale-[0.98] select-none ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium'
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
          </div>
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
            <div className="flex items-center gap-1.5" title="Đã kết nối trực tuyến qua https://fm-workspace.vercel.app">
              <span className="w-2 rounded-full aspect-square bg-emerald-500 shadow-xs shadow-emerald-500/60 animate-pulse" />
              {!isSidebarCollapsed && <span className="text-[11px] font-medium text-[#7a7a7a]">Trực tuyến (Cloud / Sync)</span>}
            </div>
          </div>
        </div>
      </aside>

      {/* ─────────────────── Main Content Canvas ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 bg-[#f8f9fc] dark:bg-[#121216]">
        {/* Topbar: Hardware-Accelerated Translucent Liquid Glass Bar with Safe-Area Awareness */}
        <header
          className={cn(
            "min-h-[calc(3.75rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] shrink-0 px-3 sm:px-6 border-b flex items-center justify-between z-20 transition-[background-color,border-color,box-shadow] duration-200 ease-out",
            isScrolled
              ? "bg-white/85 dark:bg-[#16161c]/85 backdrop-blur-2xl border-black/[0.08] dark:border-white/10 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06),inset_0_-0.5px_0_rgba(255,255,255,0.1)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35),inset_0_-0.5px_0_rgba(255,255,255,0.05)]"
              : "bg-white/60 dark:bg-[#16161c]/60 backdrop-blur-xl border-black/[0.04] dark:border-white/[0.06]"
          )}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Mở menu"
              aria-label="Mở menu điều hướng"
            >
              <SFLine3Horizontal size={20} />
            </button>

            {/* Mobile Circular Logo */}
            <button
              type="button"
              onClick={handleLogoClick}
              className="md:hidden w-8 h-8 rounded-full overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border border-white/80 dark:border-white/20 shrink-0 active:scale-95 transition-transform cursor-pointer focus:outline-none"
              title="Về trang chủ"
            >
              <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover rounded-full" />
            </button>

            <div className="flex items-center gap-2 font-sans truncate min-w-0">
              <h2 className="text-[14px] sm:text-[16px] font-bold text-[#1d1d1f] dark:text-white tracking-tight truncate">
                {pageTitle}
              </h2>
            </div>
          </div>

          {/* Right Floating Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Global Search Capsule (Spotlight pill - Icon on mobile, capsule on desktop) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="liquid-lens-pill group relative flex items-center justify-center sm:justify-start gap-2 w-9 h-9 sm:w-44 md:w-52 lg:w-64 sm:h-9 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white text-[13px] active:scale-[0.98] cursor-pointer"
              aria-label="Tìm kiếm nhanh (Ctrl+K)"
              title="Tìm kiếm nhanh (Ctrl+K)"
            >
              <div className="w-5 h-5 rounded-full bg-[#0088FF]/15 dark:bg-[#0091FF]/20 flex items-center justify-center text-[#0088FF] dark:text-[#0091FF] group-hover:scale-110 transition-transform shrink-0">
                <SFMagnifyingglass size={14} />
              </div>
              <span className="hidden sm:inline-block flex-1 text-left truncate font-normal text-[12.5px] opacity-90 group-hover:opacity-100">
                Tìm nhanh link, CH...
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
              icon={<SFArrowDownDocument size={14} className="text-emerald-600 dark:text-emerald-400" />}
              title="Nhập file Excel vào hệ thống"
            >
              Nhập
            </Button>

            {/* Local Privacy Lock Button (When PIN lock enabled) */}
            {isLockEnabled && (
              <button
                onClick={() => lockNow()}
                className="liquid-lens-circle w-9 h-9 sm:w-10 sm:h-10 group cursor-pointer"
                title="Khóa bảo vệ màn hình ngay"
                aria-label="Khóa màn hình làm việc"
              >
                <Lock size={15} className="text-[#0071e3] dark:text-[#2997ff] group-hover:scale-110 transition-transform duration-200" />
              </button>
            )}

            {/* Quick Note Button — Chỉ hiển thị trên Desktop (Mobile đã có nút tròn nổi) */}
            <button
              onClick={() => openNote()}
              className="hidden sm:flex liquid-lens-circle w-10 h-10 group relative"
              title="Notes (Alt + N hoặc Ctrl + J)"
              aria-label="Mở Notes"
            >
              <SFSquareAndPencil size={16} className="text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform duration-200" />
              {notesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 text-[9.5px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center shadow-xs border border-white dark:border-zinc-900 pointer-events-none">
                  {notesCount}
                </span>
              )}
            </button>

            {/* Theme Toggle — 3D Liquid Lens Circle Button (Clean light/dark toggle) */}
            <button
              onClick={() => {
                const currentResolved = resolveTheme(theme);
                setTheme(currentResolved === 'dark' ? 'light' : 'dark');
              }}
              className="liquid-lens-circle w-9 h-9 sm:w-10 sm:h-10 group cursor-pointer"
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
              className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-[295px] max-w-[85vw] pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-4 bg-white/95 dark:bg-[#181822]/95 backdrop-blur-3xl shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250 ease-out border-r border-black/[0.08] dark:border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] dark:border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleLogoClick(e);
                  }}
                  className="flex items-center gap-2.5 text-left cursor-pointer group focus:outline-none select-none min-w-0"
                  title="Về trang chủ"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border-2 border-white/80 dark:border-white/20 shrink-0">
                    <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover rounded-full" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="font-extrabold text-[14px] leading-tight text-[#1d1d1f] dark:text-white truncate">
                      FARMERS MARKET
                    </span>
                    <span className="text-[9.5px] font-bold text-[#0088FF] dark:text-[#0091FF] tracking-wider uppercase mt-0.5">
                      FM WORKSPACE
                    </span>
                  </div>
                </button>
                <CloseButton
                  onClick={() => setMobileMenuOpen(false)}
                  size="sm"
                  label="Đóng menu"
                  title="Đóng menu"
                />
              </div>

              {/* Navigation Links */}
              <div className="mt-4 space-y-4 flex-1 overflow-y-auto scrollbar-none">
                <div>
                  <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b] dark:text-[#a1a1a6]">
                    Trang chính
                  </div>
                  <nav className="space-y-1">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13.5px] transition-all duration-200 ${
                            isActive
                              ? 'bg-[#0071e3]/12 dark:bg-[#0071e3]/24 text-[#0071e3] dark:text-[#3898ff] font-semibold border border-[#0071e3]/25 dark:border-[#0071e3]/35 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(0,113,227,0.1),0_2px_8px_rgba(0,113,227,0.08)] backdrop-blur-sm'
                              : 'text-[#2c2c2e] dark:text-[#e5e5ea] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium border border-transparent'
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
                </div>

                {/* Quick Shortcuts Section */}
                <div>
                  <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b] dark:text-[#a1a1a6]">
                    Lối tắt bảng làm việc
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/?tab=links');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-[13px] text-[#48484a] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <SFLink size={14} />
                      </span>
                      <span>Quick Links (Liên kết)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/?tab=accounts');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-[13px] text-[#48484a] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                        <SFShieldFill size={14} />
                      </span>
                      <span>Account Vault (Tài khoản)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/?tab=stores');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-[13px] text-[#48484a] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <SFStorefront size={14} />
                      </span>
                      <span>Store Directory (Cửa hàng)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openNote();
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-[13px] text-[#48484a] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <SFSquareAndPencil size={14} />
                      </span>
                      <span>Ghi chú nhanh &amp; To-do</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 space-y-2.5 shrink-0">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setImportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium bg-[#0066cc]/10 dark:bg-[#0066cc]/20 text-[#0066cc] dark:text-[#2997ff] active:scale-[0.98] transition-transform"
                >
                  <SFTablecells size={16} />
                  <span>Import / Export Excel</span>
                </button>

                <div className="flex items-center justify-between px-2 text-[11px] text-[#7a7a7a]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/60 animate-pulse" />
                    <span className="font-medium text-[#7a7a7a]">Trực tuyến (Cloud / Sync)</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#999]">v1.0</span>
                </div>
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

      {/* Quick Note Floating Capsule & Interactive Window (120fps Lazy-loaded) */}
      <React.Suspense fallback={null}>
        <QuickNoteWindow />
      </React.Suspense>
      <QuickNoteFloatingButton />

      {/* Local Privacy Screen Shield */}
      <LocalLockScreen />
    </div>
  );
};
