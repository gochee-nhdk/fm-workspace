import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  Plus,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Filter,
  FileSpreadsheet,
  Lock,
  Globe,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { AccountItem } from '@/types/workspace';
import { AccountDrawerForm } from '@/components/forms/AccountDrawerForm';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import toast from 'react-hot-toast';

export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSoftware, setSelectedSoftware] = useState<string>('ALL');

  // Set of revealed password IDs (in-memory only!)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Drawer and Dialogs
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountItem | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await dataService.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const softwareList = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.software) set.add(a.software);
    });
    return Array.from(set);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.software.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q));

      const matchesSoftware =
        selectedSoftware === 'ALL' || item.software === selectedSoftware;

      return matchesSearch && matchesSoftware;
    });
  }, [accounts, search, selectedSoftware]);

  const togglePasswordReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) {
      toast.error('Mục này không có dữ liệu');
      return;
    }
    navigator.clipboard.writeText(text);
    if (label.toLowerCase().includes('mật khẩu')) {
      toast.success(`Đã sao chép ${label}! (Bảo mật: Tự hủy sau 45s)`);
      // Enterprise Security: Automatically wipe password from clipboard
      setTimeout(async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const current = await navigator.clipboard.readText();
            if (current === text) {
              await navigator.clipboard.writeText('');
            }
          }
        } catch {
          // Ignore permission denials gracefully
        }
      }, 45000);
    } else {
      toast.success(`Đã sao chép ${label}!`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dataService.deleteAccount(deleteTarget.id);
      toast.success('Đã xóa tài khoản thành công');
      setDeleteTarget(null);
      fetchAccounts();
    } catch (err) {
      toast.error('Lỗi khi xóa tài khoản');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#0066cc] dark:text-[#2997ff]" />
            Account Vault & Quản Lý Thông Tin Đăng Nhập
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#7a7a7a] mt-1 leading-[1.47]">
            Quản lý tài khoản hệ thống SAP, POS, DMS, Bravo và các dịch vụ tác nghiệp bảo mật cao.
          </p>
        </div>

        <div className="glass-container p-1.5 flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => excelService.exportDataset('ACCOUNT')}
            disabled={accounts.length === 0}
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
            Thêm Tài khoản
          </Button>
        </div>
      </div>

      {/* Security notice card */}
      <div className="glass-material p-4 rounded-[20px] flex items-center gap-3.5 shadow-xs ios-animate-in border border-[#0066cc]/20 dark:border-[#2997ff]/20 bg-gradient-to-r from-[#0066cc]/5 via-transparent to-transparent">
        <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#0066cc]/20 to-transparent text-[#0066cc] dark:text-[#2997ff] border border-[#0066cc]/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,102,204,0.15)]">
          <Shield className="w-4 h-4" />
        </div>
        <div className="text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed flex-1">
          <strong className="text-[#0066cc] dark:text-[#2997ff] font-semibold">Private Vault:</strong> Dữ liệu mật khẩu mặc định được mã hóa che giấu dạng •••••••• và lưu trữ cục bộ trong trình duyệt (IndexedDB). Không gửi ra máy chủ công cộng.
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="glass-material p-3.5 sm:p-4 rounded-[22px] flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-xs ios-animate-in ios-stagger-1">
        {/* Search */}
        <div className="relative w-full sm:w-80 group">
          <Search className="w-4 h-4 text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Tìm theo phần mềm, username..."
            className="glass-input w-full text-[13px] rounded-full pl-9 pr-3.5 py-2 placeholder:text-[#86868b]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Software filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] flex items-center gap-1 font-medium">
            <Filter className="w-3.5 h-3.5" /> Phần mềm:
          </span>
          <select
            className="glass-input text-[13px] rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer font-medium"
            value={selectedSoftware}
            onChange={(e) => setSelectedSoftware(e.target.value)}
          >
            <option value="ALL">Tất cả ({accounts.length})</option>
            {softwareList.map((s) => (
              <option key={s} value={s}>
                {s} ({accounts.filter((a) => a.software === s).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts Table or Empty State */}
      {filteredAccounts.length === 0 ? (
        <div className="py-16 text-center rounded-[22px] glass-material p-8 space-y-4">
          <div className="w-13 h-13 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center mx-auto shadow-2xs">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
            {search ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản nào'}
          </h3>
          <p className="text-[14px] text-[#7a7a7a] max-w-sm mx-auto leading-[1.47]">
            {search
              ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc.'
              : 'Lưu trữ tài khoản đầu tiên để không phải tìm kiếm trong nhiều file Excel.'}
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
              Thêm Tài khoản
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
        <div className="glass-material rounded-[22px] overflow-hidden ios-animate-in ios-stagger-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e0e0e0]/70 dark:border-white/10 bg-[#fafafc]/80 dark:bg-[#272729]/80 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">STT</th>
                  <th className="py-3.5 px-4">Phần mềm / Hệ thống</th>
                  <th className="py-3.5 px-4">Tên đăng nhập / Email</th>
                  <th className="py-3.5 px-4">Mật khẩu</th>
                  <th className="py-3.5 px-4">Đường dẫn</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/50 dark:divide-white/5 text-[14px]">
                {filteredAccounts.map((item, idx) => {
                  const isRevealed = revealedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#0066cc]/5 dark:hover:bg-white/5 transition-all duration-200 ios-animate-in ios-stagger-${(idx % 6) + 1}`}
                    >
                      {/* STT */}
                      <td className="py-3.5 px-4 text-center font-mono text-[13px] text-[#7a7a7a]">
                        {item.stt ?? idx + 1}
                      </td>

                      {/* Software */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1d1d1f] dark:text-white">
                          {item.software}
                        </div>
                        {item.note && (
                          <div className="text-[12px] text-[#7a7a7a] truncate max-w-xs mt-0.5">
                            {item.note}
                          </div>
                        )}
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4 font-mono text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        <div className="flex items-center gap-2">
                          <span>{item.username}</span>
                          <button
                            onClick={() => handleCopy(item.username, 'tên đăng nhập')}
                            className="w-7 h-7 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] active:scale-95"
                            title="Sao chép tên đăng nhập"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Password (Masked by default) */}
                      <td className="py-3.5 px-4">
                        {item.password ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="px-3 py-1 rounded-full bg-[#f5f5f7] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 text-[#1d1d1f] dark:text-white select-all text-[13px]">
                              {isRevealed ? item.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordReveal(item.id)}
                              className="w-7 h-7 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] active:scale-95 transition-colors"
                              title={isRevealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                              {isRevealed ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCopy(item.password || '', 'mật khẩu')}
                              className="w-7 h-7 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] active:scale-95 transition-colors"
                              title="Sao chép mật khẩu"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#7a7a7a] italic">
                            Chưa đặt mật khẩu
                          </span>
                        )}
                      </td>

                      {/* Link */}
                      <td className="py-3.5 px-4">
                        {item.link ? (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0066cc] dark:text-[#2997ff] hover:underline max-w-[180px] truncate font-normal"
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.link.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[#cccccc] dark:text-[#7a7a7a]">-</span>
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
                            className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white active:scale-95"
                            title="Sửa tài khoản"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-rose-600 active:scale-95"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      <AccountDrawerForm
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        onSave={async (data) => {
          if (editingItem) {
            await dataService.updateAccount(editingItem.id, data);
          } else {
            await dataService.createAccount(data);
          }
          fetchAccounts();
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa tài khoản?"
        description="Thông tin tài khoản này sẽ bị xóa vĩnh viễn khỏi Workspace."
        itemLabel={`${deleteTarget?.software} (${deleteTarget?.username})`}
      />
    </div>
  );
};
