import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Drawer,
  EmptyState,
  Spinner,
  Alert
} from '@/components/ui';
import {
  ShoppingCart,
  Sparkles,
  CheckCircle,
  XCircle,
  Calculator,
  RefreshCw,
  PlusCircle,
  Info,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ColumnDef } from '@tanstack/react-table';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export const ProcurementPlanningPage: React.FC = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedRec, setSelectedRec] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/procurement/recommendations');
      if (res.data?.data) {
        setRecommendations(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/procurement/recommendations/generate');
      toast.success(res.data?.message || 'Đã tính toán xong các gợi ý đặt hàng!');
      fetchRecommendations();
    } catch (err: any) {
      toast.error('Lỗi khi chạy thuật toán tính toán đặt hàng.');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      await api.put(`/procurement/recommendations/${id}`, { status: newStatus });
      toast.success(newStatus === 'approved' ? 'Đã duyệt gợi ý đặt hàng.' : 'Đã từ chối gợi ý.');
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái.');
    }
  };

  const handleCreatePOFromApproved = () => {
    const approved = recommendations.filter((r) => r.status === 'approved');
    if (approved.length === 0) {
      toast.error('Vui lòng duyệt ít nhất 1 khuyến nghị trước khi tạo đơn đặt hàng.');
      return;
    }
    // Navigate to PO creation with approved items prefilled
    navigate('/procurement/orders', { state: { createFromRecommendations: approved } });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'sku_code',
      header: 'Mã SKU',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
          {row.original.sku_code}
        </span>
      )
    },
    {
      accessorKey: 'product_name',
      header: 'Tên Sản Phẩm',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {row.original.product_name}
        </span>
      )
    },
    {
      accessorKey: 'store_name',
      header: 'Điểm Bán',
      cell: ({ row }) => <span>{row.original.store_name}</span>
    },
    {
      accessorKey: 'current_stock',
      header: 'Tồn Khả Dụng',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.current_stock?.toLocaleString() || 0}
        </span>
      )
    },
    {
      accessorKey: 'recommended_qty',
      header: 'Số Lượng Gợi Ý',
      cell: ({ row }) => (
        <span className="font-bold text-teal-700 dark:text-teal-300 text-sm">
          {row.original.recommended_qty?.toLocaleString()}
        </span>
      )
    },
    {
      accessorKey: 'reason',
      header: 'Lý Do Đặt Hàng',
      cell: ({ row }) => (
        <span className="text-slate-500 max-w-xs truncate block text-[11px]" title={row.original.reason}>
          {row.original.reason}
        </span>
      )
    },
    {
      accessorKey: 'risk_level',
      header: 'Rủi Ro',
      cell: ({ row }) => {
        const lvl = row.original.risk_level;
        return (
          <Badge
            variant={lvl === 'critical' ? 'danger' : lvl === 'high' ? 'warning' : 'default'}
            size="sm"
          >
            {lvl === 'critical' ? 'Nguy cấp' : lvl === 'high' ? 'Cao' : 'Bình thường'}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: ({ row }) => {
        const st = row.original.status;
        return (
          <Badge
            variant={st === 'approved' ? 'success' : st === 'rejected' ? 'danger' : 'warning'}
            size="sm"
            dot
          >
            {st === 'approved' ? 'Đã duyệt' : st === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedRec(row.original);
              setDrawerOpen(true);
            }}
            title="Xem chi tiết công thức tính toán"
          >
            <Calculator className="w-3.5 h-3.5 text-slate-500" />
          </Button>

          {row.original.status === 'pending' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleStatusChange(row.original.id, 'approved')}
                title="Duyệt gợi ý"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleStatusChange(row.original.id, 'rejected')}
                title="Từ chối gợi ý"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  let calcData: any = {};
  if (selectedRec?.calculation_data) {
    try {
      calcData = typeof selectedRec.calculation_data === 'string'
        ? JSON.parse(selectedRec.calculation_data)
        : selectedRec.calculation_data;
    } catch (e) {}
  }

  const approvedCount = recommendations.filter((r) => r.status === 'approved').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-teal-600" />
            <span>Kế hoạch Đặt hàng (Purchase Recommendations)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Các gợi ý bổ sung hàng hóa được tính toán minh bạch từ Tồn kho, ADS, Lead Time và MOQ
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px] flex items-center gap-1.5">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchRecommendations}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
          <Button
            variant="glassProminent"
            size="sm"
            onClick={handleGenerate}
            loading={generating}
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            Tính toán gợi ý mới
          </Button>
          {approvedCount > 0 && (
            <Button
              variant="success"
              size="sm"
              onClick={handleCreatePOFromApproved}
              icon={<PlusCircle className="w-3.5 h-3.5" />}
            >
              Tạo đơn PO ({approvedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Danh sách Đề xuất Đặt hàng</h3>
          <div className="flex items-center gap-2">
            <Badge variant="default" size="sm">
              Tổng số: {recommendations.length} gợi ý
            </Badge>
            {approvedCount > 0 && (
              <Badge variant="success" size="sm">
                Đã duyệt: {approvedCount}
              </Badge>
            )}
          </div>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={recommendations}
            isLoading={loading}
            emptyTitle="Chưa có gợi ý đặt hàng nào"
            emptyDescription="Bấm 'Tính toán gợi ý mới' để hệ thống quét toàn bộ số liệu tồn kho và tốc độ bán hàng hiện tại."
          />
        </div>
      </div>

      {/* Calculation Transparency Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Minh bạch Công thức Tính toán (Calculation Breakdown)"
        description={`Chi tiết căn cứ ra quyết định cho SKU: ${selectedRec?.sku_code}`}
        width="lg"
      >
        {selectedRec && (
          <div className="space-y-5 text-xs">
            {/* Product Summary */}
            <div className="glass-material p-4 rounded-[16px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1d1d1f] dark:text-white">
                  {selectedRec.product_name}
                </span>
                <Badge variant="info" size="sm">{selectedRec.sku_code}</Badge>
              </div>
              <p className="text-[#76767b] dark:text-[#a1a1a6]">Cửa hàng / Điểm bán: <strong>{selectedRec.store_name}</strong></p>
              <p className="text-[#76767b] dark:text-[#a1a1a6]">Nhà cung cấp: <strong>{selectedRec.supplier_name || 'Mặc định'}</strong></p>
            </div>

            {/* Formula Breakdown Cards */}
            <div className="space-y-3">
              <h5 className="font-bold text-[#1d1d1f] dark:text-white uppercase tracking-wider text-[11px]">
                Các thông số đầu vào:
              </h5>

              <div className="grid grid-cols-2 gap-3">
                <div className="glass-material p-3 rounded-[12px]">
                  <span className="text-[#76767b] dark:text-[#a1a1a6] block text-[11px]">Tốc độ bán hàng ngày (ADS)</span>
                  <span className="text-sm font-bold text-[#1d1d1f] dark:text-white">
                    {calcData.avgDailySales !== undefined ? Number(calcData.avgDailySales).toFixed(2) : '-'} cái/ngày
                  </span>
                </div>

                <div className="glass-material p-3 rounded-[12px]">
                  <span className="text-[#76767b] dark:text-[#a1a1a6] block text-[11px]">Tồn kho hiện tại</span>
                  <span className="text-sm font-bold text-[#1d1d1f] dark:text-white">
                    {selectedRec.current_stock ?? 0} cái
                  </span>
                </div>

                <div className="glass-material p-3 rounded-[12px]">
                  <span className="text-[#76767b] dark:text-[#a1a1a6] block text-[11px]">Thời gian giao hàng (Lead Time)</span>
                  <span className="text-sm font-bold text-[#1d1d1f] dark:text-white">
                    {calcData.leadTimeDays ?? 2} ngày
                  </span>
                </div>

                <div className="glass-material p-3 rounded-[12px]">
                  <span className="text-[#76767b] dark:text-[#a1a1a6] block text-[11px]">Số ngày tồn an toàn (Safety Days)</span>
                  <span className="text-sm font-bold text-[#1d1d1f] dark:text-white">
                    {calcData.safetyDays ?? 3} ngày
                  </span>
                </div>

                <div className="glass-material p-3 rounded-[12px]">
                  <span className="text-[#76767b] dark:text-[#a1a1a6] block text-[11px]">Chu kỳ xem xét đặt hàng</span>
                  <span className="text-sm font-bold text-[#1d1d1f] dark:text-white">
                    {calcData.reviewPeriod ?? 7} ngày
                  </span>
                </div>

                <div className="glass-material p-3 rounded-[12px]">
                  <span className="text-[#76767b] dark:text-[#a1a1a6] block text-[11px]">Số lượng đặt tối thiểu (MOQ)</span>
                  <span className="text-sm font-bold text-[#1d1d1f] dark:text-white">
                    {calcData.moq ?? 1} cái
                  </span>
                </div>
              </div>
            </div>

            {/* Formula Explanation */}
            <div className="p-4 rounded-[16px] border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 space-y-2">
              <h5 className="font-bold text-teal-800 dark:text-teal-300">Công thức xác định số lượng đặt:</h5>
              <p className="text-[#76767b] dark:text-[#a1a1a6] leading-relaxed font-mono text-[11px]">
                Target Stock = ADS × (Lead Time + Review Period + Safety Days)<br />
                Reorder Point = (ADS × Lead Time) + Safety Stock<br />
                Suggested Order = Max(0, Target Stock - Current Stock) rounded by MOQ
              </p>
              <div className="pt-2 border-t border-teal-200/60 dark:border-teal-800 flex justify-between font-bold">
                <span>Số lượng đề xuất cuối cùng:</span>
                <span className="text-teal-700 dark:text-teal-300 text-sm">
                  {selectedRec.recommended_qty} cái
                </span>
              </div>
            </div>

            {/* Actions in drawer */}
            <div className="pt-4 flex justify-end gap-2 border-t border-white/20 dark:border-white/10">
              <Button
                variant="glass"
                size="sm"
                onClick={() => handleStatusChange(selectedRec.id, 'rejected')}
              >
                Từ chối
              </Button>
              <Button
                variant="glassProminent"
                size="sm"
                onClick={() => {
                  handleStatusChange(selectedRec.id, 'approved');
                  setDrawerOpen(false);
                }}
              >
                Phê duyệt gợi ý này
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

