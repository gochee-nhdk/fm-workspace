import React, { useState } from 'react';
import { POTrackerPO, POStatus } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POStatusPill, PO_STATUS_CONFIG_MAP } from './POStatusPill';
import { POProgressBar } from './POProgressBar';
import {
  SFExclamationmarkTriangleFill,
  SFClockFill,
  SFTrash,
  SFShippingboxFill,
  SFPencil,
  SFCheckmark
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface POListTableProps {
  pos: POTrackerPO[];
  loading: boolean;
  onViewDetail: (po: POTrackerPO) => void;
  onEdit: (po: POTrackerPO) => void;
}

const STATUS_FLOW: POStatus[] = ['pending', 'confirmed', 'shipping', 'partial_received', 'received'];

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: vi }); } catch { return d; }
};

const formatVND = (v?: number | null) => {
  if (!v) return '—';
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return Number(v).toLocaleString('vi-VN');
};

export const POListTable: React.FC<POListTableProps> = ({
  pos,
  loading,
  onViewDetail,
}) => {
  const { updatePOInList, removePOFromList } = usePOTrackerStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quickStatusPO, setQuickStatusPO] = useState<string | null>(null);

  const safePos = Array.isArray(pos) ? pos : [];

  const handleQuickStatus = async (po: POTrackerPO, status: POStatus) => {
    setUpdatingId(po.id);
    setQuickStatusPO(null);
    try {
      await poTrackerService.updateStatus(po.id, status);
      updatePOInList(po.id, { status });
      toast.success(`Đã cập nhật trạng thái: ${PO_STATUS_CONFIG_MAP[status].label}`);
    } catch {
      toast.error('Không thể cập nhật trạng thái.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (po: POTrackerPO) => {
    if (!confirm(`Xóa PO "${po.po_number || 'không số'}"? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(po.id);
    try {
      await poTrackerService.deletePO(po.id);
      removePOFromList(po.id);
      toast.success('Đã xóa đơn hàng.');
    } catch {
      toast.error('Không thể xóa đơn hàng này.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] animate-pulse" />
        ))}
      </div>
    );
  }

  if (safePos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white/80 dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 flex items-center justify-center text-[#0088FF] shadow-sm">
          <SFShippingboxFill size={32} />
        </div>
        <div>
          <p className="text-[16px] font-bold text-[#1d1d1f] dark:text-white">Chưa có đơn hàng nào</p>
          <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] mt-1 max-w-sm">
            Bấm nút <b>"Tải lên PO"</b> ở phía trên để nạp file PDF hoặc tạo đơn PO mới vào hệ thống
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/10 bg-white/70 dark:bg-[#16161c]/70 shadow-xs">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1.4fr_52px] gap-3 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
        {['Số PO / Nhà CC', 'Hạn giao hàng', 'Kho nhận', 'Giá trị đơn', 'Tiến độ', 'Trạng thái', ''].map((h) => (
          <div key={h} className="text-[11.5px] font-bold uppercase tracking-wider text-[#555558] dark:text-[#a1a1a6] truncate">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
        {safePos.map((po, idx) => {
          const daysLeft = po.expected_delivery_date
            ? differenceInDays(parseISO(po.expected_delivery_date), new Date())
            : null;
          const isOverdue =
            daysLeft !== null &&
            daysLeft < 0 &&
            !['received', 'cancelled'].includes(po.status);
          const isUrgent =
            daysLeft !== null &&
            daysLeft >= 0 &&
            daysLeft <= 3 &&
            !['received', 'cancelled'].includes(po.status);
          const canEdit = !po.user_permission || ['edit', 'admin'].includes(po.user_permission);
          const canDelete = !po.user_permission || po.user_permission === 'admin';

          return (
            <div
              key={po.id}
              className={cn(
                'grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1.4fr_52px] gap-3 px-4 py-3.5 items-center group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors duration-150 po-row-enter cursor-pointer select-none',
                isOverdue && 'bg-red-50/50 dark:bg-red-500/[0.03]',
                isUrgent && !isOverdue && 'bg-amber-50/50 dark:bg-amber-500/[0.03]'
              )}
              style={{ animationDelay: `${idx * 20}ms` }}
              onClick={() => onViewDetail(po)}
            >
              {/* Col 1: PO number + supplier */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {isOverdue && (
                    <span className="text-red-500 shrink-0" title="Đã quá hạn giao hàng">
                      <SFExclamationmarkTriangleFill size={13} className="animate-pulse" />
                    </span>
                  )}
                  {isUrgent && !isOverdue && (
                    <span className="text-amber-500 shrink-0" title="Sắp đến hạn giao hàng">
                      <SFClockFill size={13} />
                    </span>
                  )}
                  <span className="text-[13.5px] font-bold text-[#1d1d1f] dark:text-white truncate">
                    {po.po_number || <span className="text-[#999] italic font-normal">Chưa có số PO</span>}
                  </span>
                </div>
                <div className="text-[12px] font-medium text-[#555558] dark:text-[#a1a1a6] truncate mt-0.5">
                  {po.supplier_name || po.supplier_code || '—'}
                  {po.supplier_code && po.supplier_name && (
                    <span className="text-[#999] ml-1">({po.supplier_code})</span>
                  )}
                </div>
              </div>

              {/* Col 2: Delivery date */}
              <div className="min-w-0">
                <div className={cn(
                  'text-[12.5px] font-semibold tabular-nums',
                  isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : isUrgent ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-[#1d1d1f] dark:text-white'
                )}>
                  {formatDate(po.expected_delivery_date)}
                </div>
                {daysLeft !== null && !['received', 'cancelled'].includes(po.status) && (
                  <div className={cn(
                    'text-[11px] font-medium mt-0.5',
                    isOverdue ? 'text-red-500 dark:text-red-400' : isUrgent ? 'text-amber-500 dark:text-amber-400' : 'text-[#86868b]'
                  )}>
                    {isOverdue ? `Trễ ${Math.abs(daysLeft)} ngày` : daysLeft === 0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`}
                  </div>
                )}
              </div>

              {/* Col 3: Warehouse */}
              <div className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-white truncate">
                {po.warehouse || '—'}
              </div>

              {/* Col 4: Total value */}
              <div className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-white tabular-nums">
                {po.total_value ? formatVND(po.total_value) : '—'}
                {po.total_value && <span className="text-[10px] text-[#86868b] ml-1 font-normal">{po.currency}</span>}
              </div>

              {/* Col 5: Progress */}
              <div className="min-w-0">
                {po.item_count ? (
                  <POProgressBar
                    items={po.items}
                    received={po.items?.reduce((s, i) => s + (i.received_qty || 0), 0)}
                    total={po.items?.reduce((s, i) => s + (i.ordered_qty || 0), 0)}
                    size="sm"
                  />
                ) : (
                  <span className="text-[11px] text-[#999]">—</span>
                )}
              </div>

              {/* Col 6: Status pill + quick update */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setQuickStatusPO(quickStatusPO === po.id ? null : po.id)}
                  disabled={!canEdit || updatingId === po.id}
                  className={cn(
                    'transition-all duration-150 cursor-pointer active:scale-95 disabled:cursor-not-allowed',
                    canEdit && 'hover:opacity-85'
                  )}
                  title={canEdit ? 'Nhấp để cập nhật trạng thái' : 'Bạn không có quyền cập nhật'}
                >
                  <POStatusPill status={po.status} size="sm" />
                </button>

                {/* Quick status dropdown */}
                {quickStatusPO === po.id && canEdit && (
                  <div className="absolute top-full mt-1 left-0 z-50 w-[190px] rounded-2xl bg-white dark:bg-[#1c1c22] border border-black/10 dark:border-white/15 shadow-2xl p-1 overflow-hidden po-status-enter">
                    {STATUS_FLOW.concat(['cancelled', 'overdue'] as POStatus[]).map((s) => {
                      const cfg = PO_STATUS_CONFIG_MAP[s];
                      return (
                        <button
                          key={s}
                          onClick={() => handleQuickStatus(po, s)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left',
                            po.status === s && 'bg-blue-50 dark:bg-blue-500/10 text-[#0088FF]'
                          )}
                        >
                          {cfg.icon}
                          <span className={cfg.color}>{cfg.label}</span>
                          {po.status === s && <SFCheckmark size={12} className="ml-auto text-[#0088FF]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Col 7: Actions */}
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(po)}
                    disabled={deletingId === po.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
                    title="Xóa PO"
                  >
                    <SFTrash size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Click outside to close quick status */}
      {quickStatusPO && (
        <div className="fixed inset-0 z-40" onClick={() => setQuickStatusPO(null)} />
      )}
    </div>
  );
};
