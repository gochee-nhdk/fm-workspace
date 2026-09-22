import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Search,
  Plus,
  Navigation,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Filter,
  FileSpreadsheet,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { StoreItem } from '@/types/workspace';
import { StoreDrawerForm } from '@/components/forms/StoreDrawerForm';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import toast from 'react-hot-toast';

export const StoresPage: React.FC = () => {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Drawer and Dialog state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreItem | null>(null);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const data = await dataService.getStores();
      setStores(data);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách cửa hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const types = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.type) set.add(s.type);
    });
    return Array.from(set);
  }, [stores]);

  const filteredStores = useMemo(() => {
    return stores.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.storeCode.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q);

      const matchesType = selectedType === 'ALL' || item.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [stores, search, selectedType]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dataService.deleteStore(deleteTarget.id);
      toast.success('Đã xóa cửa hàng thành công');
      setDeleteTarget(null);
      fetchStores();
    } catch (err) {
      toast.error('Lỗi khi xóa cửa hàng');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2">
            <Store className="w-6 h-6 text-[#0066cc] dark:text-[#2997ff]" />
            Danh Sách Cửa Hàng (DS CH)
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#7a7a7a] mt-1 leading-[1.47]">
            Tra cứu nhanh mã cửa hàng, địa chỉ giao nhận hàng và tọa độ Google Maps.
          </p>
        </div>

        <div className="glass-container p-1.5 flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => excelService.exportDataset('STORE')}
            disabled={stores.length === 0}
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
            Thêm Cửa Hàng
          </Button>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="glass-material p-3.5 sm:p-4 rounded-[22px] flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-xs ios-animate-in ios-stagger-1">
        {/* Search */}
        <div className="relative w-full sm:w-80 group">
          <Search className="w-4 h-4 text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Tìm theo mã CH (FM09), địa chỉ..."
            className="glass-input w-full text-[13px] rounded-full pl-9 pr-3.5 py-2 placeholder:text-[#86868b]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] flex items-center gap-1 font-medium">
            <Filter className="w-3.5 h-3.5" /> Phân loại:
          </span>
          <select
            className="glass-input text-[13px] rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer font-medium"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="ALL">Tất cả ({stores.length})</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t} ({stores.filter((s) => s.type === t).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content: Table for Desktop, Cards for Mobile, or Empty State */}
      {filteredStores.length === 0 ? (
        <div className="py-16 text-center rounded-[22px] glass-material p-8 space-y-4">
          <div className="w-13 h-13 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center mx-auto shadow-2xs">
            <Store className="w-6 h-6" />
          </div>
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
            {search ? 'Không tìm thấy cửa hàng phù hợp' : 'Chưa có cửa hàng nào'}
          </h3>
          <p className="text-[14px] text-[#7a7a7a] max-w-sm mx-auto leading-[1.47]">
            {search
              ? 'Thử tìm với mã khác hoặc địa chỉ khác.'
              : 'Tạo cửa hàng đầu tiên hoặc Import từ file Excel.'}
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
              Thêm Cửa Hàng
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
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block glass-material rounded-[22px] overflow-hidden ios-animate-in ios-stagger-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e0e0e0]/70 dark:border-white/10 bg-[#fafafc]/80 dark:bg-[#272729]/80 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-36">Mã Cửa Hàng</th>
                  <th className="py-3.5 px-4">Địa chỉ</th>
                  <th className="py-3.5 px-4 w-32">Phân loại</th>
                  <th className="py-3.5 px-4 w-36">Định vị</th>
                  <th className="py-3.5 px-4 text-right w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/50 dark:divide-white/5 text-[14px]">
                {filteredStores.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-[#0066cc]/5 dark:hover:bg-white/5 transition-all duration-200 ios-animate-in ios-stagger-${(idx % 6) + 1}`}
                  >
                    {/* Store Code */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[13px] font-semibold text-[#0066cc] dark:text-[#2997ff] px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/20 border border-[#0066cc]/20">
                        {item.storeCode}
                      </span>
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 font-normal text-[#1d1d1f] dark:text-white">
                      <div className="flex items-center gap-2 max-w-md">
                        <span className="truncate">{item.address}</span>
                        <button
                          onClick={() => handleCopy(item.address, 'địa chỉ')}
                          className="text-[#7a7a7a] hover:text-[#0066cc] p-1 shrink-0 active:scale-95"
                          title="Sao chép địa chỉ"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4">
                      <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#272729] text-[#7a7a7a]">
                        {item.type || 'Standard'}
                      </span>
                    </td>

                    {/* Maps */}
                    <td className="py-3.5 px-4">
                      {item.googleMaps ? (
                        <a
                          href={item.googleMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#0066cc] dark:text-[#2997ff] hover:underline font-normal text-[13px]"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Mở Bản đồ</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[#7a7a7a] italic text-[12px]">Chưa có link</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setDrawerOpen(true);
                          }}
                          className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] active:scale-95"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-rose-600 active:scale-95"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (Utility Cards) */}
          <div className="md:hidden space-y-3">
            {filteredStores.map((item, idx) => (
              <div
                key={item.id}
                className={`glass-material-interactive p-5 rounded-[20px] shadow-xs space-y-3 active:scale-[0.985] ios-animate-in ios-stagger-${(idx % 6) + 1}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-semibold text-[#0066cc] dark:text-[#2997ff] px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/20">
                    {item.storeCode}
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#272729] text-[#7a7a7a]">
                    {item.type || 'Standard'}
                  </span>
                </div>

                <div className="text-[14px] text-[#1d1d1f] dark:text-white flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#7a7a7a] shrink-0 mt-0.5" />
                  <span>{item.address}</span>
                </div>

                <div className="pt-2 border-t border-[#e0e0e0]/70 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() => handleCopy(item.address, 'địa chỉ')}
                      icon={<Copy className="w-3.5 h-3.5" />}
                    >
                      Copy
                    </Button>
                    {item.googleMaps && (
                      <a
                        href={item.googleMaps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] text-[13px] font-medium hover:bg-[#0066cc]/20 active:scale-95"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Maps</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setDrawerOpen(true);
                      }}
                      className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-rose-600 active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Drawer */}
      <StoreDrawerForm
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        onSave={async (data) => {
          if (editingItem) {
            await dataService.updateStore(editingItem.id, data);
          } else {
            await dataService.createStore(data);
          }
          fetchStores();
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa cửa hàng?"
        description="Thông tin cửa hàng này sẽ bị xóa vĩnh viễn khỏi danh bạ."
        itemLabel={`${deleteTarget?.storeCode} - ${deleteTarget?.address}`}
      />
    </div>
  );
};
