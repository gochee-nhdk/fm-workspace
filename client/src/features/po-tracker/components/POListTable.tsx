import React, { useState, useRef, useEffect } from 'react';
import { POTrackerPO, POStatus } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POStatusPill, PO_STATUS_CONFIG_MAP } from './POStatusPill';
import { POProgressBar } from './POProgressBar';
import {
  SFExclamationmarkTriangleFill,
  SFClockFill,
  SFTrash,
  SFShippingbox,
  SFPencil,
  SFCheckmark
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

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

const formatExactVND = (v?: number | null) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return Math.round(Number(v)).toLocaleString('vi-VN') + ' ₫';
};

export const POListTable: React.FC<POListTableProps> = ({
  pos,
  loading,
  onViewDetail,
}) => {
  const { updatePOInList, removePOFromList } = usePOTrackerStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [poToDelete, setPoToDelete] = useState<POTrackerPO | null>(null);
  const [quickStatusPO, setQuickStatusPO] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lắng nghe sự kiện click ngoài menu trạng thái để tự đóng mà không dùng overlay che mất click
  useEffect(() => {
    if (!quickStatusPO) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setQuickStatusPO(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [quickStatusPO]);

  const safePos = Array.isArray(pos) ? pos : [];

  const handleQuickStatus = async (po: POTrackerPO, status: POStatus) => {
    if (po.status === status) {
      setQuickStatusPO(null);
      return;
    }
    const prevStatus = po.status;
    setUpdatingId(po.id);
    setQuickStatusPO(null);

    // Cập nhật lạc quan (optimistic update) ngay lập tức trên UI
    updatePOInList(po.id, { status });

    try {
      await poTrackerService.updateStatus(po.id, status);
      toast.success(`Đã cập nhật trạng thái: ${PO_STATUS_CONFIG_MAP[status]?.label || status}`, {
        id: `status-update-${po.id}`
      });
    } catch {
      // Revert lại nếu có lỗi
      updatePOInList(po.id, { status: prevStatus });
      toast.error('Không thể cập nhật trạng thái.', {
        id: `status-update-${po.id}`
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (po: POTrackerPO) => {
    setPoToDelete(po);
  };

  const executeDeletePO = async () => {
    if (!poToDelete) return;
    setDeletingId(poToDelete.id);
    try {
      await poTrackerService.deletePO(poToDelete.id);
      removePOFromList(poToDelete.id);
      toast.success('Đã xóa đơn hàng PO thành công.');
    } catch {
      toast.error('Không thể xóa đơn hàng này.');
    } finally {
      setDeletingId(null);
      setPoToDelete(null);
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
          <SFShippingbox size={30} />
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
    <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white/70 dark:bg-[#16161c]/70 shadow-xs relative overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[2.5fr_1.3fr_1.4fr_1.3fr_1.1fr_1.4fr_40px] gap-3.5 px-4 py-3.5 rounded-t-2xl border-b border-black/[0.08] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#1a1a20]">
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
          Số PO / Nhà cung cấp
        </div>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
          Hạn giao hàng
        </div>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
          Kho tiếp nhận
        </div>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] truncate text-right pr-2">
          Giá trị đơn
        </div>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
          Tiến độ
        </div>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
          Trạng thái
        </div>
        <div />
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
                'grid grid-cols-[2.5fr_1.3fr_1.4fr_1.3fr_1.1fr_1.4fr_40px] gap-3.5 px-4 py-3.5 items-center group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors duration-150 po-row-enter cursor-pointer select-none',
                isOverdue && 'bg-red-50/40 dark:bg-red-500/[0.03]',
                isUrgent && !isOverdue && 'bg-amber-50/40 dark:bg-amber-500/[0.03]',
                quickStatusPO === po.id ? 'relative z-30 ring-1 ring-[#0088FF]/30 dark:ring-[#0A84FF]/30 shadow-xs' : 'relative z-1'
              )}
              style={{ animationDelay: `${idx * 20}ms` }}
              onClick={() => onViewDetail(po)}
            >
              {/* Col 1: PO number + supplier */}
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13.5px] font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                    {po.po_number || <span className="text-[#86868b] italic font-normal">Chưa có số PO</span>}
                  </span>
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10.5px] font-bold">
                      <SFExclamationmarkTriangleFill size={10} className="animate-pulse" />
                      <span>Trễ hạn</span>
                    </span>
                  )}
                  {isUrgent && !isOverdue && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10.5px] font-bold">
                      <SFClockFill size={10} />
                      <span>Sắp tới</span>
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-medium text-[#555558] dark:text-[#a1a1a6] truncate mt-0.5" title={po.supplier_name || ''}>
                  {po.supplier_name || po.supplier_code || '—'}
                  {po.supplier_code && po.supplier_name && (
                    <span className="text-[#86868b] font-mono text-[11px] ml-1 font-normal">[{po.supplier_code}]</span>
                  )}
                </div>
              </div>

              {/* Col 2: Delivery date */}
              <div className="min-w-0">
                <div className={cn(
                  'text-[12.5px] font-bold tabular-nums',
                  isOverdue ? 'text-rose-600 dark:text-rose-400' : isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-[#1d1d1f] dark:text-white'
                )}>
                  {formatDate(po.expected_delivery_date)}
                </div>
                {daysLeft !== null && !['received', 'cancelled'].includes(po.status) && (
                  <div className={cn(
                    'text-[11px] font-semibold mt-0.5',
                    isOverdue ? 'text-rose-500 dark:text-rose-400' : isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-[#86868b]'
                  )}>
                    {isOverdue ? `Trễ ${Math.abs(daysLeft)} ngày` : daysLeft === 0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`}
                  </div>
                )}
              </div>

              {/* Col 3: Warehouse */}
              <div className="min-w-0 pr-1">
                <div className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white truncate" title={po.warehouse || ''}>
                  {po.warehouse || '—'}
                </div>
                {po.folder_name && (
                  <div className="text-[11px] font-medium text-[#86868b] truncate mt-0.5">
                    {po.folder_name}
                  </div>
                )}
              </div>

              {/* Col 4: Total value (full exact amount) */}
              <div className="text-right pr-2 min-w-0">
                <div className="text-[13px] font-extrabold text-[#1d1d1f] dark:text-white tabular-nums tracking-tight">
                  {po.total_value ? formatExactVND(po.total_value) : '—'}
                </div>
                {po.items && po.items.length > 0 && (
                  <div className="text-[11px] font-medium text-[#86868b] mt-0.5">
                    {po.items.length} mặt hàng
                  </div>
                )}
              </div>

              {/* Col 5: Progress */}
              <div className="min-w-0 pr-2">
                {po.item_count || po.items ? (
                  <POProgressBar
                    status={po.status}
                    items={po.items}
                    received={po.total_received_qty ?? po.items?.reduce((s, i) => s + (i.received_qty || 0), 0)}
                    total={po.total_ordered_qty ?? po.items?.reduce((s, i) => s + (i.ordered_qty || 0), 0)}
                    size="sm"
                  />
                ) : (
                  <span className="text-[11px] text-[#999]">—</span>
                )}
              </div>

              {/* Col 6: Status pill + quick update */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickStatusPO(quickStatusPO === po.id ? null : po.id);
                  }}
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
                  <div
                    ref={dropdownRef}
                    className="absolute top-full mt-1.5 left-0 z-[120] w-[210px] rounded-2xl bg-white dark:bg-[#1c1c22] border border-black/10 dark:border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.22)] p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {STATUS_FLOW.concat(['cancelled', 'overdue'] as POStatus[]).map((s) => {
                      const cfg = PO_STATUS_CONFIG_MAP[s];
                      return (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuickStatus(po, s);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuickStatus(po, s);
                          }}
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

      {/* Confirm Delete PO Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(poToDelete)}
        title="Xóa đơn hàng PO?"
        itemLabel={poToDelete ? `${poToDelete.po_number || 'Đơn PO'} — ${poToDelete.supplier_name || 'Không rõ NCC'}` : undefined}
        message="Hành động này không thể hoàn tác. Toàn bộ danh sách mặt hàng và lịch sử theo dõi tiến độ của đơn hàng này sẽ bị xóa khỏi hệ thống."
        confirmText="Xác nhận xóa PO"
        cancelText="Hủy bỏ"
        onConfirm={executeDeletePO}
        onClose={() => setPoToDelete(null)}
      />
    </div>
  );
};
