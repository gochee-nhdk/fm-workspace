import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Drawer,
  Modal,
  Input,
  Select,
  EmptyState,
  Spinner
} from '@/components/ui';
import {
  ClipboardList,
  Plus,
  PackageCheck,
  Eye,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ColumnDef } from '@tanstack/react-table';
import { formatCurrency } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

export const PurchaseOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Goods Receipt Modal
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [receiving, setReceiving] = useState(false);

  // Create PO Modal
  const [createModal, setCreateModal] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [newPOItems, setNewPOItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  const location = useLocation();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/procurement/purchase-orders');
      if (res.data?.data) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [sRes, supRes] = await Promise.all([
        api.get('/stores'),
        api.get('/suppliers')
      ]);
      if (sRes.data?.data) setStores(sRes.data.data);
      if (supRes.data?.data) setSuppliers(supRes.data.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchOrders();
    fetchMeta();

    // Check if redirected from recommendations
    if (location.state?.createFromRecommendations?.length) {
      const recs = location.state.createFromRecommendations;
      setNewPOItems(recs.map((r: any) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        sku_code: r.sku_code,
        ordered_qty: r.recommended_qty || 1,
        unit_price: r.cost_price || 0
      })));
      if (recs[0]?.store_id) setSelectedStore(recs[0].store_id);
      if (recs[0]?.supplier_id) setSelectedSupplier(recs[0].supplier_id);
      setCreateModal(true);
    }
  }, [location.state]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedStore || !newPOItems.length) {
      toast.error('Vui lòng chọn nhà cung cấp, kho nhận và có ít nhất 1 sản phẩm.');
      return;
    }

    try {
      setCreating(true);
      const res = await api.post('/procurement/purchase-orders', {
        supplier_id: selectedSupplier,
        store_id: selectedStore,
        notes: poNotes,
        items: newPOItems
      });

      if (res.data?.success) {
        toast.success(res.data.data?.message || 'Đã tạo đơn đặt hàng thành công!');
        setCreateModal(false);
        setNewPOItems([]);
        setPoNotes('');
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo đơn đặt hàng.');
    } finally {
      setCreating(false);
    }
  };

  const viewPODetail = async (id: string) => {
    try {
      const res = await api.get(`/procurement/purchase-orders/${id}`);
      if (res.data?.data) {
        setSelectedPO(res.data.data);
        setDrawerOpen(true);
      }
    } catch (err) {
      toast.error('Không thể tải chi tiết đơn hàng.');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/procurement/purchase-orders/${id}/status`, { status });
      toast.success(`Đã chuyển trạng thái PO sang ${status}.`);
      fetchOrders();
      if (selectedPO) setSelectedPO({ ...selectedPO, status });
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái đơn hàng.');
    }
  };

  const openReceiveModal = (po: any) => {
    setSelectedPO(po);
    const initialItems = (po.items || []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      ordered_qty: item.ordered_qty,
      received_qty: item.ordered_qty,
      lot_number: `LOT-${Date.now().toString().slice(-6)}`,
      expiry_date: ''
    }));
    setReceiptItems(initialItems);
    setReceiveModal(true);
  };

  const handleExecuteReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    try {
      setReceiving(true);
      await api.post(`/procurement/purchase-orders/${selectedPO.id}/receive`, {
        received_items: receiptItems
      });
      toast.success('Đã nhập kho hàng hóa và cập nhật số lượng tồn kho thành công!');
      setReceiveModal(false);
      setDrawerOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi nhận hàng vào kho.');
    } finally {
      setReceiving(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'po_number',
      header: 'Số PO',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
          {row.original.po_number}
        </span>
      )
    },
    {
      accessorKey: 'supplier_name',
      header: 'Nhà Cung Cấp',
      cell: ({ row }) => <span>{row.original.supplier_name || 'Nhà cung cấp chính'}</span>
    },
    {
      accessorKey: 'store_name',
      header: 'Kho Nhận',
      cell: ({ row }) => <span>{row.original.store_name || 'Kho Tổng'}</span>
    },
    {
      accessorKey: 'total_value',
      header: 'Tổng Giá Trị',
      cell: ({ row }) => (
        <span className="font-bold">{formatCurrency(row.original.total_value || 0)}</span>
      )
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: ({ row }) => {
        const s = row.original.status;
        const variants: Record<string, any> = {
          draft: 'default',
          submitted: 'info',
          approved: 'purple',
          ordered: 'warning',
          received: 'success',
          cancelled: 'danger'
        };
        const labels: Record<string, string> = {
          draft: 'Bản nháp',
          submitted: 'Đã gửi duyệt',
          approved: 'Đã duyệt',
          ordered: 'Đã đặt NCC',
          received: 'Đã nhập kho',
          cancelled: 'Đã hủy'
        };
        return (
          <Badge variant={variants[s] || 'default'} size="sm" dot>
            {labels[s] || s}
          </Badge>
        );
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
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => viewPODetail(row.original.id)}
            icon={<Eye className="w-3.5 h-3.5" />}
          >
            Chi tiết
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            <span>Đơn Đặt Hàng Mua (Purchase Orders)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi vòng đời đơn đặt hàng từ bản nháp, gửi nhà cung cấp đến lúc nhập kho (Goods Receipt)
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px] flex items-center gap-1.5">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchOrders}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
          <Button
            variant="glassProminent"
            size="sm"
            onClick={() => setCreateModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Tạo PO mới
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Danh sách Đơn Đặt Hàng</h3>
          <Badge variant="default" size="sm">
            Tổng số: {orders.length} đơn
          </Badge>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={orders}
            isLoading={loading}
            emptyTitle="Chưa có đơn đặt hàng nào"
            emptyDescription="Các đơn đặt hàng được tạo từ trang Kế hoạch đặt hàng sẽ hiển thị tại đây."
          />
        </div>
      </div>

      {/* PO Detail Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Chi tiết Đơn hàng: ${selectedPO?.po_number}`}
        description="Thông tin chi tiết và danh sách sản phẩm đặt mua"
        width="lg"
      >
        {selectedPO && (
          <div className="space-y-6 text-xs">
            {/* Header info */}
            <div className="glass-material p-4 rounded-[16px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#1d1d1f] dark:text-white">
                  {selectedPO.po_number}
                </span>
                <Badge variant={selectedPO.status === 'received' ? 'success' : 'warning'} size="sm">
                  {selectedPO.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[#76767b] dark:text-[#a1a1a6] pt-1">
                <p>Nhà cung cấp: <strong className="text-[#1d1d1f] dark:text-white">{selectedPO.supplier_name}</strong></p>
                <p>Kho nhận: <strong className="text-[#1d1d1f] dark:text-white">{selectedPO.store_name}</strong></p>
                <p>Người tạo: <strong className="text-[#1d1d1f] dark:text-white">{selectedPO.creator_name || 'Admin'}</strong></p>
                <p>Tổng tiền: <strong className="text-teal-600">{formatCurrency(selectedPO.total_value)}</strong></p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h5 className="font-bold text-[#1d1d1f] dark:text-white mb-2 uppercase tracking-wider text-[11px]">
                Danh sách sản phẩm ({selectedPO.items?.length || 0} mặt hàng)
              </h5>
              <div className="rounded-[14px] border border-white/20 dark:border-white/10 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/20 dark:bg-white/5 border-b border-white/20 dark:border-white/10 text-[11px] text-[#76767b] uppercase">
                    <tr>
                      <th className="px-3 py-2">Mã SKU</th>
                      <th className="px-3 py-2">Sản phẩm</th>
                      <th className="px-3 py-2">SL Đặt</th>
                      <th className="px-3 py-2">SL Đã Nhận</th>
                      <th className="px-3 py-2">Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 dark:divide-white/5">
                    {selectedPO.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-mono font-bold text-teal-600">{it.sku_code}</td>
                        <td className="px-3 py-2 text-[#1d1d1f] dark:text-[#f5f5f7]">{it.product_name}</td>
                        <td className="px-3 py-2 font-bold text-[#1d1d1f] dark:text-white">{it.ordered_qty}</td>
                        <td className="px-3 py-2 text-[#76767b]">{it.received_qty || 0}</td>
                        <td className="px-3 py-2 text-[#1d1d1f] dark:text-[#f5f5f7]">{formatCurrency(it.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar based on Status */}
            <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
              <div className="flex gap-2">
                {selectedPO.status === 'draft' && (
                  <Button variant="glass" size="sm" onClick={() => updateStatus(selectedPO.id, 'submitted')}>
                    Gửi duyệt PO
                  </Button>
                )}
                {selectedPO.status === 'submitted' && (
                  <Button variant="glassProminent" size="sm" onClick={() => updateStatus(selectedPO.id, 'approved')}>
                    Phê duyệt PO
                  </Button>
                )}
                {selectedPO.status === 'approved' && (
                  <Button variant="glassProminent" size="sm" onClick={() => updateStatus(selectedPO.id, 'ordered')}>
                    Xác nhận đã gửi đơn NCC
                  </Button>
                )}
              </div>

              {/* Goods Receipt Button */}
              {selectedPO.status !== 'received' && selectedPO.status !== 'cancelled' && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => openReceiveModal(selectedPO)}
                  icon={<PackageCheck className="w-4 h-4" />}
                >
                  Nhập kho (Goods Receipt)
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Goods Receipt Modal */}
      <Modal
        isOpen={receiveModal}
        onClose={() => setReceiveModal(false)}
        title="Nhận hàng vào kho (Goods Receipt)"
        description="Xác nhận số lượng thực tế nhận được và ghi nhận hạn sử dụng cho lô hàng"
        size="lg"
      >
        <form onSubmit={handleExecuteReceipt} className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {receiptItems.map((item, idx) => (
              <div key={item.product_id} className="glass-material p-3 rounded-[14px] space-y-2">
                <p className="font-semibold text-xs text-[#1d1d1f] dark:text-white">
                  {item.product_name} (Số lượng đặt: {item.ordered_qty})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    label="Số lượng thực nhận"
                    type="number"
                    min="0"
                    value={item.received_qty}
                    onChange={(e) => {
                      const updated = [...receiptItems];
                      updated[idx].received_qty = Number(e.target.value);
                      setReceiptItems(updated);
                    }}
                    required
                  />
                  <Input
                    label="Số lô (Lot No.)"
                    value={item.lot_number}
                    onChange={(e) => {
                      const updated = [...receiptItems];
                      updated[idx].lot_number = e.target.value;
                      setReceiptItems(updated);
                    }}
                    required
                  />
                  <Input
                    label="Hạn sử dụng (Expiry)"
                    type="date"
                    value={item.expiry_date}
                    onChange={(e) => {
                      const updated = [...receiptItems];
                      updated[idx].expiry_date = e.target.value;
                      setReceiptItems(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/20 dark:border-white/10">
            <Button variant="glass" size="sm" type="button" onClick={() => setReceiveModal(false)}>
              Hủy
            </Button>
            <Button variant="success" size="sm" type="submit" loading={receiving}>
              Xác nhận nhập kho & cập nhật tồn
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create PO Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Tạo Đơn Đặt Hàng Mới (Purchase Order)"
        description="Lập đơn hàng gửi nhà cung cấp từ các đề xuất thu mua hoặc tạo thủ công"
        size="lg"
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Nhà Cung Cấp"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              options={[
                { value: '', label: '-- Chọn nhà cung cấp --' },
                ...suppliers.map((s) => ({ value: s.id, label: s.name }))
              ]}
              required
            />
            <Select
              label="Kho / Điểm Bán Nhận Hàng"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              options={[
                { value: '', label: '-- Chọn kho / cửa hàng --' },
                ...stores.map((st) => ({ value: st.id, label: st.name }))
              ]}
              required
            />
          </div>

          <Input
            label="Ghi chú đơn hàng"
            value={poNotes}
            onChange={(e) => setPoNotes(e.target.value)}
            placeholder="Ví dụ: Giao trước 8h sáng, kiểm tra nhiệt độ bảo quản xe tải lạnh"
          />

          <div>
            <h5 className="font-semibold text-xs text-[#1d1d1f] dark:text-white mb-2">
              Danh sách sản phẩm đặt hàng ({newPOItems.length} mặt hàng)
            </h5>
            {newPOItems.length === 0 ? (
              <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] py-4 text-center glass-material rounded-[14px]">
                Chưa có mặt hàng nào. Bạn có thể duyệt đề xuất ở trang "Kế hoạch thu mua" để chuyển tự động vào đây.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto glass-material rounded-[16px] p-2">
                {newPOItems.map((item, idx) => (
                  <div key={item.product_id} className="flex items-center justify-between gap-3 text-xs p-2.5 glass-material rounded-[12px]">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-[#1d1d1f] dark:text-white">{item.product_name}</p>
                      <p className="text-[11px] font-mono text-teal-600">{item.sku_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <Input
                          label="SL đặt"
                          type="number"
                          min="1"
                          value={item.ordered_qty}
                          onChange={(e) => {
                            const updated = [...newPOItems];
                            updated[idx].ordered_qty = Number(e.target.value);
                            setNewPOItems(updated);
                          }}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          label="Đơn giá (VND)"
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => {
                            const updated = [...newPOItems];
                            updated[idx].unit_price = Number(e.target.value);
                            setNewPOItems(updated);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setNewPOItems(newPOItems.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 mt-5"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-white/20 dark:border-white/10">
            <div className="text-xs">
              Tổng giá trị:{' '}
              <strong className="text-teal-600 dark:text-teal-400 text-sm">
                {formatCurrency(newPOItems.reduce((acc, it) => acc + (it.ordered_qty * it.unit_price), 0))}
              </strong>
            </div>
            <div className="flex gap-2">
              <Button variant="glass" size="sm" type="button" onClick={() => setCreateModal(false)}>
                Hủy
              </Button>
              <Button variant="glassProminent" size="sm" type="submit" loading={creating} disabled={newPOItems.length === 0}>
                Tạo Đơn Hàng PO
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

