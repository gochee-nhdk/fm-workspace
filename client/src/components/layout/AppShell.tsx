import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Link as LinkIcon,
  Shield,
  Store,
  Database,
  Settings,
  Search,
  Menu,
  X,
  FileSpreadsheet,
  Moon,
  Sun,
  Command,
  Plus,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { CommandPalette } from '@/components/ui/command-palette';
import { ExcelImportModal } from '@/components/excel/ExcelImportModal';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', label: 'Bàn làm việc chính', icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: '/settings', label: 'Cài đặt & Dữ liệu', icon: <Settings className="w-4 h-4" /> },
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

  const { theme, toggleTheme } = useUiStore();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

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

  // ✅ Global Ctrl+K / ⌘K and Ctrl+\ listeners
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
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ✅ Listen for fm:open-import event dispatched from any child page
  useEffect(() => {
    const handleOpenImport = () => setImportModalOpen(true);
    window.addEventListener('fm:open-import', handleOpenImport);
    return () => window.removeEventListener('fm:open-import', handleOpenImport);
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
        } vision-glass-sidebar shrink-0 h-full select-none z-30 transition-all duration-300 relative`}
      >
        {/* Workspace Brand Header */}
        <div
          className={`border-b border-black/[0.06] dark:border-white/10 flex items-center ${
            isSidebarCollapsed
              ? 'py-3.5 px-2 flex-col gap-2.5 justify-center'
              : 'h-[74px] px-3.5 justify-between gap-2.5'
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
            {/* Apple-grade crisp circular 3D glass logo (48px) */}
            <div className="w-12 h-12 rounded-full overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-[0_4px_14px_rgba(250,196,38,0.38),0_1px_3px_rgba(0,0,0,0.06)] border-2 border-white dark:border-white/20 shrink-0 group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover rounded-full pointer-events-none" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1 flex flex-col justify-center select-none">
                <span className="font-extrabold text-[14.5px] leading-tight tracking-tight text-[#1d1d1f] dark:text-white whitespace-nowrap group-hover:text-[#FAC426] group-active:text-[#E5B01E] dark:group-hover:text-[#FAC426] transition-colors duration-150">
                  FARMERS MARKET
                </span>
                <span className="text-[10px] leading-tight font-bold text-[#007aff] dark:text-[#2997ff] group-hover:text-[#FAC426] group-active:text-[#E5B01E] dark:group-hover:text-[#FAC426] transition-colors duration-150 tracking-wider uppercase mt-1 whitespace-nowrap">
                  FM WORKSPACE OS
                </span>
              </div>
            )}
          </button>

          {/* Authentic Apple Liquid Glass Circular Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="liquid-lens-circle !w-8 !h-8 text-[#555558] hover:text-[#007aff] dark:text-[#a1a1a6] dark:hover:text-[#2997ff] shrink-0 outline-none focus:outline-none"
            title={isSidebarCollapsed ? 'Mở rộng thanh bên (Ctrl+\\)' : 'Thu gọn thanh bên (Ctrl+\\)'}
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 stroke-[1.8]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 stroke-[1.8]" />
            )}
          </button>
        </div>

        {/* Navigation Items with Fluid Active Indicator */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {!isSidebarCollapsed && (
            <div className="px-3.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#86868b] dark:text-[#98989d]">
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
                  isSidebarCollapsed ? 'justify-center w-11 h-11 mx-auto px-0' : 'gap-3 px-3.5 py-2.5'
                } rounded-full text-[13.5px] transition-all duration-200 ease-out active:scale-[0.98] ${
                  isActive
                    ? 'bg-gradient-to-b from-[#007aff] to-[#0062cc] text-white font-semibold shadow-[0_6px_20px_rgba(0,122,255,0.4),inset_0_1.5px_1px_rgba(255,255,255,0.65),inset_0_-1px_1.5px_rgba(0,0,0,0.2)] border border-white/30 backdrop-blur-xl'
                    : 'text-[#555558] dark:text-[#a1a1a6] hover:bg-white/60 dark:hover:bg-white/[0.08] hover:text-[#1d1d1f] dark:hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-md'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`p-1 rounded-lg transition-colors shrink-0 ${
                      isActive ? 'text-white' : 'text-[#76767b] dark:text-[#a1a1a6]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className="truncate whitespace-nowrap font-medium">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Bottom Controls */}
        <div className="p-3 border-t border-black/[0.06] dark:border-white/10 space-y-2 shrink-0 bg-white/30 dark:bg-black/30 backdrop-blur-xl">
          <button
            onClick={() => setImportModalOpen(true)}
            title={isSidebarCollapsed ? 'Import / Export Excel' : undefined}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? 'justify-center w-11 h-11 mx-auto px-0' : 'gap-3 px-4 py-2.5'
            } rounded-full text-[13px] font-medium text-[#0066cc] dark:text-[#2997ff] liquid-lens-pill hover:!bg-white/80 dark:hover:!bg-white/[0.14] transition-all duration-200 active:scale-[0.98] cursor-pointer`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0 text-[#0066cc] dark:text-[#2997ff]" />
            {!isSidebarCollapsed && <span>Import / Export Excel</span>}
          </button>

          {/* Privacy status pill */}
          <div
            className={`pt-1 px-2 flex items-center ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between'
            } text-[11px] text-[#7a7a7a]`}
          >
            <div className="flex items-center gap-1.5" title="IndexedDB Local - Dữ liệu bảo mật trên máy">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0071e3] shadow-xs shadow-[#0071e3]/60 animate-pulse" />
              {!isSidebarCollapsed && <span className="text-[11px] font-normal">IndexedDB Local</span>}
            </div>
            {!isSidebarCollapsed && <span className="text-[10px] font-mono opacity-70">Liquid 3D v2.0</span>}
          </div>
        </div>
      </aside>

      {/* ─────────────────── Main Content Canvas ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Topbar: Translucent Liquid Glass Bar */}
        <header className="h-16 shrink-0 px-4 sm:px-6 bg-white/35 dark:bg-[#0e0e12]/45 backdrop-blur-3xl border-b border-white/60 dark:border-white/10 flex items-center justify-between z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3.5">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-full text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Mở menu"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
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

            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
                {pageTitle}
              </h2>
            </div>
          </div>

          {/* Right Floating Controls */}
          <div className="flex items-center gap-2.5">
            {/* Global Search Capsule (Spotlight pill) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="liquid-lens-pill group relative flex items-center gap-2.5 px-4 py-2 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white text-[13px] w-48 sm:w-72 active:scale-[0.98] cursor-pointer"
              aria-label="Tìm kiếm nhanh (Ctrl+K)"
            >
              <div className="w-5 h-5 rounded-full bg-[#0071e3]/15 dark:bg-[#2997ff]/20 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] group-hover:scale-110 transition-transform">
                <Search className="w-3 h-3" />
              </div>
              <span className="flex-1 text-left truncate font-normal text-[12.5px] opacity-90 group-hover:opacity-100">
                Tìm nhanh link, CH, tài khoản...
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-md bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[#76767b] dark:text-[#a1a1a6] shadow-2xs group-hover:border-[#0071e3]/30 transition-colors">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </button>

            {/* Quick Import Button */}
            <Button
              variant="liquiGlass"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="hidden sm:inline-flex"
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-[#0066cc] dark:text-[#2997ff]" />}
            >
              Import Excel
            </Button>

            {/* Theme Toggle — 3D Liquid Lens Circle Button (Image 1 style) */}
            <button
              onClick={toggleTheme}
              className="liquid-lens-circle w-10 h-10 group"
              title={
                theme === 'dark'
                  ? 'Đang bật Chế độ Tối — Nhấp để đổi sang Sáng'
                  : 'Đang bật Chế độ Sáng — Nhấp để đổi sang Tối'
              }
              aria-label="Chuyển chế độ giao diện"
              aria-pressed={theme === 'dark'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-[#0066cc] filter drop-shadow-[0_0_8px_rgba(0,102,204,0.5)] group-hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main ref={mainRef} className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden scroll-smooth">
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
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full text-[#7a7a7a] hover:bg-black/5 cursor-pointer"
                  aria-label="Đóng menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1.5 flex-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#0071e3] text-white font-medium shadow-xs'
                          : 'text-[#7a7a7a] hover:text-[#1d1d1f] hover:bg-black/5'
                      }`
                    }
                  >
                    {item.icon}
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
                  <FileSpreadsheet className="w-4 h-4" />
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
    </div>
  );
};