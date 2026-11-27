import React, { useState, useEffect, useRef } from 'react';
import {
  SFMagnifyingglass,
  SFStar,
  SFStarFill,
  SFLine3HorizontalDecreaseCircle,
  SFChevronDown,
} from 'sf-symbols-lib';
import { CloseButton } from '@/components/ui/close-button';
import type { LinkItem } from '@/types/workspace';
import type { WorkspaceTabType } from '../hooks/useWorkspaceData';

interface WorkspaceSearchBarProps {
  activeTab: WorkspaceTabType;
  search: string;
  onSearchChange: (value: string) => void;
  onlyFavorites: boolean;
  onToggleFavorites: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categories: string[];
  links: LinkItem[];
  resultCount: number;
}

export const WorkspaceSearchBar: React.FC<WorkspaceSearchBarProps> = React.memo(
  ({
    activeTab,
    search,
    onSearchChange,
    onlyFavorites,
    onToggleFavorites,
    selectedCategory,
    onSelectCategory,
    categories,
    links,
    resultCount,
  }) => {
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          categoryDropdownRef.current &&
          !categoryDropdownRef.current.contains(event.target as Node)
        ) {
          setCategoryDropdownOpen(false);
        }
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setCategoryDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, []);

    const favoriteCount = links.filter((l) => l.favorite).length;

    return (
      <div className="relative z-10 glass-material rounded-[20px] p-3 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full md:w-96 group">
          <SFMagnifyingglass
            size={16}
            className="text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-2.5 pointer-events-none transition-colors"
          />
          <input
            type="text"
            placeholder={
              activeTab === 'links'
                ? 'Tìm nhanh link, hạng mục, ghi chú...'
                : activeTab === 'accounts'
                ? 'Tìm theo phần mềm, tên đăng nhập, link...'
                : 'Tìm theo mã CH (FM01), địa chỉ, khu vực...'
            }
            className="glass-input w-full text-[13px] rounded-full pl-9 pr-8 py-2 placeholder:text-[#86868b]"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <CloseButton
              onClick={() => onSearchChange('')}
              size="xs"
              className="absolute right-2.5 top-2.5"
              label="Xóa"
              title="Xóa"
            />
          )}
        </div>

        {activeTab === 'links' && (
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <button
              type="button"
              onClick={onToggleFavorites}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-full text-[12.5px] transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-200 cursor-pointer select-none active:scale-95 border ${
                onlyFavorites
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-[0_2px_10px_rgba(245,158,11,0.25)] font-semibold'
                  : 'bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/[0.08] dark:border-white/[0.12] shadow-2xs'
              }`}
            >
              {onlyFavorites ? (
                <SFStarFill size={14} className="text-amber-500 scale-110 transition-transform" />
              ) : (
                <SFStar size={14} className="text-[#8e8e93] transition-transform" />
              )}
              <span>Chỉ mục Yêu thích</span>
              {favoriteCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-mono leading-none ${
                    onlyFavorites
                      ? 'bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold'
                      : 'bg-black/5 dark:bg-white/10 text-[#76767b]'
                  }`}
                >
                  {favoriteCount}
                </span>
              )}
            </button>

            {categories.length > 0 && (
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                  className={`h-9 flex items-center gap-2 px-3.5 rounded-full text-[12.5px] font-medium transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-200 cursor-pointer select-none border active:scale-95 ${
                    selectedCategory !== 'ALL'
                      ? 'bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] border-[#0066cc]/35 shadow-[0_2px_10px_rgba(0,102,204,0.2)] font-semibold'
                      : 'bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/[0.08] dark:border-white/[0.12] shadow-2xs'
                  }`}
                >
                  <SFLine3HorizontalDecreaseCircle
                    size={14}
                    className={
                      selectedCategory !== 'ALL'
                        ? 'text-[#0066cc] dark:text-[#2997ff]'
                        : 'text-[#8e8e93]'
                    }
                  />
                  <span className="max-w-[160px] truncate">
                    {selectedCategory === 'ALL'
                      ? `Tất cả nhóm (${links.length})`
                      : `${selectedCategory} (${links.filter((l) => l.category === selectedCategory).length})`}
                  </span>
                  <SFChevronDown
                    size={14}
                    className={`text-[#8e8e93] transition-transform duration-200 shrink-0 ${
                      categoryDropdownOpen ? 'rotate-180 text-[#0066cc] dark:text-[#2997ff]' : ''
                    }`}
                  />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1c1c24] backdrop-blur-3xl border border-black/10 dark:border-white/15 p-1.5 shadow-[0_20px_48px_-6px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.08)] z-50 apple-popover-tr">
                    <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCategory('ALL');
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer text-left ${
                          selectedCategory === 'ALL'
                            ? 'bg-[#0066cc]/10 dark:bg-[#2997ff]/20 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                            : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
                          <span>Tất cả nhóm</span>
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#76767b]">
                          {links.length}
                        </span>
                      </button>

                      {categories.map((c) => {
                        const count = links.filter((l) => l.category === c).length;
                        const isSelected = selectedCategory === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              onSelectCategory(c);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer text-left ${
                              isSelected
                                ? 'bg-[#0066cc]/10 dark:bg-[#2997ff]/20 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                                : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e93]" />
                              <span className="truncate">{c}</span>
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#76767b] shrink-0">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#76767b] dark:text-[#a1a1a6]">
          <span>Hiển thị:</span>
          <span className="font-mono font-bold text-[#1d1d1f] dark:text-white">{resultCount}</span>
          <span>kết quả</span>
        </div>
      </div>
    );
  }
);
