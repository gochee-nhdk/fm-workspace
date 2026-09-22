import React, { useState, useEffect, useMemo } from 'react';
import {
  Link as LinkIcon,
  Search,
  Plus,
  ExternalLink,
  Copy,
  Star,
  Edit2,
  Trash2,
  Grid,
  List,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  Folder,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { LinkItem } from '@/types/workspace';
import { LinkDrawerForm } from '@/components/forms/LinkDrawerForm';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import toast from 'react-hot-toast';

export const QuickLinksPage: React.FC = () => {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'stt' | 'name' | 'favorite'>('favorite');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Drawer and Dialog state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LinkItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkItem | null>(null);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const data = await dataService.getLinks();
      setLinks(data);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách liên kết');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    links.forEach((l) => {
      if (l.category) set.add(l.category);
    });
    return Array.from(set);
  }, [links]);

  const filteredLinks = useMemo(() => {
    return links
      .filter((item) => {
        const matchesSearch =
          !search.trim() ||
          item.hangMuc.toLowerCase().includes(search.toLowerCase()) ||
          (item.note && item.note.toLowerCase().includes(search.toLowerCase())) ||
          (item.category && item.category.toLowerCase().includes(search.toLowerCase()));

        const matchesCat =
          selectedCategory === 'ALL' || item.category === selectedCategory;

        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        if (sortBy === 'favorite') {
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
        }
        if (sortBy === 'name') {
          return a.hangMuc.localeCompare(b.hangMuc);
        }
        return (a.stt ?? 999999) - (b.stt ?? 999999);
      });
  }, [links, search, selectedCategory, sortBy]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await dataService.toggleFavoriteLink(id);
      fetchLinks();
    } catch (err) {
      toast.error('Lỗi khi đổi trạng thái yêu thích');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dataService.deleteLink(deleteTarget.id);
      toast.success('Đã xóa liên kết thành công');
      setDeleteTarget(null);
      fetchLinks();
    } catch (err) {
      toast.error('Lỗi khi xóa liên kết');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-[#0066cc] dark:text-[#2997ff]" />
            Quick Links & Hệ Thống Làm Việc
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#7a7a7a] mt-1 leading-[1.47]">
            Tổng hợp đường dẫn truy cập nhanh các hệ thống SAP, POS, Google Sheets, cổng thông tin.
          </p>
        </div>

        <div className="glass-container p-1.5 flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => excelService.exportDataset('LINK')}
            disabled={links.length === 0}
          >
            Xuất Excel
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
            icon={<FileSpreadsheet className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff]" />}
          >
            Import Excel
          </Button>
          <Button
            variant="glassProminent"
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setDrawerOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Thêm Link mới
          </Button>
        </div>
      </div>

      {/* Filter & Toolbar (Apple Utility Bar) */}
      <div className="glass-material rounded-[22px] p-3.5 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3.5 shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-80 group">
          <Search className="w-4 h-4 text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Tìm theo tên hạng mục, ghi chú..."
            className="glass-input w-full text-[13px] rounded-full pl-9 pr-3.5 py-2 placeholder:text-[#86868b]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-[13px] text-[#76767b] dark:text-[#a1a1a6]">
            <Filter className="w-3.5 h-3.5 text-[#76767b] dark:text-[#a1a1a6]" />
            <select
              className="glass-input text-[13px] rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer font-medium"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">Tất cả nhóm ({links.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({links.filter((l) => l.category === c).length})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <select
            className="glass-input text-[13px] rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer font-medium"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="favorite">Sắp xếp: Yêu thích trước</option>
            <option value="name">Sắp xếp: Theo tên (A-Z)</option>
            <option value="stt">Sắp xếp: Thứ tự mặc định</option>
          </select>

          {/* View Mode Segmented Switch */}
          <div className="liquid-glass-segmented-track p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition-all active:scale-95 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-white/20 text-[#0066cc] dark:text-white shadow-xs font-semibold'
                  : 'text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
              }`}
              title="Chế độ lưới"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition-all active:scale-95 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-white/20 text-[#0066cc] dark:text-white shadow-xs font-semibold'
                  : 'text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
              }`}
              title="Chế độ danh sách"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Grid or List or Empty */}
      {filteredLinks.length === 0 ? (
        <div className="py-16 text-center rounded-[22px] glass-material p-8 space-y-4">
          <div className="w-13 h-13 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center mx-auto shadow-2xs">
            <LinkIcon className="w-6 h-6" />
          </div>
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
            {search ? 'Không tìm thấy liên kết phù hợp' : 'Chưa có liên kết nào'}
          </h3>
          <p className="text-[14px] text-[#7a7a7a] max-w-sm mx-auto leading-[1.47]">
            {search
              ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc.'
              : 'Thêm lối tắt công việc đầu tiên của bạn hoặc Import từ file Excel.'}
          </p>
          <div className="glass-container p-1.5 inline-flex items-center justify-center gap-2 pt-2">
            <Button
              variant="glassProminent"
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setDrawerOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Thêm Link mới
            </Button>
            <Button
              variant="glass"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
              icon={<FileSpreadsheet className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff]" />}
            >
              Import Excel
            </Button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLinks.map((item, index) => (
            <div
              key={item.id}
              className={`glass-material-interactive liquid-tilt-card rounded-[22px] p-5.5 flex flex-col justify-between group hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/50 transition-all duration-300 active:scale-[0.985] ios-animate-in ios-stagger-${(index % 6) + 1}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-b from-[#0066cc]/15 to-[#0077ed]/5 dark:from-[#2997ff]/20 dark:to-transparent border border-[#0066cc]/20 dark:border-[#2997ff]/30 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shadow-[0_0_12px_rgba(0,102,204,0.15)] shrink-0 group-hover:scale-110 transition-transform duration-200">
                      <LinkIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight truncate">
                        {item.hangMuc}
                      </h4>
                      {item.category && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] border border-black/5 dark:border-white/10 text-[#76767b] dark:text-[#a1a1a6] font-medium inline-block mt-0.5">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleToggleFavorite(item.id, e)}
                    className="text-[#cccccc] hover:text-amber-500 transition-colors p-1 active:scale-90"
                    title={item.favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        item.favorite ? 'text-amber-500 fill-amber-500' : ''
                      }`}
                    />
                  </button>
                </div>

                {item.note && (
                  <p className="mt-3.5 text-[13px] text-[#76767b] dark:text-[#a1a1a6] line-clamp-2 leading-[1.47]">
                    {item.note}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
                <div>
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#0066cc] to-[#0077ed] text-white text-[13px] font-medium hover:brightness-105 transition-all active:scale-95 shadow-[0_2px_8px_rgba(0,102,204,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                    >
                      <span>Mở link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                      <AlertCircle className="w-3 h-3" />
                      Missing link
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {item.link && (
                    <button
                      onClick={() => handleCopy(item.link, 'đường dẫn')}
                      className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-90 shadow-2xs"
                      title="Sao chép link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setDrawerOpen(true);
                    }}
                    className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-90 shadow-2xs"
                    title="Chỉnh sửa"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-rose-500/15 border border-black/5 dark:border-white/10 flex items-center justify-center text-[#76767b] hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-90 shadow-2xs"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode */
        <div className="glass-material rounded-[22px] overflow-hidden ios-animate-in">
          <div className="divide-y divide-[#e0e0e0]/70 dark:divide-white/10">
            {filteredLinks.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 flex items-center justify-between gap-4 hover:bg-[#0066cc]/5 dark:hover:bg-white/5 transition-all duration-200 ios-animate-in ios-stagger-${(index % 6) + 1}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={(e) => handleToggleFavorite(item.id, e)}
                    className="text-[#cccccc] hover:text-amber-500 transition-colors shrink-0 active:scale-95"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        item.favorite ? 'text-amber-500 fill-amber-500' : ''
                      }`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-[#1d1d1f] dark:text-white truncate">
                        {item.hangMuc}
                      </span>
                      {item.category && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 text-[#7a7a7a]">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <p className="text-[13px] text-[#7a7a7a] truncate mt-0.5">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0066cc]/20 text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors active:scale-95"
                    >
                      <span>Mở link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      Missing link
                    </span>
                  )}

                  {item.link && (
                    <button
                      onClick={() => handleCopy(item.link, 'đường dẫn')}
                      className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white active:scale-95"
                      title="Sao chép link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setDrawerOpen(true);
                    }}
                    className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white active:scale-95"
                    title="Chỉnh sửa"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-rose-600 transition-colors active:scale-95"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side Drawer */}
      <LinkDrawerForm
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        onSave={async (data) => {
          if (editingItem) {
            await dataService.updateLink(editingItem.id, data);
          } else {
            await dataService.createLink(data);
          }
          fetchLinks();
        }}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa liên kết?"
        description="Liên kết này sẽ bị xóa khỏi danh sách phím tắt làm việc của bạn."
        itemLabel={deleteTarget?.hangMuc}
      />
    </div>
  );
};
