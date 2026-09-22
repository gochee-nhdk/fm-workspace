import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  SearchInput,
  Spinner,
  EmptyState
} from '@/components/ui';
import {
  Package,
  RefreshCw,
  Edit,
  AlertTriangle,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ColumnDef } from '@tanstack/react-table';

export const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Adjustment Modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [availQty, setAvailQty] = useState<number>(0);
  const [damagedQty, setDamagedQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Kiểm kê định kỳ');
  const [adjusting, setAdjusting] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedStore) params.store_id = selectedStore;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/inventory', { params });
      if (res.data?.data) {
        setInventory(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores');
      if (res.data?.data) setStores(res.data.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [selectedStore, searchTerm]);

  const openAdjust = (item: any) => {
    setSelectedItem(item);
    setAvailQty(item.available_qty);
    setDamagedQty(item.damaged_qty || 0);
    setAdjustModal(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      setAdjusting(true);
      await api.put(`/inventory/${selectedItem.id}`, {
        available_qty: availQty,
        damaged_qty: damagedQty,
        reason: adjustReason
      });
      toast.success('Đã điều chỉnh số lượng tồn kho thành công!');
      setAdjustModal(false);
      fetchInventory();
    } catch (err: any) {
      toast.error('Lỗi khi điều chỉnh số lượng.');
    } finally {
      setAdjusting(false);
    }
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
      header: 'Kho / Cửa Hàng',
      cell: ({ row }) => <span>{row.original.store_name}</span>
    },
    {
      accessorKey: 'available_qty',
      header: 'Tồn Khả Dụng',
      cell: ({ row }) => (
        <span className="font-bold text-sm">
          {row.original.available_qty?.toLocaleString()} {row.original.unit || ''}
        </span>
      )
    },
    {
      accessorKey: 'ads',
      header: 'Tốc độ bán (ADS)',
      cell: ({ row }) => (
        <span className="text-slate-500 font-medium">
          {row.original.ads} cái/ngày
        </span>
      )
    },
    {
      accessorKey: 'days_of_cover',
      header: 'Số Ngày Bán (DoC)',
      cell: ({ row }) => {
        const doc = row.original.days_of_cover;
        return (
          <span className="font-semibold">
            {doc === 'N/A' ? 'N/A' : `${doc} ngày`}
          </span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Tình Trạng Tồn',
      cell: ({ row }) => {
        const s = row.original.status;
        const badges: Record<string, { variant: any; label: string }> = {
          out_of_stock: { variant: 'danger', label: 'Hết hàng (OOS)' },
          critical: { variant: 'danger', label: 'Nguy cấp (≤3 ngày)' },
          warning: { variant: 'warning', label: 'Sắp thiếu (≤7 ngày)' },
          healthy: { variant: 'success', label: 'Khỏe mạnh' },
          overstock: { variant: 'purple', label: 'Tồn dư (≥35 ngày)' }
        };
        const config = badges[s] || { variant: 'default', label: s };
        return (
          <Badge variant={config.variant} size="sm" dot>
            {config.label}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openAdjust(row.original)}
          title="Điều chỉnh tồn kho"
        >
          <Edit className="w-3.5 h-3.5 text-slate-500" />
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
            <Package className="w-5 h-5 text-teal-600" />
            <span>Quản lý Tồn kho Toàn hệ thống</span>
          </h2>
          <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
            Theo dõi tồn khả dụng, tốc độ tiêu thụ hàng ngày (ADS) và số ngày bán dự kiến (Days of Cover)
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px] flex items-center gap-1.5">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchInventory}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-container p-3.5 rounded-[20px] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <SearchInput
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            placeholder="Tìm theo mã SKU hoặc tên sản phẩm..."
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="text-xs rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm py-2 pl-3 pr-8 focus:ring-teal-500 w-full sm:w-48 text-[#1d1d1f] dark:text-white cursor-pointer transition-all"
          >
            <option value="">-- Tất cả cửa hàng --</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Bảng Số liệu Tồn kho</h3>
          <Badge variant="default" size="sm">
            {inventory.length} mặt hàng
          </Badge>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={inventory}
            isLoading={loading}
            emptyTitle="Không có dữ liệu tồn kho"
            emptyDescription="Hãy tải lên tệp tồn kho tại Trung tâm dữ liệu để hiển thị bảng này."
          />
        </div>
      </div>

      {/* Adjustment Modal */}
      <Modal
        isOpen={adjustModal}
        onClose={() => setAdjustModal(false)}
        title="Điều chỉnh Số lượng Tồn kho"
        description={`Cập nhật cho sản phẩm: ${selectedItem?.product_name} (${selectedItem?.sku_code})`}
        size="md"
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tồn khả dụng (Có thể bán)"
              type="number"
              min="0"
              value={availQty}
              onChange={(e) => setAvailQty(Number(e.target.value))}
              required
            />
            <Input
              label="Tồn hư hỏng / Chờ thanh lý"
              type="number"
              min="0"
              value={damagedQty}
              onChange={(e) => setDamagedQty(Number(e.target.value))}
            />
          </div>

          <Input
            label="Lý do điều chỉnh (Lưu vào nhật ký kiểm toán)"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder="Ví dụ: Bù trừ sau kiểm kê cuối tháng"
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-white/20 dark:border-white/10">
            <Button variant="glass" size="sm" type="button" onClick={() => setAdjustModal(false)}>
              Hủy
            </Button>
            <Button variant="glassProminent" size="sm" type="submit" loading={adjusting}>
              Lưu điều chỉnh
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

