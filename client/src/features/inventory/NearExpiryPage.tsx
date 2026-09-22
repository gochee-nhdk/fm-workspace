import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Alert,
  EmptyState,
  Spinner
} from '@/components/ui';
import {
  Clock,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  ArrowLeftRight
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';

export const NearExpiryPage: React.FC = () => {
  const [expiryLots, setExpiryLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchExpiryLots = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/near-expiry');
      if (res.data?.data) {
        setExpiryLots(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryLots();
  }, []);

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
      accessorKey: 'lot_number',
      header: 'Số Lô',
      cell: ({ row }) => <span className="font-mono text-slate-500">{row.original.lot_number}</span>
    },
    {
      accessorKey: 'quantity',
      header: 'Số Lượng Tại Kho',
      cell: ({ row }) => (
        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
          {row.original.quantity} cái
        </span>
      )
    },
    {
      accessorKey: 'expiry_date',
      header: 'Hạn Sử Dụng (HSD)',
      cell: ({ row }) => (
        <span className="font-semibold">
          {new Date(row.original.expiry_date).toLocaleDateString('vi-VN')}
        </span>
      )
    },
    {
      accessorKey: 'days_remaining',
      header: 'Số Ngày Còn Lại',
      cell: ({ row }) => {
        const days = row.original.days_remaining;
        let variant: any = 'default';
        let label = `${days} ngày`;

        if (days <= 0) {
          variant = 'danger';
          label = 'ĐÃ HẾT HẠN';
        } else if (days <= 3) {
          variant = 'danger';
        } else if (days <= 7) {
          variant = 'warning';
        } else {
          variant = 'info';
        }

        return (
          <Badge variant={variant} size="sm" dot>
            {label}
          </Badge>
        );
      }
    },
    {
      id: 'recommendation',
      header: 'Khuyến Nghị Xử Lý',
      cell: ({ row }) => {
        const days = row.original.days_remaining;
        if (days <= 0) {
          return <span className="text-rose-600 font-medium">Hủy bỏ / Tiêu hủy</span>;
        } else if (days <= 3) {
          return <span className="text-rose-600 font-medium">Giảm giá 30-50% đẩy bán ngay</span>;
        } else if (days <= 7) {
          return <span className="text-amber-600 font-medium">Ưu tiên trưng bày & dừng PO mới</span>;
        } else {
          return <span className="text-slate-500">Theo dõi tốc độ bán</span>;
        }
      }
    }
  ];

  const criticalCount = expiryLots.filter((l) => l.days_remaining <= 3).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-500" />
            <span>Kiểm soát Hàng Cận Date (Short-Date / Near-Expiry)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Phát hiện sớm các lô hàng có nguy cơ hết hạn sử dụng để chủ động đẩy bán hoặc điều chuyển kho
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px]">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchExpiryLots}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {criticalCount > 0 && (
        <Alert
          type="error"
          title="Cảnh báo hàng cực cận date"
          message={`Có ${criticalCount} lô hàng có hạn sử dụng còn lại dưới 3 ngày. Khuyến nghị dừng ngay các đơn đặt hàng mới cho các mặt hàng này và tiến hành giảm giá kích cầu tại điểm bán.`}
        />
      )}

      {/* Main Table */}
      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Danh sách các Lô Hàng Đang Theo Dõi Hạn Dùng</h3>
          <Badge variant={criticalCount > 0 ? 'danger' : 'default'} size="sm">
            {expiryLots.length} lô hàng
          </Badge>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={expiryLots}
            isLoading={loading}
            emptyTitle="Không có lô hàng cận date nào"
            emptyDescription="Tất cả các sản phẩm trong kho hiện tại đều có hạn dùng an toàn hoặc chưa ghi nhận số lô."
          />
        </div>
      </div>
    </div>
  );
};
