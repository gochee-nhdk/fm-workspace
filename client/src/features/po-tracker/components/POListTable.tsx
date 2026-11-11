import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  SFCheckmark,
  SFDocumentOnDocument,
  SFEye,
  SFArrowUpAndDown,
  SFChevronUp,
  SFChevronDown,
  SFMagnifyingglass
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

type SortField = 'po_number' | 'expected_delivery_date' | 'warehouse' | 'total_value' | 'progress' | 'status';
type SortOrder = 'asc' | 'desc';

const STATUS_FLOW: POStatus[] = ['pending', 'confirmed', 'shipping', 'partial_received', 'received'];
const STATUS_ORDER_MAP: Record<POStatus, number> = {
  overdue: 0,
  pending: 1,
  confirmed: 2,
  shipping: 3,
  partial_received: 4,
  received: 5,
  cancelled: 6,
};

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'dd/MM/yyyy', { locale: vi });
  } catch {
    return d;
  }
};

const formatExactVND = (v?: number | null) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return Math.round(Number(v)).toLocaleString('vi-VN') + ' ₫';
};

const calcProgress = (po: POTrackerPO): number => {
  if (po.status === 'received') return 100;
  if (!po.items || po.items.length === 0) {
    if (po.total_ordered_qty && po.total_ordered_qty > 0) {
      return Math.min(100, Math.round(((po.total_received_qty || 0) / po.total_ordered_qty) * 100));
    }
    return 0;
  }
  const total = po.items.reduce((s, i) => s + (i.ordered_qty || 0), 0);
  const recv = po.items.reduce((s, i) => s + (i.received_qty || 0), 0);
  return total > 0 ? Math.min(100, Math.round((recv / total) * 100)) : 0;
};

