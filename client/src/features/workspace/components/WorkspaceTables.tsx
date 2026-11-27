import React from 'react';
import { SFLink, SFShieldFill, SFStorefront } from 'sf-symbols-lib';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading';
import { LinkItem, AccountItem, StoreItem } from '@/types/workspace';
import { LinkTableRow } from './LinkTableRow';
import { AccountTableRow } from './AccountTableRow';
import { StoreTableRow } from './StoreTableRow';
import type { WorkspaceTabType } from '../hooks/useWorkspaceData';

interface WorkspaceTablesProps {
  activeTab: WorkspaceTabType;
  animationClass: string;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  search: string;
  onClearSearch: () => void;
  onOpenAdd: () => void;
  filteredLinks: LinkItem[];
  filteredAccounts: AccountItem[];
  filteredStores: StoreItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onSelectAll: () => void;
  draggedId: string | null;
  dragOverId: string | null;
  dropPosition: 'top' | 'bottom' | null;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDragLeave: (id: string, e: React.DragEvent) => void;
  onDrop: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  copiedKey: string | null;
  onCopy: (text: string, label: string, key: string) => void;
  showPasswordMap: Record<string, boolean>;
  onTogglePassword: (id: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onEditLink: (item: LinkItem) => void;
  onDeleteLink: (item: LinkItem) => void;
  onEditAccount: (item: AccountItem) => void;
  onDeleteAccount: (item: AccountItem) => void;
  onPreviewMapStore: (item: StoreItem) => void;
  onEditStore: (item: StoreItem) => void;
  onDeleteStore: (item: StoreItem) => void;
}

export const WorkspaceTables: React.FC<WorkspaceTablesProps> = React.memo(
  ({
    activeTab,
    animationClass,
    loading,
    loadError,
    onRetryLoad,
    search,
    onClearSearch,
    onOpenAdd,
    filteredLinks,
    filteredAccounts,
    filteredStores,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    draggedId,
    dragOverId,
    dropPosition,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    copiedKey,
    onCopy,
    showPasswordMap,
    onTogglePassword,
    onToggleFavorite,
    onEditLink,
    onDeleteLink,
    onEditAccount,
    onDeleteAccount,
    onPreviewMapStore,
    onEditStore,
    onDeleteStore,
  }) => {
    const openImportModal = () =>
      window.dispatchEvent(new CustomEvent('fm:open-import'));

    if (loadError && !loading) {
      return (
        <div className="relative rounded-[22px] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#141418]/70 backdrop-blur-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-8">
          <EmptyState
            icon={<SFShieldFill size={22} />}
            title="Không thể tải dữ liệu"
            description={loadError}
            actionLabel="Thử lại"
            onAction={onRetryLoad}
          />
        </div>
      );
    }

    return (
      <div className="relative rounded-[22px] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#141418]/70 backdrop-blur-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none z-30" />

        <div className="relative">
          {/* 1. SHEET: QUICK LINKS */}
          <div className={activeTab === 'links' ? `${animationClass} block` : 'hidden'}>
            <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
              <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <tr>
                    <th className="w-10 px-2 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={filteredLinks.length > 0 && selectedIds.size === filteredLinks.length}
                        onChange={onSelectAll}
                        className="w-4 h-4 rounded text-[#0066cc] dark:text-[#2997ff] border-black/20 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer active:scale-90 transition-transform duration-100 touch-manipulation align-middle"
                        title="Chọn tất cả mục để thao tác hàng loạt"
                      />
                    </th>
                    <th className="w-10 px-2 py-3.5 text-center whitespace-nowrap" aria-label="Đánh dấu yêu thích" title="Đánh dấu yêu thích">⭐</th>
                    <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px] max-w-[220px] text-[#1d1d1f] dark:text-white font-bold">Tên Hạng Mục</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] text-[#1d1d1f] dark:text-white font-bold">Đường Dẫn</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[110px] text-[#1d1d1f] dark:text-white font-bold">Danh Mục</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] max-w-[240px] text-[#1d1d1f] dark:text-white font-bold">Ghi Chú</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap w-[96px] min-w-[96px] text-[#1d1d1f] dark:text-white font-bold">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                  {loading ? (
                    <TableSkeleton colSpan={7} rows={6} />
                  ) : filteredLinks.length > 0 ? (
                    filteredLinks.map((item) => (
                      <LinkTableRow
                        key={item.id}
                        item={item}
                        isDragged={draggedId === item.id}
                        isDragOver={dragOverId === item.id}
                        dropPosition={dropPosition}
                        copiedKey={copiedKey}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={onToggleSelect}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onDragEnd={onDragEnd}
                        onToggleFavorite={onToggleFavorite}
                        onCopy={onCopy}
                        onEdit={onEditLink}
                        onDelete={onDeleteLink}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 px-4">
                        <EmptyState
                          icon={<SFLink size={20} />}
                          title={search ? 'Không tìm thấy kết quả' : 'Chưa có link nào'}
                          description={search ? 'Thử tìm với từ khoá khác hoặc xóa bộ lọc' : 'Nhấn «Thêm Link» hoặc nhập từ file Excel để bắt đầu'}
                          actionLabel={!search ? 'Thêm Link đầu tiên' : 'Xóa bộ lọc'}
                          onAction={!search ? onOpenAdd : onClearSearch}
                          secondaryActionLabel={!search ? 'Nhập từ Excel' : undefined}
                          onSecondaryAction={!search ? openImportModal : undefined}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. SHEET: ACCOUNT VAULT */}
          <div className={activeTab === 'accounts' ? `${animationClass} block` : 'hidden'}>
            <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
              <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-white">
                <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <tr>
                    <th className="w-10 px-2 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={filteredAccounts.length > 0 && selectedIds.size === filteredAccounts.length}
                        onChange={onSelectAll}
                        className="w-4 h-4 rounded text-[#0066cc] dark:text-[#2997ff] border-black/20 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer active:scale-90 transition-transform duration-100 touch-manipulation align-middle"
                        title="Chọn tất cả mục để thao tác hàng loạt"
                      />
                    </th>
                    <th className="px-4 py-3.5 whitespace-nowrap min-w-[120px] max-w-[160px] text-[#1d1d1f] dark:text-white font-bold">Phần Mềm</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] max-w-[210px] text-[#1d1d1f] dark:text-white font-bold">Tên Đăng Nhập</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[150px] max-w-[220px] text-[#1d1d1f] dark:text-white font-bold">Mật Khẩu</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] text-[#1d1d1f] dark:text-white font-bold">Trang Đăng Nhập</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[120px] max-w-[240px] text-[#1d1d1f] dark:text-white font-bold">Ghi Chú</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap w-[96px] min-w-[96px] text-[#1d1d1f] dark:text-white font-bold">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                  {loading ? (
                    <TableSkeleton colSpan={7} rows={6} />
                  ) : filteredAccounts.length > 0 ? (
                    filteredAccounts.map((item) => (
                      <AccountTableRow
                        key={item.id}
                        item={item}
                        isDragged={draggedId === item.id}
                        isDragOver={dragOverId === item.id}
                        dropPosition={dropPosition}
                        copiedKey={copiedKey}
                        showPassword={!!showPasswordMap[item.id]}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={onToggleSelect}
                        onTogglePassword={onTogglePassword}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onDragEnd={onDragEnd}
                        onCopy={onCopy}
                        onEdit={onEditAccount}
                        onDelete={onDeleteAccount}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 px-4">
                        <EmptyState
                          icon={<SFShieldFill size={20} />}
                          title={search ? 'Không tìm thấy tài khoản nào' : 'Chưa có tài khoản nào'}
                          description={search ? 'Thử tìm với từ khoá khác hoặc xóa bộ lọc' : 'Lưu trữ thông tin đăng nhập và mật khẩu an toàn trên thiết bị'}
                          actionLabel={!search ? 'Thêm Tài khoản' : 'Xóa bộ lọc'}
                          onAction={!search ? onOpenAdd : onClearSearch}
                          secondaryActionLabel={!search ? 'Nhập từ Excel' : undefined}
                          onSecondaryAction={!search ? openImportModal : undefined}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. SHEET: STORE DIRECTORY */}
          <div className={activeTab === 'stores' ? `${animationClass} block` : 'hidden'}>
            <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
              <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-white">
                <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <tr>
                    <th className="w-10 px-2 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={filteredStores.length > 0 && selectedIds.size === filteredStores.length}
                        onChange={onSelectAll}
                        className="w-4 h-4 rounded text-[#0066cc] dark:text-[#2997ff] border-black/20 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer active:scale-90 transition-transform duration-100 touch-manipulation align-middle"
                        title="Chọn tất cả mục để thao tác hàng loạt"
                      />
                    </th>
                    <th className="px-4 py-3.5 whitespace-nowrap min-w-[100px] text-[#1d1d1f] dark:text-white font-bold">Mã Cửa Hàng</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[240px] max-w-[550px] text-[#1d1d1f] dark:text-white font-bold">Địa Chỉ Cửa Hàng</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[110px] text-[#1d1d1f] dark:text-white font-bold">Khu Vực / Loại</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] text-[#1d1d1f] dark:text-white font-bold">Google Maps</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap w-[96px] min-w-[96px] text-[#1d1d1f] dark:text-white font-bold">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                  {loading ? (
                    <TableSkeleton colSpan={6} rows={6} />
                  ) : filteredStores.length > 0 ? (
                    filteredStores.map((item) => (
                      <StoreTableRow
                        key={item.id}
                        item={item}
                        isDragged={draggedId === item.id}
                        isDragOver={dragOverId === item.id}
                        dropPosition={dropPosition}
                        copiedKey={copiedKey}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={onToggleSelect}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onDragEnd={onDragEnd}
                        onCopy={onCopy}
                        onPreviewMap={onPreviewMapStore}
                        onEdit={onEditStore}
                        onDelete={onDeleteStore}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 px-4">
                        <EmptyState
                          icon={<SFStorefront size={20} />}
                          title={search ? 'Không tìm thấy cửa hàng nào' : 'Chưa có cửa hàng nào'}
                          description={search ? 'Thử tìm theo mã CH, địa chỉ hoặc quận/huyện' : 'Danh sách hệ thống cửa hàng và vị trí Google Maps'}
                          actionLabel={!search ? 'Thêm Cửa hàng' : 'Xóa bộ lọc'}
                          onAction={!search ? onOpenAdd : onClearSearch}
                          secondaryActionLabel={!search ? 'Nhập từ Excel' : undefined}
                          onSecondaryAction={!search ? openImportModal : undefined}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
