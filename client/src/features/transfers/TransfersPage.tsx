import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  EmptyState,
  Spinner,
  Tabs
} from '@/components/ui';
import {
  ArrowLeftRight,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Truck,
  Plus,
  RefreshCw,
  Clock,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ColumnDef } from '@tanstack/react-table';

export const TransfersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'history'>('suggestions');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Transfer Modal from Suggestion
  const [createModal, setCreateModal] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<any | null>(null);
  const [transferQty, setTransferQty] = useState<number>(0);
  const [transferNotes, setTransferNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/transfers/suggestions');
      if (res.data?.data) {
        setSuggestions(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/transfers');
      if (res.data?.data) {
        setTransfers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'suggestions') {
      fetchSuggestions();
    } else {
      fetchTransfers();
    }
  }, [activeTab]);

  const openQuickCreate = (sug: any) => {
    setActiveSuggestion(sug);
    setTransferQty(sug.suggested_qty);
    setTransferNotes(`Điều chuyển cân đối kho: ${sug.reason}`);
    setCreateModal(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSuggestion) return;

    try {
      setCreating(true);
      await api.post('/transfers', {
        from_store_id: activeSuggestion.from_store_id,
        to_store_id: activeSuggestion.to_store_id,
        notes: transferNotes,
        items: [
          {
            product_id: activeSuggestion.product_id,
            quantity: transferQty,
            reason: activeSuggestion.reason
          }
        ]
      });
      toast.success('Đã tạo lệnh điều chuyển thành công!');
      setCreateModal(false);
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo yêu cầu điều chuyển.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/transfers/${id}/status`, { status });
      toast.success(`Đã cập nhật trạng thái điều chuyển sang "${status}". Tồn kho đã được đồng bộ tự động.`);
      fetchTransfers();
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái.');
    }
  };

  const transferColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'transfer_number',
      header: 'Số Phiếu',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
          {row.original.transfer_number}
        </span>
      )
    },
    {
      accessorKey: 'from_store',
      header: 'Kho Xuất (Đi)',
      cell: ({ row }) => <span className="font-medium">{row.original.from_store}</span>
    },
    {
      accessorKey: 'to_store',
      header: 'Kho Nhận (Đến)',
      cell: ({ row }) => <span className="font-medium">{row.original.to_store}</span>
    },
    {
      accessorKey: 'item_count',
      header: 'Số Mặt Hàng',
      cell: ({ row }) => <span>{row.original.item_count || 1} SKU</span>
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: ({ row }) => {
        const st = row.original.status;
        const map: Record<string, any> = {
          draft: { v: 'default', label: 'Bản nháp' },
          submitted: { v: 'info', label: 'Chờ duyệt' },
          approved: { v: 'purple', label: 'Đã duyệt' },
          in_transit: { v: 'warning', label: 'Đang vận chuyển' },
          received: { v: 'success', label: 'Đã nhập kho đích' },
          cancelled: { v: 'danger', label: 'Đã hủy' }
        };
        const conf = map[st] || { v: 'default', label: st };
        return <Badge variant={conf.v} size="sm" dot>{conf.label}</Badge>;
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Ngày Tạo',
      cell: ({ row }) => (
        <span className="text-slate-400 text-xs">
          {new Date(row.original.created_at).toLocaleDateString('vi-VN')}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Hành Động',
      cell: ({ row }) => {
        const st = row.original.status;
        return (
          <div className="flex items-center gap-1.5">
            {st === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus(row.original.id, 'in_transit')}
              >
                Bắt đầu xuất kho
              </Button>
            )}
            {st === 'in_transit' && (
              <Button
                variant="success"
                size="sm"
                onClick={() => handleUpdateStatus(row.original.id, 'received')}
              >
                Xác nhận đã nhận hàng
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-teal-600" />
            <span>Điều chuyển & Cân đối Tồn kho (Stock Balancing)</span>
          </h2>
          <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
            Tự động tìm kiếm cơ hội cân đối hàng giữa các điểm bán: chuyển từ kho thừa sang kho thiếu để tối ưu vốn lưu động
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px]">
          <Button
            variant="glass"
            size="sm"
            onClick={() => (activeTab === 'suggestions' ? fetchSuggestions() : fetchTransfers())}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'suggestions', label: 'Gợi ý Cân đối Thông minh', badge: suggestions.length },
          { id: 'history', label: 'Danh sách Lệnh Điều chuyển' }
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* TAB 1: SUGGESTIONS */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {suggestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="glass-material-interactive rounded-[22px] p-5 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#1d1d1f] dark:text-white block">
                        {sug.product_name}
                      </span>
                      <span className="font-mono text-xs text-teal-600 font-semibold">{sug.sku_code}</span>
                    </div>
                    <Badge variant="purple" size="sm">
                      Đề xuất chuyển: {sug.suggested_qty} cái
                    </Badge>
                  </div>

                  {/* Visual Route */}
                  <div className="glass-material rounded-[14px] grid grid-cols-2 gap-3 p-3 text-xs">
                    <div>
                      <span className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] block">Kho xuất (Dư thừa)</span>
                      <span className="font-bold text-[#1d1d1f] dark:text-white">{sug.from_store_name}</span>
                      <p className="text-[#76767b] text-[11px] mt-0.5">
                        Tồn: {sug.from_stock} (~{sug.from_doc} ngày)
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] block">Kho nhận (Thiếu hụt)</span>
                      <span className="font-bold text-[#1d1d1f] dark:text-white">{sug.to_store_name}</span>
                      <p className="text-rose-600 text-[11px] mt-0.5 font-medium">
                        Tồn: {sug.to_stock} (~{sug.to_doc} ngày)
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed">
                    {sug.reason}
                  </p>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="glassProminent"
                      size="sm"
                      onClick={() => openQuickCreate(sug)}
                      icon={<Truck className="w-3.5 h-3.5" />}
                    >
                      Tạo phiếu điều chuyển ngay
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-material rounded-[22px] p-12">
              <EmptyState
                title="Tồn kho các cửa hàng đang ở trạng thái cân bằng"
                description="Thuật toán không phát hiện cặp cửa hàng nào có độ lệch tồn kho quá lớn cần điều chuyển."
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-material rounded-[22px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/20 dark:border-white/10">
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Lịch sử Lệnh Điều chuyển</h3>
          </div>
          <div className="p-2">
            <DataTable
              columns={transferColumns}
              data={transfers}
              isLoading={loading}
              emptyTitle="Chưa có lệnh điều chuyển nào"
              emptyDescription="Các lệnh điều chuyển được tạo từ tab Gợi ý hoặc thủ công sẽ hiển thị ở đây."
            />
          </div>
        </div>
      )}

      {/* Quick Create Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Tạo Phiếu Điều Chuyển Hàng Hóa"
        description="Xác nhận số lượng và tạo phiếu chuyển kho tự động"
        size="md"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          <div className="glass-material p-3.5 rounded-[14px] space-y-1 text-xs">
            <p className="font-semibold text-[#1d1d1f] dark:text-white">
              {activeSuggestion?.product_name} ({activeSuggestion?.sku_code})
            </p>
            <p className="text-[#76767b] dark:text-[#a1a1a6]">
              Xuất từ: <strong>{activeSuggestion?.from_store_name}</strong> → Nhập vào: <strong>{activeSuggestion?.to_store_name}</strong>
            </p>
          </div>

          <Input
            label="Số lượng điều chuyển"
            type="number"
            min="1"
            max={activeSuggestion?.from_stock || 9999}
            value={transferQty}
            onChange={(e) => setTransferQty(Number(e.target.value))}
            required
          />

          <Input
            label="Ghi chú điều chuyển"
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-white/20 dark:border-white/10">
            <Button variant="glass" size="sm" type="button" onClick={() => setCreateModal(false)}>
              Hủy
            </Button>
            <Button variant="glassProminent" size="sm" type="submit" loading={creating}>
              Tạo phiếu chuyển kho
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

