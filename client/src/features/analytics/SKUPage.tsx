import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  SearchInput,
  Drawer,
  EmptyState,
  Spinner
} from '@/components/ui';
import { Boxes, Eye, RefreshCw, TrendingUp, Package, DollarSign } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { formatCurrency } from '@/lib/utils';

export const SKUPage: React.FC = () => {
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchSkuData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/sku-performance');
      if (res.data?.data) {
        setSkus(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkuData();
  }, []);

  const filtered = search
    ? skus.filter(
        (s) =>
          s.sku_code?.toLowerCase().includes(search.toLowerCase()) ||
          s.product_name?.toLowerCase().includes(search.toLowerCase())
      )
    : skus;

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
      accessorKey: 'category_name',
      header: 'Ngành Hàng',
      cell: ({ row }) => <span className="text-slate-500">{row.original.category_name || 'Rau củ'}</span>
    },
    {
      accessorKey: 'total_sold_qty',
      header: 'SL Đã Bán',
      cell: ({ row }) => (
        <span className="font-bold">{row.original.total_sold_qty?.toLocaleString() || 0}</span>
      )
    },
    {
      accessorKey: 'total_revenue',
      header: 'Tổng Doanh Thu',
      cell: ({ row }) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {formatCurrency(row.original.total_revenue || 0)}
        </span>
      )
    },
    {
      accessorKey: 'velocity',
      header: 'Tốc Độ Tiêu Thụ',
      cell: ({ row }) => {
        const qty = row.original.total_sold_qty || 0;
        let variant: any = 'default';
        let label = 'Bình thường';

        if (qty >= 100) {
          variant = 'success';
          label = 'Bán chạy (Fast)';
        } else if (qty <= 10) {
          variant = 'warning';
          label = 'Chậm (Slow)';
        }

        return <Badge variant={variant} size="sm">{label}</Badge>;
      }
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedSku(row.original);
            setDrawerOpen(true);
          }}
          icon={<Eye className="w-3.5 h-3.5" />}
        >
          Chi tiết
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
            <Boxes className="w-5 h-5 text-teal-600" />
            <span>Phân tích Hiệu quả SKU (SKU Analysis)</span>
          </h2>
          <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
            Xếp hạng sản phẩm theo doanh số, tốc độ tiêu thụ (Velocity) và hiệu quả luân chuyển
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px]">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchSkuData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="w-full sm:w-80">
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Tìm mã SKU hoặc tên hàng..."
        />
      </div>

      {/* Main Table */}
      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Bảng Xếp Hạng SKU</h3>
          <Badge variant="default" size="sm">
            {filtered.length} sản phẩm
          </Badge>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={loading}
            emptyTitle="Không có dữ liệu SKU"
            emptyDescription="Hãy tải lên tệp giao dịch bán hàng hoặc danh mục sản phẩm tại Trung tâm dữ liệu."
          />
        </div>
      </div>

      {/* SKU Detail Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Chi tiết Sản phẩm: ${selectedSku?.product_name}`}
        description={`Mã SKU: ${selectedSku?.sku_code}`}
        width="md"
      >
        {selectedSku && (
          <div className="space-y-5 text-xs">
            <div className="glass-material p-4 rounded-[16px] space-y-2">
              <p className="text-[#76767b] dark:text-[#a1a1a6] text-[11px]">Doanh số ghi nhận</p>
              <p className="text-xl font-bold text-teal-600">
                {formatCurrency(selectedSku.total_revenue || 0)}
              </p>
              <p className="text-[#76767b] dark:text-[#a1a1a6]">
                Tổng sản lượng bán: <strong className="text-[#1d1d1f] dark:text-white">{selectedSku.total_sold_qty || 0} đơn vị</strong>
              </p>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-[#1d1d1f] dark:text-white uppercase tracking-wider text-[11px]">
                Thông số bổ sung:
              </h5>
              <div className="glass-material p-3 rounded-[12px] space-y-1">
                <p>Ngành hàng: <strong className="text-[#1d1d1f] dark:text-white">{selectedSku.category_name || 'Mặc định'}</strong></p>
                <p>Đơn vị tính: <strong className="text-[#1d1d1f] dark:text-white">Cái / Hộp / Gói</strong></p>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
