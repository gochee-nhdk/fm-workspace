import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  SFMagnifyingglass,
  SFArrowUpRightSquare,
  SFLink,
  SFShieldFill,
  SFStorefront,
  SFSquareGrid2x2,
  SFGearshapeFill,
  SFCylinder,
  SFArrowRight,
  SFSparkles,
  SFXmark,
  SFTablecells,
  SFMoonFill,
  SFSunMaxFill,
  SFReturn,
  SFBoltFill,
  SFClock,
  SFLocationFill,
  SFSquareStack3dUp,
  SFSquareAndPencil,
} from 'sf-symbols-lib';
import { dataService } from '@/services/dataService';
import { LinkItem, AccountItem, StoreItem } from '@/types/workspace';
import { useUiStore } from '@/stores/ui-store';
import { useNoteStore } from '@/stores/note-store';
import { cn } from '@/lib/utils';
import { CloseButton } from '@/components/ui/close-button';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImportModal?: () => void;
}

type FilterCategory = 'all' | 'link' | 'account' | 'store' | 'action' | 'nav';

// Helper component for highlighting matching search text
const HighlightedText: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className = '',
}) => {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) {
    return <span className={className}>{text}</span>;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <span className={className}>
      {before}
      <mark className="bg-[#0071e3]/15 dark:bg-[#2997ff]/25 text-[#0066cc] dark:text-[#2997ff] font-semibold px-0.5 rounded">
        {match}
      </mark>
      {after}
    </span>
  );
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenImportModal,
}) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [catIndicator, setCatIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useUiStore();

  const handleItemMouseEnter = (idx: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setSelectedIndex(idx);
  };

  const handleItemMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setSelectedIndex(-1);
      hoverTimeoutRef.current = null;
    }, 40);
  };

  const resetSelectionImmediate = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setSelectedIndex(-1);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle open & smooth MacBook closing transition lifecycle
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setIsMounted(true);
      setIsClosing(false);
      setQuery('');
      setActiveCategory('all');
      setSelectedIndex(-1);
      dataService.getLinks().then(setLinks).catch(() => {});
      dataService.getAccounts().then(setAccounts).catch(() => {});
      dataService.getStores().then(setStores).catch(() => {});

      try {
        const saved = JSON.parse(localStorage.getItem('fm_spotlight_recent') || '[]');
        if (Array.isArray(saved)) {
          setRecentSearches(saved);
        }
      } catch {
        setRecentSearches([]);
      }

      setTimeout(() => {
        inputRef.current?.focus();
        listRef.current?.scrollTo({ top: 0 });
      }, 50);
    } else if (isMounted && !isClosing) {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
      }, 160);
    }

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
      setIsMounted(false);
    }, 160);
  };

  // Reset scroll and selection whenever query or category changes
  useEffect(() => {
    setSelectedIndex(-1);
    listRef.current?.scrollTo({ top: 0 });
  }, [query, activeCategory]);

  const saveRecentTerm = (term: string) => {
    if (!term || term.trim().length < 2) return;
    try {
      const clean = term.trim();
      const updated = [clean, ...recentSearches.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('fm_spotlight_recent', JSON.stringify(updated));
    } catch {}
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('fm_spotlight_recent');
    } catch {}
  };

  // Static navigation routes with individual color tokens
  const navItems = useMemo(
    () => [
      {
        type: 'nav' as const,
        id: 'nav-dash',
        label: 'Bàn làm việc (Dashboard)',
        sub: 'Trang chủ tổng quan chỉ số và phím tắt nhanh',
        path: '/',
        tag: 'Dashboard',
        icon: <SFSquareGrid2x2 size={16} />,
        iconBg: 'bg-blue-500/12 dark:bg-blue-500/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
      },
      {
        type: 'nav' as const,
        id: 'nav-links',
        label: 'Quick Links & Phím tắt',
        sub: 'Danh mục liên kết hệ thống, báo cáo và vận hành',
        path: '/?tab=links',
        tag: 'Links',
        icon: <SFLink size={16} />,
        iconBg: 'bg-sky-500/12 dark:bg-sky-500/20',
        iconColor: 'text-sky-600 dark:text-sky-400',
      },
      {
        type: 'nav' as const,
        id: 'nav-accounts',
        label: 'Tài khoản & Phần mềm (Vault)',
        sub: 'Két bảo mật thông tin đăng nhập SAP, POS, Bravo...',
        path: '/?tab=accounts',
        tag: 'Account Vault',
        icon: <SFShieldFill size={16} />,
        iconBg: 'bg-emerald-500/12 dark:bg-emerald-500/20',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        type: 'nav' as const,
        id: 'nav-stores',
        label: 'Danh mục Cửa hàng (DS CH)',
        sub: 'Tra cứu mã cửa hàng, địa chỉ, vị trí Google Maps',
        path: '/?tab=stores',
        tag: 'Cửa hàng',
        icon: <SFStorefront size={16} />,
        iconBg: 'bg-amber-500/12 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
      },
      {
        type: 'nav' as const,
        id: 'nav-settings',
        label: 'Cài đặt & Dữ liệu Workspace',
        sub: 'Cấu hình bảo mật, kiểm tra dung lượng, xuất nhập Excel',
        path: '/settings',
        tag: 'Hệ thống',
        icon: <SFGearshapeFill size={16} />,
        iconBg: 'bg-slate-500/12 dark:bg-slate-500/20',
        iconColor: 'text-slate-600 dark:text-slate-400',
      },
    ],
    []
  );

  // Quick System Actions
  const systemActions = useMemo(
    () => [
      {
        type: 'action' as const,
        id: 'act-quick-note',
        label: 'Mở cửa sổ Ghi chú nhanh (Quick Note)',
        sub: 'Tạo hoặc xem các ghi chú công việc nhanh (phím tắt Alt + N hoặc Ctrl + J)',
        tag: 'Ghi chú',
        icon: <SFSquareAndPencil size={16} />,
        iconBg: 'bg-amber-500/12 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        action: () => {
          handleClose();
          useNoteStore.getState().openNote();
        },
      },
      {
        type: 'action' as const,
        id: 'act-new-note',
        label: 'Tạo ghi chú mới ngay lập tức',
        sub: 'Mở trình soạn thảo tạo ghi chú mới',
        tag: 'Ghi chú',
        icon: <SFSquareAndPencil size={16} />,
        iconBg: 'bg-amber-500/12 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        action: () => {
          handleClose();
          useNoteStore.getState().createNote();
        },
      },
      {
        type: 'action' as const,
        id: 'act-import',
        label: 'Import dữ liệu từ file Excel',
        sub: 'Mở cửa sổ tải tệp bảng tính (.xlsx, .xls, .csv) vào hệ thống',
        tag: 'Excel Hub',
        icon: <SFTablecells size={16} />,
        iconBg: 'bg-emerald-500/12 dark:bg-emerald-500/20',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        action: () => {
          handleClose();
          if (onOpenImportModal) {
            onOpenImportModal();
          } else {
            navigate('/data-manager');
          }
        },
      },
      {
        type: 'action' as const,
        id: 'act-theme',
        label: `Chuyển sang giao diện ${theme === 'dark' ? 'Sáng (Light Mode)' : 'Tối (Dark Mode)'}`,
        sub: 'Chuyển đổi tông màu giao diện Sáng / Tối',
        tag: 'Giao diện',
        icon: theme === 'dark' ? <SFSunMaxFill size={16} /> : <SFMoonFill size={16} />,
        iconBg: 'bg-violet-500/12 dark:bg-violet-500/20',
        iconColor: 'text-violet-600 dark:text-violet-400',
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
          handleClose();
        },
      },
      {
        type: 'action' as const,
        id: 'act-new-link',
        label: 'Thêm lối tắt liên kết mới',
        sub: 'Mở biểu mẫu thêm link mới vào hệ thống Quick Links',
        tag: 'Quick Links',
        icon: <SFLink size={16} />,
        iconBg: 'bg-sky-500/12 dark:bg-sky-500/20',
        iconColor: 'text-sky-600 dark:text-sky-400',
        action: () => {
          navigate('/links');
          handleClose();
        },
      },
      {
        type: 'action' as const,
        id: 'act-new-account',
        label: 'Lưu tài khoản phần mềm mới',
        sub: 'Thêm tài khoản vào Két bảo mật Account Vault',
        tag: 'Account Vault',
        icon: <SFShieldFill size={16} />,
        iconBg: 'bg-teal-500/12 dark:bg-teal-500/20',
        iconColor: 'text-teal-600 dark:text-teal-400',
        action: () => {
          navigate('/?tab=accounts');
          handleClose();
        },
      },
      {
        type: 'action' as const,
        id: 'act-new-store',
        label: 'Thêm chi nhánh cửa hàng mới',
        sub: 'Đăng ký mã cửa hàng mới vào danh mục hệ thống',
        tag: 'Cửa hàng',
        icon: <SFStorefront size={16} />,
        iconBg: 'bg-amber-500/12 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        action: () => {
          navigate('/?tab=stores');
          handleClose();
        },
      },
    ],
    [theme, setTheme, onOpenImportModal, navigate]
  );

  // Filter and compute categories & results
  const { results, counts } = useMemo(() => {
    const q = query.trim().toLowerCase();

    let matchedLinks = links.map((l) => ({
      type: 'link' as const,
      id: l.id,
      label: l.hangMuc,
      sub: l.category ? `Danh mục: ${l.category}${l.note ? ` • ${l.note}` : ''}` : l.note || 'Link làm việc trực tiếp',
      tag: l.category || 'Quick Link',
      url: l.link,
      icon: <SFLink size={16} />,
      iconBg: 'bg-sky-500/12 dark:bg-sky-500/20',
      iconColor: 'text-sky-600 dark:text-sky-400',
    }));

    let matchedAccounts = accounts.map((a) => ({
      type: 'account' as const,
      id: a.id,
      label: a.software,
      sub: `Username: ${a.username}${a.note ? ` • ${a.note}` : ''}`,
      tag: 'Tài khoản',
      path: '/accounts',
      icon: <SFShieldFill size={16} />,
      iconBg: 'bg-emerald-500/12 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    }));

    let matchedStores = stores.map((s) => ({
      type: 'store' as const,
      id: s.id,
      label: `${s.storeCode} - Cửa hàng Farmers Market`,
      sub: s.address || 'Chưa cập nhật địa chỉ',
      tag: s.storeCode,
      mapsUrl: s.googleMaps,
      path: '/stores',
      icon: <SFStorefront size={16} />,
      iconBg: 'bg-amber-500/12 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
    }));

    let matchedActions = systemActions;
    let matchedNav = navItems;

    if (q) {
      matchedLinks = matchedLinks.filter(
        (l) =>
          l.label.toLowerCase().includes(q) ||
          l.sub.toLowerCase().includes(q) ||
          l.tag.toLowerCase().includes(q) ||
          (l.url && l.url.toLowerCase().includes(q))
      );
      matchedAccounts = matchedAccounts.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.sub.toLowerCase().includes(q) ||
          a.tag.toLowerCase().includes(q)
      );
      matchedStores = matchedStores.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.sub.toLowerCase().includes(q) ||
          s.tag.toLowerCase().includes(q)
      );
      matchedActions = matchedActions.filter(
        (act) =>
          act.label.toLowerCase().includes(q) ||
          act.sub.toLowerCase().includes(q) ||
          act.tag.toLowerCase().includes(q)
      );
      matchedNav = matchedNav.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.sub.toLowerCase().includes(q) ||
          n.tag.toLowerCase().includes(q)
      );
    }

    const countsObj = {
      all: matchedLinks.length + matchedAccounts.length + matchedStores.length + matchedActions.length + matchedNav.length,
      link: matchedLinks.length,
      account: matchedAccounts.length,
      store: matchedStores.length,
      action: matchedActions.length,
      nav: matchedNav.length,
    };

    let list: any[] = [];
    if (activeCategory === 'all') {
      if (q) {
        list = [
          ...matchedActions.slice(0, 3),
          ...matchedLinks.slice(0, 8),
          ...matchedStores.slice(0, 6),
          ...matchedAccounts.slice(0, 5),
          ...matchedNav.slice(0, 4),
        ];
      } else {
        list = [
          ...matchedNav,
          ...matchedActions,
          ...matchedLinks.slice(0, 4),
          ...matchedStores.slice(0, 3),
        ];
      }
    } else if (activeCategory === 'link') {
      list = matchedLinks;
    } else if (activeCategory === 'account') {
      list = matchedAccounts;
    } else if (activeCategory === 'store') {
      list = matchedStores;
    } else if (activeCategory === 'action') {
      list = matchedActions;
    } else if (activeCategory === 'nav') {
      list = matchedNav;
    }

    return { results: list, counts: countsObj };
  }, [query, activeCategory, links, accounts, stores, systemActions, navItems]);

  const categories: {
    id: FilterCategory;
    label: string;
    icon: React.ReactNode;
    count: number;
    activeColor: string;
    activeBadge: string;
  }[] = useMemo(
    () => [
      {
        id: 'all',
        label: 'Tất cả',
        icon: <SFSquareStack3dUp size={14} />,
        count: counts.all,
        activeColor: 'text-[#0066cc] dark:text-[#2997ff]',
        activeBadge: 'bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]',
      },
      {
        id: 'link',
        label: 'Liên kết',
        icon: <SFLink size={14} />,
        count: counts.link,
        activeColor: 'text-sky-600 dark:text-sky-400',
        activeBadge: 'bg-sky-500/12 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400',
      },
      {
        id: 'account',
        label: 'Tài khoản',
        icon: <SFShieldFill size={14} />,
        count: counts.account,
        activeColor: 'text-emerald-600 dark:text-emerald-400',
        activeBadge: 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      },
      {
        id: 'store',
        label: 'Cửa hàng',
        icon: <SFStorefront size={14} />,
        count: counts.store,
        activeColor: 'text-amber-600 dark:text-amber-400',
        activeBadge: 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      },
      {
        id: 'action',
        label: 'Tác vụ',
        icon: <SFBoltFill size={14} />,
        count: counts.action,
        activeColor: 'text-purple-600 dark:text-purple-400',
        activeBadge: 'bg-purple-500/12 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
      },
      {
        id: 'nav',
        label: 'Trang',
        icon: <SFLocationFill size={14} />,
        count: counts.nav,
        activeColor: 'text-indigo-600 dark:text-indigo-400',
        activeBadge: 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      },
    ],
    [counts]
  );

  // Update sliding liquid indicator when category changes or modal opens
  useEffect(() => {
    if (!isOpen || !categoryBarRef.current) return;
    const updateIndicator = () => {
      const activeBtn = categoryBarRef.current?.querySelector<HTMLButtonElement>(`[data-cat-id="${activeCategory}"]`);
      if (activeBtn) {
        setCatIndicator({
          left: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
          ready: true,
        });
      }
    };

    updateIndicator();
    const t1 = setTimeout(updateIndicator, 40);
    const t2 = setTimeout(updateIndicator, 150);
    window.addEventListener('resize', updateIndicator);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeCategory, categories, isOpen]);

  // Popular search suggestions
  const popularTags = ['FM09', 'POS', 'Bravo', 'Kho Hub', 'Google Drive', 'Excel'];

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) handleClose();
      }
      if (!isOpen || isClosing) return;

      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const catKeys: FilterCategory[] = ['all', 'link', 'account', 'store', 'action', 'nav'];
        const currentIdx = catKeys.indexOf(activeCategory);
        if (e.shiftKey) {
          const nextIdx = (currentIdx - 1 + catKeys.length) % catKeys.length;
          setActiveCategory(catKeys[nextIdx]);
        } else {
          const nextIdx = (currentIdx + 1) % catKeys.length;
          setActiveCategory(catKeys[nextIdx]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setSelectedIndex((prev) => {
          if (results.length === 0) return -1;
          if (prev < 0) return 0;
          return prev < results.length - 1 ? prev + 1 : 0;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setSelectedIndex((prev) => {
          if (results.length === 0) return -1;
          if (prev <= 0) return results.length - 1;
          return prev - 1;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        const targetIdx = selectedIndex >= 0 ? selectedIndex : 0;
        if (results[targetIdx]) {
          handleExecute(results[targetIdx]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing, results, selectedIndex, activeCategory]);

  const handleExecute = (item: any) => {
    if (query.trim()) {
      saveRecentTerm(query.trim());
    } else if (item.label) {
      saveRecentTerm(item.label);
    }

    if (item.action) {
      item.action();
      return;
    }

    if (item.type === 'link') {
      if (item.url && /^https?:\/\//i.test(item.url.trim())) {
        window.open(item.url.trim(), '_blank', 'noopener,noreferrer');
      } else {
        navigate('/?tab=links');
      }
    } else if (item.type === 'account') {
      navigate('/?tab=accounts');
    } else if (item.type === 'store') {
      if (item.mapsUrl && /^https?:\/\//i.test(item.mapsUrl.trim())) {
        window.open(item.mapsUrl.trim(), '_blank', 'noopener,noreferrer');
      } else {
        navigate('/?tab=stores');
      }
    } else if (item.type === 'nav') {
      navigate(item.path);
    }
    handleClose();
  };

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 sm:pt-28 p-3 sm:p-4">
      {/* Liquid Glass Dynamic Backdrop with Smooth Fade */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 dark:bg-black/65 backdrop-blur-md',
          isClosing ? 'liquid-backdrop-exit' : 'liquid-backdrop-enter'
        )}
        onClick={handleClose}
      />

      {/* Main Spotlight Dialog with Fluid Droplet Expansion & Collapse */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm nhanh Spotlight"
        className={cn(
          'relative w-full max-w-2xl sm:max-w-[720px] bg-white/95 dark:bg-[#1c1c22]/90 backdrop-blur-2xl rounded-[24px] shadow-[0_28px_80px_rgba(0,0,0,0.35),inset_0_1.5px_1px_rgba(255,255,255,0.95)] border border-black/10 dark:border-white/15 overflow-hidden z-10 flex flex-col',
          isClosing ? 'liquid-droplet-exit' : 'liquid-droplet-enter'
        )}
      >
        {/* Seamless Search Bar Header */}
        <div
          onMouseEnter={resetSelectionImmediate}
          className="flex items-center gap-3.5 px-5 py-4 border-b border-black/[0.06] dark:border-white/10 bg-transparent"
        >
          <div className="w-8 h-8 rounded-xl bg-[#0071e3]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0">
            <SFMagnifyingglass size={16} />
          </div>

          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeCategory === 'all'
                ? 'Tìm nhanh link, tài khoản, mã CH (FM09), tác vụ... (Tab để lọc)'
                : `Tìm trong ${categories.find((c) => c.id === activeCategory)?.label}...`
            }
            className="w-full text-[16px] bg-transparent text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6] border-0 outline-none ring-0 p-0 shadow-none font-normal"
            style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
          />

          {/* Right Controls: Result Count + Clear + Clean Close (X) Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {query && (
              <>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]">
                  {results.length} kết quả
                </span>
                <CloseButton
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  size="xs"
                  label="Xoá nội dung"
                  title="Xoá nội dung"
                />
              </>
            )}

            {/* Dedicated Close Button */}
            <CloseButton
              onClick={handleClose}
              size="sm"
              className="ml-1"
              title="Đóng tìm kiếm (Esc)"
            />
          </div>
        </div>

        {/* Category Filter Segmented Control Bar (Liquid Capsule) */}
        <div
          onMouseEnter={resetSelectionImmediate}
          className="px-3 sm:px-4 py-2 border-b border-black/[0.05] dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02]"
        >
          <div
            ref={categoryBarRef}
            className="relative w-full flex items-center p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/10 backdrop-blur-md"
          >
            {/* Liquid Droplet Sliding Indicator Pill */}
            {catIndicator.ready && catIndicator.width > 0 && (
              <div
                className="absolute top-1 bottom-1 rounded-full bg-white dark:bg-[#2c2c2e] shadow-[0_1px_4px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/10 transition-[transform,width] duration-220 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,width] pointer-events-none"
                style={{
                  transform: `translate3d(${catIndicator.left}px, 0, 0)`,
                  width: `${catIndicator.width}px`,
                }}
              />
            )}

            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  data-cat-id={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'relative z-10 flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-full text-[11.5px] sm:text-xs transition-colors duration-200 cursor-pointer active:scale-95 select-none min-w-0',
                    isActive
                      ? 'text-[#1d1d1f] dark:text-white font-semibold'
                      : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                  )}
                >
                  <span className={cn('shrink-0 transition-colors', isActive ? cat.activeColor : 'text-[#86868b] dark:text-[#a1a1a6]')}>
                    {cat.icon}
                  </span>
                  <span className="truncate">{cat.label}</span>
                  {cat.count > 0 && (
                    <span
                      className={cn(
                        'shrink-0 text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors',
                        isActive ? cat.activeBadge : 'bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6]'
                      )}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body with Fluid Droplet Glide Transition */}
        <div
          key={activeCategory}
          ref={listRef}
          onMouseLeave={handleItemMouseLeave}
          className="max-h-[380px] sm:max-h-[420px] overflow-y-auto p-3 space-y-1 scroll-smooth liquid-tab-enter"
        >
          {/* Quick Suggestions & Recent Searches (when query is empty) */}
          {!query && (
            <div className="px-2 pt-1 pb-2 space-y-3" onMouseEnter={resetSelectionImmediate}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <SFClock size={12} />
                      Tìm kiếm gần đây
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[10px] text-[#0066cc] dark:text-[#2997ff] hover:underline normal-case font-normal"
                    >
                      Xoá lịch sử
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="px-2.5 py-1 text-xs rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 dark:hover:bg-[#2997ff]/15 hover:text-[#0066cc] dark:hover:text-[#2997ff] text-[#1d1d1f] dark:text-white transition-colors border border-black/[0.04] dark:border-white/5 cursor-pointer font-medium"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Tags */}
              <div>
                <div className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <SFSparkles size={12} className="text-amber-500" />
                  Gợi ý tra cứu nhanh
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setQuery(tag)}
                      className="px-2.5 py-1 text-xs rounded-full bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors border border-black/[0.04] dark:border-white/5 cursor-pointer font-medium"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/[0.04] dark:border-white/5 pt-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                {activeCategory === 'all' ? 'Lối tắt & Tác vụ được đề xuất' : `Danh sách ${categories.find((c) => c.id === activeCategory)?.label}`}
              </div>
            </div>
          )}

          {/* Results Header when searching */}
          {query && (
            <div
              onMouseEnter={resetSelectionImmediate}
              className="px-2 pt-1 pb-1 text-[11px] font-semibold text-[#86868b] uppercase tracking-wider flex items-center justify-between"
            >
              <span>
                {activeCategory === 'all'
                  ? `Kết quả tìm kiếm cho "${query}" (${results.length})`
                  : `Kết quả trong ${categories.find((c) => c.id === activeCategory)?.label} (${results.length})`}
              </span>
            </div>
          )}

          {/* Results List */}
          {results.length > 0 ? (
            results.map((item: any, idx: number) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={`${item.type}-${item.id || item.path}-${idx}`}
                  onClick={() => handleExecute(item)}
                  onMouseEnter={() => handleItemMouseEnter(idx)}
                  onMouseLeave={handleItemMouseLeave}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-120 group cursor-pointer',
                    isSelected
                      ? 'bg-[#0071e3]/8 dark:bg-[#0071e3]/18 shadow-2xs'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                  )}
                >
                  {/* Category-Colored Icon Tile */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform',
                      item.iconBg || 'bg-blue-500/12 dark:bg-blue-500/20',
                      item.iconColor || 'text-blue-600 dark:text-blue-400',
                      isSelected ? 'scale-105' : 'group-hover:scale-105'
                    )}
                  >
                    {item.icon}
                  </div>

                  {/* Title & Subtitle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HighlightedText
                        text={item.label}
                        query={query}
                        className={cn(
                          'truncate text-[13.5px] font-medium',
                          isSelected
                            ? 'text-[#0071e3] dark:text-[#2997ff] font-semibold'
                            : 'text-[#1d1d1f] dark:text-white'
                        )}
                      />
                      {item.tag && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-black/[0.04] dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6] shrink-0">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    {item.sub && (
                      <div className="text-[11.5px] truncate text-[#86868b] dark:text-[#a1a1a6]">
                        <HighlightedText text={item.sub} query={query} />
                      </div>
                    )}
                  </div>

                  {/* Right Action Hint */}
                  {isSelected ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[11px] font-mono text-[#0071e3] dark:text-[#2997ff] shrink-0 animate-in fade-in duration-100 font-medium">
                      <span>Mở</span>
                      <SFReturn size={12} />
                    </div>
                  ) : item.url || item.mapsUrl ? (
                    <SFArrowUpRightSquare size={14} className="shrink-0 text-[#86868b] opacity-40 group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <SFArrowRight size={14} className="shrink-0 text-[#86868b] opacity-40 group-hover:opacity-80 transition-opacity" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="py-10 text-center px-4">
              <div className="w-10 h-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 flex items-center justify-center mx-auto mb-2 text-[#76767b]">
                <SFMagnifyingglass size={20} className="opacity-40" />
              </div>
              <p className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-white">
                Không tìm thấy kết quả nào cho &quot;{query}&quot;
              </p>
              <p className="text-[11.5px] text-[#76767b] dark:text-[#a1a1a6] mt-1 max-w-sm mx-auto">
                Thử tìm theo mã cửa hàng (VD: FM01), tên phần mềm, hoặc chọn &quot;Tất cả&quot;.
              </p>
              {activeCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className="mt-2.5 px-3 py-1 rounded-full text-xs font-medium text-[#0066cc] dark:text-[#2997ff] bg-[#0066cc]/10 dark:bg-[#2997ff]/15 hover:bg-[#0066cc]/20 transition-colors cursor-pointer"
                >
                  Tìm trong Tất cả danh mục
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div
          onMouseEnter={resetSelectionImmediate}
          className="px-5 py-2.5 border-t border-black/[0.06] dark:border-white/10 bg-white/40 dark:bg-[#1c1c1e]/40 backdrop-blur-md flex items-center justify-between text-[11px] text-[#76767b] dark:text-[#a1a1a6]"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#272729] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs font-medium text-[#1d1d1f] dark:text-white">
                ↑↓
              </kbd>
              <span>di chuyển</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#272729] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs font-medium text-[#1d1d1f] dark:text-white">
                ↵
              </kbd>
              <span>chọn</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#272729] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs font-medium text-[#1d1d1f] dark:text-white">
                Tab
              </kbd>
              <span>đổi lọc</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#272729] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs font-medium text-[#1d1d1f] dark:text-white">
                esc
              </kbd>
              <span>đóng</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff] animate-pulse" />
            <span className="font-medium opacity-85 text-[10.5px]">FM Spotlight</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
