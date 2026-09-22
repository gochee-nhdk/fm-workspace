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
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { CommandPalette } from '@/components/ui/command-palette';
import { ExcelImportModal } from '@/components/excel/ExcelImportModal';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', label: 'Bàn làm việc', icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: '/links', label: 'Quick Links', icon: <LinkIcon className="w-4 h-4" /> },
  { to: '/accounts', label: 'Account Vault', icon: <Shield className="w-4 h-4" /> },
  { to: '/stores', label: 'Danh mục Cửa Hàng', icon: <Store className="w-4 h-4" /> },
  { to: '/data-manager', label: 'Quản lý Dữ liệu', icon: <Database className="w-4 h-4" /> },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bàn làm việc',
  '/links': 'Quick Links',
  '/accounts': 'Account Vault',
  '/stores': 'Danh sách Cửa Hàng',
  '/data-manager': 'Trung tâm Dữ liệu & Excel',
  '/settings': 'Cài đặt Workspace',
};

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { theme, toggleTheme } = useUiStore();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // ✅ Global Ctrl+K / ⌘K listener — opens command palette from any page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
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
      <aside className="hidden md:flex flex-col w-64 vision-glass-sidebar shrink-0 h-full select-none z-30 transition-all duration-300">
        {/* Workspace Brand Header */}
        <div className="p-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-3 text-left w-full group cursor-pointer focus:outline-none select-none"
            title="Nhấn để về trang chủ"
          >
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border border-black/5 dark:border-white/20 shrink-0 group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-semibold text-[15px] tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-1.5 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
                FARMERS MARKET
              </div>
              <span className="text-[11px] text-[#0066cc] dark:text-[#2997ff] font-medium tracking-wide uppercase">
                FM Workspace OS
              </span>
            </div>
          </button>
        </div>

        {/* Navigation Items with Apple Vision Active Indicator */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          <div className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#76767b] dark:text-[#98989d]">
            Không gian làm việc
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13.5px] transition-all duration-200 ease-apple-spring active:scale-[0.98] ${
                  isActive
                    ? 'liquid-lens-pill !bg-[#0071e3] !border-[#2997ff]/40 text-white font-semibold !shadow-[0_4px_16px_rgba(0,113,227,0.4),inset_0_1.5px_1px_rgba(255,255,255,0.7)]'
                    : 'text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[#1d1d1f] dark:hover:text-white hover:translate-x-0.5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`p-1 rounded-lg transition-colors ${
                      isActive ? 'text-white' : 'text-[#76767b] dark:text-[#a1a1a6]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate whitespace-nowrap font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Bottom Controls */}
        <div className="p-3 border-t border-black/[0.06] dark:border-white/10 space-y-2 shrink-0 bg-white/30 dark:bg-black/30 backdrop-blur-xl">
          <button
            onClick={() => setImportModalOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13px] font-medium text-[#0066cc] dark:text-[#2997ff] bg-[#0066cc]/10 dark:bg-[#2997ff]/15 hover:bg-[#0066cc]/20 border border-[#0066cc]/20 dark:border-[#2997ff]/30 shadow-2xs transition-all duration-180 active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0 text-[#0066cc] dark:text-[#2997ff]" />
            <span>Import / Export Excel</span>
          </button>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13px] transition-all duration-180 active:scale-[0.98] ${
                isActive
                  ? 'liquid-lens-pill font-medium !shadow-xs'
                  : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`
            }
          >
            <Settings className="w-4 h-4 text-[#7a7a7a] shrink-0" />
            <span>Cài đặt & Dữ liệu</span>
          </NavLink>

          {/* Privacy status pill */}
          <div className="pt-1.5 px-3 flex items-center justify-between text-[11px] text-[#7a7a7a]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0071e3] shadow-xs shadow-[#0071e3]/60 animate-pulse" />
              <span className="text-[11px] font-normal">IndexedDB Local</span>
            </div>
            <span className="text-[10px] font-mono opacity-70">Liquid 3D v2.0</span>
          </div>
        </div>
      </aside>

      {/* ─────────────────── Main Content Canvas ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Topbar: visionOS Frosted Floating Glass Bar */}
        <header className="h-16 shrink-0 px-4 sm:px-6 bg-white/50 dark:bg-[#121216]/50 backdrop-blur-3xl border-b border-black/[0.05] dark:border-white/10 flex items-center justify-between z-20 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-full text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Mở menu"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleLogoClick}
              className="md:hidden w-8 h-8 rounded-lg overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border border-black/5 dark:border-white/20 shrink-0 active:scale-95 transition-transform cursor-pointer focus:outline-none"
              title="Về trang chủ"
            >
              <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover" />
            </button>

            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
                {pageTitle}
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-[#0071e3]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff] border border-[#0071e3]/20">
                <Sparkles className="w-3 h-3" />
                <span>Liquid 3D</span>
              </span>
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
        <main ref={mainRef} className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden scroll-smooth pb-28">
          <div key={location.pathname} className="page-glide-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ─────────────────── Authentic 3D Liquid Glass Floating Bottom Dock (Directly from Image 1!) ─────────────────── */}
      <aside
        aria-label="Thanh công cụ kính lỏng 3D"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3.5 pointer-events-auto ios-animate-in select-none"
      >
        {/* Left Floating Pill Bar with Liquid Meniscus Refraction */}
        <div className="liquid-lens-pill px-3 py-1.5 flex items-center gap-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.08)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to === '/' && location.pathname === '');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={item.label}
                aria-label={item.label}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ease-apple-spring active:scale-90 ${
                  isActive
                    ? 'bg-gradient-to-b from-[#0077ed] to-[#0066cc] text-white shadow-[0_2px_10px_rgba(0,102,204,0.45),inset_0_1px_1px_rgba(255,255,255,0.7)] scale-105'
                    : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {item.icon}
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                )}
              </NavLink>
            );
          })}

          <div className="w-[1px] h-5 bg-black/10 dark:bg-white/15 mx-1" />

          {/* Quick Excel Action */}
          <button
            onClick={() => setImportModalOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0066cc]/10 dark:hover:bg-[#2997ff]/15 transition-all active:scale-90"
            title="Import / Export Excel"
            aria-label="Import / Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>

        {/* Right Floating Circular 3D Liquid Lens Button (Image 1 Circular Compose Button) */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="liquid-lens-circle w-[52px] h-[52px] shadow-[0_18px_40px_-6px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.1)] text-[#1d1d1f] dark:text-white"
          title="Tìm kiếm nhanh & Lệnh tác nghiệp (Ctrl+K)"
          aria-label="Mở tìm kiếm nhanh"
        >
          <Search className="w-5 h-5 text-[#0071e3] dark:text-[#2997ff] filter drop-shadow-[0_0_6px_rgba(0,113,227,0.4)]" />
        </button>
      </aside>

      {/* ─────────────────── Mobile Drawer Menu ─────────────────── */}
      {mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] md:hidden">
            <div
              className="fixed inset-0 bg-black/45 backdrop-blur-md transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 vision-glass-sidebar shadow-2xl p-5 flex flex-col z-10 animate-in slide-in-from-left duration-250 ease-apple-spring border-r border-[#e0e0e0] dark:border-white/10">
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
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border border-black/5 dark:border-white/20 shrink-0 group-hover:scale-105 group-active:scale-95 transition-all duration-200">
                    <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover" />
                  </div>
                  <span className="font-semibold text-[15px] text-[#1d1d1f] dark:text-white group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
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

                <NavLink
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-full text-[13px] font-normal text-[#7a7a7a] hover:bg-black/5"
                >
                  <Settings className="w-4 h-4" />
                  <span>Cài đặt Workspace</span>
                </NavLink>
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