export const POListTable: React.FC<POListTableProps> = ({
  pos,
  loading,
  onViewDetail,
  onEdit,
}) => {
  const { updatePOInList, removePOFromList, search, setSearch } = usePOTrackerStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [poToDelete, setPoToDelete] = useState<POTrackerPO | null>(null);
  const [quickStatusPO, setQuickStatusPO] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('expected_delivery_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close status dropdown when clicking outside
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleCopyPO = (poNumber: string, poId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(poNumber);
    setCopiedId(poId);
    toast.success(`Đã sao chép: ${poNumber}`, { id: 'copy-po' });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleQuickStatus = async (po: POTrackerPO, status: POStatus) => {
    if (po.status === status) {
      setQuickStatusPO(null);
      return;
    }
    const prevStatus = po.status;
    setUpdatingId(po.id);
    setQuickStatusPO(null);

    // Optimistic update
    updatePOInList(po.id, { status });

    try {
      await poTrackerService.updateStatus(po.id, status);
      toast.success(`Đã cập nhật trạng thái: ${PO_STATUS_CONFIG_MAP[status]?.label || status}`, {
        id: `status-update-${po.id}`,
      });
    } catch {
      updatePOInList(po.id, { status: prevStatus });
      toast.error('Không thể cập nhật trạng thái.', {
        id: `status-update-${po.id}`,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (po: POTrackerPO, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const safePos = Array.isArray(pos) ? pos : [];

  // Sorted POs
  const sortedPos = useMemo(() => {
    const list = [...safePos];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'po_number':
          cmp = (a.po_number || '').localeCompare(b.po_number || '', 'vi');
          break;
        case 'expected_delivery_date': {
          const da = a.expected_delivery_date || '9999-99-99';
          const db = b.expected_delivery_date || '9999-99-99';
          cmp = da.localeCompare(db);
          break;
        }
        case 'warehouse':
          cmp = (a.warehouse || '').localeCompare(b.warehouse || '', 'vi');
          break;
        case 'total_value':
          cmp = (Number(a.total_value) || 0) - (Number(b.total_value) || 0);
          break;
        case 'progress':
          cmp = calcProgress(a) - calcProgress(b);
          break;
        case 'status':
          cmp = (STATUS_ORDER_MAP[a.status] ?? 99) - (STATUS_ORDER_MAP[b.status] ?? 99);
          break;
        default:
          cmp = 0;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [safePos, sortField, sortOrder]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <SFArrowUpAndDown size={11} className="opacity-30 group-hover/header:opacity-70 transition-opacity ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <SFChevronUp size={11} className="text-[#0088FF] dark:text-[#0A84FF] ml-1 font-bold" />
    ) : (
      <SFChevronDown size={11} className="text-[#0088FF] dark:text-[#0A84FF] ml-1 font-bold" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (safePos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3.5 text-center px-4 rounded-3xl bg-white/50 dark:bg-[#16161c]/50 border border-black/[0.06] dark:border-white/[0.08]">
        <div className="w-16 h-16 rounded-3xl bg-[#0088FF]/10 text-[#0088FF] dark:text-[#0A84FF] flex items-center justify-center shadow-xs">
          {search ? <SFMagnifyingglass size={26} /> : <SFShippingbox size={28} />}
        </div>
        <div className="space-y-1">
          <p className="text-[16px] font-bold text-[#1d1d1f] dark:text-white">
            {search ? 'Không tìm thấy đơn hàng phù hợp' : 'Chưa có đơn hàng nào'}
          </p>
          <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] max-w-sm">
            {search
              ? `Không có kết quả nào khớp với "${search}". Vui lòng thử từ khóa khác hoặc xóa bộ lọc.`
              : 'Bấm nút "Tải lên PO" ở góc trên để nạp file PDF hoặc tạo đơn PO mới vào hệ thống.'}
          </p>
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="mt-1 h-9 px-4 rounded-full bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-[#0088FF] dark:text-[#0A84FF] text-[12.5px] font-bold transition-all cursor-pointer"
          >
            Xóa tìm kiếm
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white/70 dark:bg-[#16161c]/70 shadow-xs relative">
      {/* ============================================================== */}
      {/* DESKTOP TABLE VIEW (hidden on small screens < 1024px) */}
      {/* ============================================================== */}
      <div className="hidden lg:block overflow-visible">
        {/* Table header */}
        <div className="grid grid-cols-[2.4fr_1.3fr_1.3fr_1.3fr_1.1fr_1.4fr_75px] gap-3 px-4 py-3 rounded-t-2xl border-b border-black/[0.08] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#1a1a20]">
          <button
            type="button"
            onClick={() => handleSort('po_number')}
            className="flex items-center text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer group/header text-left select-none"
          >
            <span>Số PO / Nhà cung cấp</span>
            {renderSortIndicator('po_number')}
          </button>

          <button
            type="button"
            onClick={() => handleSort('expected_delivery_date')}
            className="flex items-center text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer group/header text-left select-none"
          >
            <span>Hạn giao hàng</span>
            {renderSortIndicator('expected_delivery_date')}
          </button>

          <button
            type="button"
            onClick={() => handleSort('warehouse')}
            className="flex items-center text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer group/header text-left select-none"
          >
            <span>Kho tiếp nhận</span>
            {renderSortIndicator('warehouse')}
          </button>

          <button
            type="button"
            onClick={() => handleSort('total_value')}
            className="flex items-center justify-end text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer group/header text-right select-none pr-2"
          >
            <span>Giá trị đơn</span>
            {renderSortIndicator('total_value')}
          </button>

          <button
            type="button"
            onClick={() => handleSort('progress')}
            className="flex items-center text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer group/header text-left select-none"
          >
            <span>Tiến độ</span>
            {renderSortIndicator('progress')}
          </button>

          <button
            type="button"
            onClick={() => handleSort('status')}
            className="flex items-center text-[12px] font-extrabold uppercase tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer group/header text-left select-none"
          >
            <span>Trạng thái</span>
            {renderSortIndicator('status')}
          </button>

          <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#6e6e73] dark:text-[#8e8e93] text-right pr-1">
            Thao tác
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {sortedPos.map((po, idx) => {
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
            const isNearBottom = idx >= sortedPos.length - 2 && sortedPos.length > 2;

            return (
              <div
                key={po.id}
                className={cn(
                  'grid grid-cols-[2.4fr_1.3fr_1.3fr_1.3fr_1.1fr_1.4fr_75px] gap-3 px-4 py-3.5 items-center group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer select-none',
                  isOverdue && 'bg-red-50/40 dark:bg-red-500/[0.03]',
                  isUrgent && !isOverdue && 'bg-amber-50/40 dark:bg-amber-500/[0.03]',
                  quickStatusPO === po.id ? 'relative z-30 ring-1 ring-[#0088FF]/30 dark:ring-[#0A84FF]/30 shadow-xs' : 'relative z-1'
                )}
                onClick={() => onViewDetail(po)}
              >
                {/* Col 1: PO number + supplier */}
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13.5px] font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                      {po.po_number || <span className="text-[#86868b] italic font-normal">Chưa có số PO</span>}
                    </span>

                    {/* Copy PO button */}
                    {po.po_number && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyPO(po.po_number!, po.id, e)}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[#86868b] hover:text-[#0088FF] hover:bg-blue-50 dark:hover:bg-blue-500/15 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Sao chép số PO"
                      >
                        {copiedId === po.id ? (
                          <SFCheckmark size={11} className="text-emerald-500" />
                        ) : (
                          <SFDocumentOnDocument size={11} />
                        )}
                      </button>
                    )}

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
                  <div
                    className={cn(
                      'text-[12.5px] font-bold tabular-nums',
                      isOverdue ? 'text-rose-600 dark:text-rose-400' : isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-[#1d1d1f] dark:text-white'
                    )}
                  >
                    {formatDate(po.expected_delivery_date)}
                  </div>
                  {daysLeft !== null && !['received', 'cancelled'].includes(po.status) && (
                    <div
                      className={cn(
                        'text-[11px] font-semibold mt-0.5',
                        isOverdue ? 'text-rose-500 dark:text-rose-400' : isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-[#86868b]'
                      )}
                    >
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

                {/* Col 4: Total value */}
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
                      'transition-all duration-150 cursor-pointer active:scale-95 disabled:cursor-not-allowed group/pill',
                      canEdit && 'hover:opacity-90'
                    )}
                    title={canEdit ? 'Nhấp để đổi trạng thái nhanh' : 'Bạn không có quyền cập nhật'}
                  >
                    <POStatusPill status={po.status} size="sm" />
                  </button>

                  {/* Quick status dropdown with safe positioning */}
                  {quickStatusPO === po.id && canEdit && (
                    <div
                      ref={dropdownRef}
                      className={cn(
                        'absolute left-0 z-[120] w-[210px] rounded-2xl bg-white dark:bg-[#1c1c22] border border-black/10 dark:border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.22)] p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150',
                        isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2.5 py-1 text-[10.5px] font-bold uppercase text-[#86868b] tracking-wider border-b border-black/[0.05] dark:border-white/[0.05] mb-1">
                        Chuyển trạng thái
                      </div>
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
                              'w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left',
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
                <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onViewDetail(po)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6e6e73] hover:text-[#0088FF] hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                    title="Xem chi tiết PO"
                  >
                    <SFEye size={13} />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(po, e)}
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
      </div>

      {/* ============================================================== */}
      {/* MOBILE & TABLET CARD VIEW (shown on screens < 1024px) */}
      {/* ============================================================== */}
      <div className="lg:hidden divide-y divide-black/[0.06] dark:divide-white/[0.06]">
        {sortedPos.map((po) => {
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
          const canDelete = !po.user_permission || po.user_permission === 'admin';

          return (
            <div
              key={po.id}
              onClick={() => onViewDetail(po)}
              className={cn(
                'p-4 space-y-3 transition-colors cursor-pointer active:bg-black/[0.02]',
                isOverdue && 'bg-red-50/30 dark:bg-red-500/[0.03]',
                isUrgent && !isOverdue && 'bg-amber-50/30 dark:bg-amber-500/[0.03]'
              )}
            >
              {/* Header: PO Number + Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[14.5px] font-extrabold text-[#1d1d1f] dark:text-white tracking-tight truncate">
                    {po.po_number || 'Đơn PO'}
                  </span>
                  {po.po_number && (
                    <button
                      type="button"
                      onClick={(e) => handleCopyPO(po.po_number!, po.id, e)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#86868b] hover:text-[#0088FF] hover:bg-blue-50 shrink-0"
                      title="Sao chép số PO"
                    >
                      <SFDocumentOnDocument size={12} />
                    </button>
                  )}
                </div>
                <POStatusPill status={po.status} size="sm" />
              </div>

              {/* Supplier & Warehouse */}
              <div className="space-y-0.5 text-[12.5px]">
                <div className="font-semibold text-[#1d1d1f] dark:text-white truncate">
                  {po.supplier_name || '—'}
                  {po.supplier_code && (
                    <span className="text-[#86868b] font-mono text-[11px] ml-1">[{po.supplier_code}]</span>
                  )}
                </div>
                <div className="text-[12px] text-[#555558] dark:text-[#a1a1a6] flex items-center gap-2">
                  <span className="truncate">Kho: {po.warehouse || '—'}</span>
                  {po.folder_name && (
                    <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10.5px] font-semibold text-[#6e6e73]">
                      {po.folder_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Date & Amount */}
              <div className="flex items-center justify-between pt-1 text-[12.5px] border-t border-black/[0.04] dark:border-white/[0.04]">
                <div>
                  <span className="text-[#86868b] text-[11px] block">Hạn giao</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('font-bold', isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-[#1d1d1f] dark:text-white')}>
                      {formatDate(po.expected_delivery_date)}
                    </span>
                    {daysLeft !== null && !['received', 'cancelled'].includes(po.status) && (
                      <span className={cn('text-[10.5px] font-bold px-1.5 py-0.2 rounded', isOverdue ? 'bg-rose-50 text-rose-600' : isUrgent ? 'bg-amber-50 text-amber-700' : 'text-[#86868b]')}>
                        {isOverdue ? `Trễ ${Math.abs(daysLeft)}n` : daysLeft === 0 ? 'Hôm nay' : `${daysLeft}n`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[#86868b] text-[11px] block">Giá trị đơn</span>
                  <span className="text-[14px] font-black text-[#1d1d1f] dark:text-white tabular-nums">
                    {po.total_value ? formatExactVND(po.total_value) : '—'}
                  </span>
                </div>
              </div>

              {/* Progress & Actions */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex-1">
                  <POProgressBar
                    status={po.status}
                    items={po.items}
                    received={po.total_received_qty ?? po.items?.reduce((s, i) => s + (i.received_qty || 0), 0)}
                    total={po.total_ordered_qty ?? po.items?.reduce((s, i) => s + (i.ordered_qty || 0), 0)}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onViewDetail(po)}
                    className="h-7 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-[#0088FF] text-[11.5px] font-bold hover:bg-blue-100 flex items-center gap-1"
                  >
                    <SFEye size={12} />
                    <span>Chi tiết</span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(po, e)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:text-red-500 hover:bg-red-50"
                    >
                      <SFTrash size={12} />
                    </button>
                  )}
                </div>
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
