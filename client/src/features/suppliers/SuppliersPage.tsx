import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Modal,
  Input,
  Spinner,
  EmptyState
} from '@/components/ui';
import { Truck, Plus, RefreshCw, Phone, Mail, Clock } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import toast from 'react-hot-toast';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [leadTime, setLeadTime] = useState<number>(2);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers');
      if (res.data?.data) {
        setSuppliers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/suppliers', {
        name,
        code,
        lead_time_days: leadTime,
        contact_name: contactName,
        phone,
        email
      });
      toast.success('Đã thêm nhà cung cấp mới thành công.');
      setCreateModal(false);
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      fetchSuppliers();
    } catch (err) {
      toast.error('Lỗi khi tạo nhà cung cấp.');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'code',
      header: 'Mã NCC',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
          {row.original.code}
        </span>
      )
    },
    {
      accessorKey: 'name',
      header: 'Tên Nhà Cung Cấp',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {row.original.name}
        </span>
      )
    },
    {
      accessorKey: 'lead_time_days',
      header: 'Thời Gian Giao (Lead Time)',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {row.original.lead_time_days ?? 2} ngày
        </span>
      )
    },
    {
      accessorKey: 'contact_name',
      header: 'Người Liên Hệ',
      cell: ({ row }) => <span>{row.original.contact_name || '-'}</span>
    },
    {
      accessorKey: 'phone',
      header: 'Điện Thoại',
      cell: ({ row }) => (
        <span className="text-slate-500 font-mono text-xs flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" />
          {row.original.phone || '-'}
        </span>
      )
    },
    {
      accessorKey: 'is_active',
      header: 'Trạng Thái',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'danger'} size="sm" dot>
          {row.original.is_active ? 'Hợp tác' : 'Tạm dừng'}
        </Badge>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-teal-600" />
            <span>Quản lý Nhà Cung Cấp (Suppliers)</span>
          </h2>
          <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
            Theo dõi thời gian giao hàng (Lead Time), điều khoản thanh toán và thông tin đối tác
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px] flex items-center gap-1.5">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchSuppliers}
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
            Thêm nhà cung cấp mới
          </Button>
        </div>
      </div>

      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Danh sách Đối tác Cung ứng ({suppliers.length})</h3>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={suppliers}
            isLoading={loading}
            emptyTitle="Chưa có nhà cung cấp nào"
            emptyDescription="Thêm nhà cung cấp đầu tiên hoặc nạp dữ liệu từ Trung tâm dữ liệu."
          />
        </div>
      </div>

      {/* Modal: Create Supplier */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Thêm Nhà Cung Cấp Mới"
        size="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <Input
            label="Mã nhà cung cấp"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ví dụ: SUP-DALAT"
            required
          />
          <Input
            label="Tên đầy đủ nhà cung cấp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Công ty Cổ phần Nông sản Sạch Đà Lạt"
            required
          />
          <Input
            label="Thời gian giao hàng chuẩn (Lead Time - ngày)"
            type="number"
            min="1"
            value={leadTime}
            onChange={(e) => setLeadTime(Number(e.target.value))}
            required
          />
          <Input
            label="Họ tên người liên hệ"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn A (Quản lý kinh doanh)"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Số điện thoại"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
            />
            <Input
              label="Email nhận đơn hàng"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="orders@dalatfarm.vn"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/20 dark:border-white/10">
            <Button variant="glass" size="sm" type="button" onClick={() => setCreateModal(false)}>
              Hủy
            </Button>
            <Button variant="glassProminent" size="sm" type="submit" loading={saving}>
              Lưu nhà cung cấp
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

