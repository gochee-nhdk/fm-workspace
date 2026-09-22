import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DataTable,
  Button,
  Badge,
  Spinner,
  EmptyState
} from '@/components/ui';
import { ScrollText, RefreshCw, ShieldCheck } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs');
      if (res.data?.data) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'action',
      header: 'Hành Động',
      cell: ({ row }) => (
        <Badge variant="purple" size="sm">
          {row.original.action}
        </Badge>
      )
    },
    {
      accessorKey: 'user_name',
      header: 'Người Thực Hiện',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {row.original.user_name || 'Hệ thống'}
        </span>
      )
    },
    {
      accessorKey: 'entity_type',
      header: 'Đối Tượng',
      cell: ({ row }) => <span className="text-slate-500 font-mono text-xs">{row.original.entity_type}</span>
    },
    {
      accessorKey: 'reason',
      header: 'Lý Do / Chi Tiết',
      cell: ({ row }) => (
        <span className="text-slate-600 dark:text-slate-400 text-xs">
          {row.original.reason || '-'}
        </span>
      )
    },
    {
      accessorKey: 'ip_address',
      header: 'Địa Chỉ IP',
      cell: ({ row }) => <span className="font-mono text-[11px] text-slate-400">{row.original.ip_address || 'Local'}</span>
    },
    {
      accessorKey: 'created_at',
      header: 'Thời Gian',
      cell: ({ row }) => (
        <span className="text-slate-400 text-xs">
          {new Date(row.original.created_at).toLocaleString('vi-VN')}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
            <ScrollText className="w-5 h-5 text-teal-600" />
            <span>Nhật Ký Kiểm Toán (Audit Trail)</span>
          </h2>
          <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
            Ghi nhận vết mọi thay đổi số lượng tồn kho, quyết định duyệt đơn đặt hàng và điều chỉnh hệ thống
          </p>
        </div>

        <div className="glass-container p-1.5 rounded-[16px]">
          <Button
            variant="glass"
            size="sm"
            onClick={fetchLogs}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      <div className="glass-material rounded-[22px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Lịch sử Thao tác & Kiểm toán</h3>
          <Badge variant="default" size="sm">
            {logs.length} bản ghi
          </Badge>
        </div>
        <div className="p-2">
          <DataTable
            columns={columns}
            data={logs}
            isLoading={loading}
            emptyTitle="Chưa có bản ghi kiểm toán nào"
            emptyDescription="Mọi thao tác thay đổi số lượng tồn kho hoặc duyệt đơn hàng sẽ được tự động lưu vết tại đây."
          />
        </div>
      </div>
    </div>
  );
};
