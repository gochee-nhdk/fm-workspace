import React, { useState } from 'react';
import { POTrackerPO, POStatus, PO_STATUS_CONFIG } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POStatusPill } from './POStatusPill';
import { POProgressBar } from './POProgressBar';
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
  return String(v);
};

export const POListTable: React.FC<POListTableProps> = ({
  pos,
  loading,
  onViewDetail,
  onEdit,
}) => {
  const { updatePOInList, removePOFromList } = usePOTrackerStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quickStatusPO, setQuickStatusPO] = useState<string | null>(null);

  const handleQuickStatus = async (po: POTrackerPO, status: POStatus) => {
    setUpdatingId(po.id);
    setQuickStatusPO(null);
    try {
      await poTrackerService.updateStatus(po.id, status);
      updatePOInList(po.id, { status });
      toast.success(`Đã cập nhật trạng thái: ${PO_STATUS_CONFIG[status].label}`);
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
          <div key={i} className="h-14 rounded-xl bg-white/40 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] animate-pulse" />
        ))}
      </div>
    );
  }

  if (pos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/50 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] flex items-center justify-center text-3xl">
          📦
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Chưa có đơn hàng nào</p>
          <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] mt-1">
            Nhấn "Upload PDF" hoặc "Tạo PO" để bắt đầu tracking
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-black/[0.06] dark:border-white/[0.07] bg-white/50 dark:bg-white/[0.02]">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.4fr_52px] gap-3 px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
        {['Số PO / Nhà CC', 'Ngày giao', 'Kho', 'Giá trị', 'Tiến độ', 'Trạng thái', ''].map((h) => (
          <div key={h} className="text-[11px] font-bold uppercase tracking-wide text-[#555558] dark:text-[#a1a1a6] truncate">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
        {pos.map((po, idx) => {
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
                'grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.4fr_52px] gap-3 px-4 py-3 items-center group hover:bg-black/[0.015] dark:hover:bg-white/[0.025] transition-colors duration-100 po-row-enter cursor-pointer',
                isOverdue && 'bg-red-50/50 dark:bg-red-500/[0.03]',
                isUrgent && !isOverdue && 'bg-amber-50/50 dark:bg-amber-500/[0.03]'
              )}
              style={{ animationDelay: `${idx * 20}ms` }}
              onClick={() => onViewDetail(po)}
            >
              {/* Col 1: PO number + supplier */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isOverdue && <span className="text-red-500 text-xs po-overdue-ring rounded-full" title="Quá hạn">⚠️</span>}
                  {isUrgent && !isOverdue && <span className="text-amber-500 text-xs" title="Sắp đến hạn">🔔</span>}
                  <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                    {po.po_number || <span className="text-[#999] italic font-normal">Chưa có số PO</span>}
                  </span>
                </div>
                <div className="text-[11px] text-[#555558] dark:text-[#a1a1a6] truncate mt-0.5">
                  {po.supplier_name || po.supplier_code || '—'}
                  {po.supplier_code && po.supplier_name && (
                    <span className="text-[#999] ml-1">({po.supplier_code})</span>
                  )}
                </div>
              </div>

              {/* Col 2: Delivery date */}
              <div className="min-w-0">
                <div className={cn(
                  'text-[12px] font-medium',
                  isOverdue ? 'text-red-600 dark:text-red-400' : isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-[#1d1d1f] dark:text-white'
                )}>
                  {formatDate(po.expected_delivery_date)}
                </div>
                {daysLeft !== null && !['received', 'cancelled'].includes(po.status) && (
                  <div className={cn(
                    'text-[10px] font-medium mt-0.5',
                    isOverdue ? 'text-red-500 dark:text-red-400' : isUrgent ? 'text-amber-500 dark:text-amber-400' : 'text-[#999]'
                  )}>
                    {isOverdue ? `Trễ ${Math.abs(daysLeft)} ngày` : daysLeft === 0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`}
                  </div>
                )}
              </div>

              {/* Col 3: Warehouse */}
              <div className="text-[12px] text-[#555558] dark:text-[#a1a1a6] truncate">
                {po.warehouse || '—'}
              </div>

              {/* Col 4: Total value */}
              <div className="text-[12px] font-medium text-[#1d1d1f] dark:text-white tabular-nums">
                {po.total_value ? formatVND(po.total_value) : '—'}
                {po.total_value && <span className="text-[10px] text-[#999] ml-0.5">{po.currency}</span>}
              </div>

              {/* Col 5: Progress */}
              <div className="min-w-0">
                {po.item_count ? (
                  <POProgressBar
                    items={po.items}
                    received={po.items?.reduce((s, i) => s + i.received_qty, 0)}
                    total={po.items?.reduce((s, i) => s + i.ordered_qty, 0)}
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
                    canEdit && 'hover:opacity-80'
                  )}
                  title={canEdit ? 'Nhấp để cập nhật trạng thái' : 'Bạn không có quyền cập nhật'}
                >
                  <POStatusPill status={po.status} size="sm" />
                </button>

                {/* Quick status dropdown */}
                {quickStatusPO === po.id && canEdit && (
                  <div className="absolute top-full mt-1 left-0 z-50 w-[180px] rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden po-status-enter">
                    {STATUS_FLOW.concat(['cancelled', 'overdue'] as POStatus[]).map((s) => {
                      const cfg = PO_STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          onClick={() => handleQuickStatus(po, s)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left',
                            po.status === s && 'bg-black/[0.03] dark:bg-white/[0.04]'
                          )}
                        >
                          <span>{cfg.icon}</span>
                          <span className={cfg.color}>{cfg.label}</span>
                          {po.status === s && <span className="ml-auto text-[10px] text-[#999]">▶ Hiện tại</span>}
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#999] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
                    title="Xóa PO"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <polyline points="1 3 11 3" /><path d="M4 3V2h4v1" /><path d="M2 3l1 8h6l1-8" />
                    </svg>
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
