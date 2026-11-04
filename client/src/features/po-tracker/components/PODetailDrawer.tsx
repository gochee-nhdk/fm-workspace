import React, { useState, useEffect } from 'react';
import {
  POTrackerPO,
  POStatus,
  PO_STATUS_CONFIG,
  POTrackerItemLine,
  POPermission,
} from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POStatusPill } from './POStatusPill';
import { POProgressBar } from './POProgressBar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface PODetailDrawerProps {
  poId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const TIMELINE_STEPS: { status: POStatus; label: string; icon: string }[] = [
  { status: 'pending', label: 'Tạo PO', icon: '📝' },
  { status: 'confirmed', label: 'Xác nhận', icon: '✅' },
  { status: 'shipping', label: 'Đang giao', icon: '🚚' },
  { status: 'partial_received', label: 'Nhận 1 phần', icon: '📦' },
  { status: 'received', label: 'Đã nhận đủ', icon: '🎉' },
];

export const PODetailDrawer: React.FC<PODetailDrawerProps> = ({
  poId,
  isOpen,
  onClose,
}) => {
  const { updatePOInList } = usePOTrackerStore();
  const [po, setPo] = useState<POTrackerPO | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'permissions'>('info');

  // Status updating state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actualDate, setActualDate] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  // Permission management
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedPerm, setSelectedPerm] = useState<POPermission>('view');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (poId && isOpen) {
      setLoading(true);
      poTrackerService
        .getPO(poId)
        .then((res) => {
          setPo(res.data.data);
          setActualDate(res.data.data.actual_delivery_date || '');
          setStatusNotes(res.data.data.notes || '');
        })
        .catch((err) => {
          toast.error('Không thể tải chi tiết đơn hàng.');
          console.error(err);
        })
        .finally(() => setLoading(false));
    } else {
      setPo(null);
    }
  }, [poId, isOpen]);

  const handleUpdateStatus = async (newStatus: POStatus) => {
    if (!po) return;
    setUpdatingStatus(true);
    try {
      await poTrackerService.updateStatus(
        po.id,
        newStatus,
        actualDate || (newStatus === 'received' ? new Date().toISOString().split('T')[0] : undefined),
        statusNotes
      );
      const updated = {
        ...po,
        status: newStatus,
        actual_delivery_date: actualDate || (newStatus === 'received' ? new Date().toISOString().split('T')[0] : po.actual_delivery_date),
        notes: statusNotes,
      };
      setPo(updated);
      updatePOInList(po.id, updated);
      toast.success(`Đã cập nhật trạng thái: ${PO_STATUS_CONFIG[newStatus].label}`);
    } catch {
      toast.error('Lỗi cập nhật trạng thái đơn hàng.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdateItemReceived = async (itemIndex: number, receivedQty: number) => {
    if (!po || !po.items) return;
    const nextItems = [...po.items];
    const item = nextItems[itemIndex];
    item.received_qty = receivedQty;
    item.status = receivedQty >= item.ordered_qty ? 'received' : receivedQty > 0 ? 'partial' : 'pending';

    // Check overall status
    const allReceived = nextItems.every((it) => it.received_qty >= it.ordered_qty);
    const someReceived = nextItems.some((it) => it.received_qty > 0);
    const newStatus: POStatus = allReceived ? 'received' : someReceived ? 'partial_received' : po.status;

    try {
      await poTrackerService.updatePO(po.id, {
        items: nextItems,
        status: newStatus,
      });
      const updated = { ...po, items: nextItems, status: newStatus };
      setPo(updated);
      updatePOInList(po.id, updated);
      toast.success('Đã cập nhật số lượng nhập kho.');
    } catch {
      toast.error('Không thể lưu số lượng đã nhận.');
    }
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po || !targetUserId.trim()) return;
    setGranting(true);
    try {
      await poTrackerService.grantPermission({
        target_user_id: targetUserId.trim(),
        resource_type: 'po',
        resource_id: po.id,
        permission: selectedPerm,
      });
      toast.success('Đã cấp quyền thành công.');
      // Refresh details
      const res = await poTrackerService.getPO(po.id);
      setPo(res.data.data);
      setTargetUserId('');
    } catch {
      toast.error('Không thể cấp quyền.');
    } finally {
      setGranting(false);
    }
  };

  const handleRevokePermission = async (permId: string) => {
    if (!po) return;
    try {
      await poTrackerService.revokePermission(permId);
      toast.success('Đã thu hồi quyền.');
      const res = await poTrackerService.getPO(po.id);
      setPo(res.data.data);
    } catch {
      toast.error('Không thể thu hồi quyền.');
    }
  };

  if (!isOpen) return null;

  const currentStepIdx = po ? TIMELINE_STEPS.findIndex((s) => s.status === po.status) : 0;
  const canEdit = !po?.user_permission || ['edit', 'admin'].includes(po.user_permission);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm liquid-backdrop-enter"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[201] w-full max-w-[650px] apple-drawer-enter flex flex-col">
        <div className="vision-glass-sidebar h-full flex flex-col shadow-2xl border-l border-black/[0.08] dark:border-white/10 bg-white/95 dark:bg-[#16161a]/95 backdrop-blur-2xl">
          {/* Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl">📦</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-white leading-tight">
                    {po?.po_number || 'Chi tiết PO'}
                  </h2>
                  {po && <POStatusPill status={po.status} size="sm" />}
                </div>
                <p className="text-[11px] text-[#76767b] dark:text-[#8e8e93]">
                  {po?.supplier_name || 'Đơn hàng mua sắm'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Segmented Navigation Tab */}
          <div className="px-6 py-2.5 border-b border-black/[0.04] dark:border-white/[0.06] flex gap-2">
            {[
              { id: 'info', label: 'Tiến độ & Thông tin' },
              { id: 'items', label: `Hàng hóa (${po?.items?.length || 0})` },
              { id: 'permissions', label: 'Phân quyền' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer',
                  activeTab === tab.id
                    ? 'fm-primary-pill-surface text-white shadow-xs'
                    : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading || !po ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-[#0088FF] border-t-transparent rounded-full animate-spin" />
                <p className="text-[12px] text-[#999]">Đang tải dữ liệu PO...</p>
              </div>
            ) : activeTab === 'info' ? (
              <div className="space-y-6">
                {/* Visual Delivery Progress Tracker */}
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#76767b]">
                      Tiến độ giao nhận
                    </span>
                    <POProgressBar items={po.items} size="md" />
                  </div>

                  {/* Horizontal Step Timeline */}
                  <div className="relative pt-2 pb-1">
                    <div className="absolute top-6 left-6 right-6 h-0.5 bg-black/[0.08] dark:bg-white/10 -z-0" />
                    <div
                      className="absolute top-6 left-6 h-0.5 bg-[#0088FF] transition-all duration-500 -z-0"
                      style={{
                        width: `${Math.max(0, Math.min(100, (currentStepIdx / (TIMELINE_STEPS.length - 1)) * 100))}%`,
                      }}
                    />

                    <div className="flex items-center justify-between relative z-10">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const isDone = currentStepIdx >= idx;
                        const isCurrent = currentStepIdx === idx;
                        return (
                          <div
                            key={step.status}
                            className="flex flex-col items-center gap-1.5 cursor-pointer group"
                            onClick={() => canEdit && handleUpdateStatus(step.status)}
                          >
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200 select-none',
                                isCurrent
                                  ? 'bg-[#0088FF] text-white border-white dark:border-[#16161a] ring-4 ring-[#0088FF]/20 scale-110 shadow-md'
                                  : isDone
                                  ? 'bg-emerald-500 text-white border-white dark:border-[#16161a]'
                                  : 'bg-white dark:bg-zinc-800 text-[#999] border-black/10 dark:border-white/10 group-hover:border-[#0088FF]'
                              )}
                            >
                              {step.icon}
                            </div>
                            <span
                              className={cn(
                                'text-[10px] font-semibold text-center whitespace-nowrap',
                                isCurrent
                                  ? 'text-[#0088FF] dark:text-[#0091FF]'
                                  : isDone
                                  ? 'text-[#1d1d1f] dark:text-white'
                                  : 'text-[#999]'
                              )}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Key Attributes Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#999]">Nhà cung cấp</span>
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
                      {po.supplier_name || '—'}
                    </p>
                    {po.supplier_code && (
                      <span className="text-[11px] text-[#76767b]">Mã: {po.supplier_code}</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#999]">Kho tiếp nhận</span>
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
                      {po.warehouse || '—'}
                    </p>
                    <span className="text-[11px] text-[#76767b]">
                      Folder: {po.folder_name || 'Chưa phân nhóm'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#999]">Hạn giao hàng</span>
                    <p className="text-[13px] font-semibold text-[#0088FF]">
                      {po.expected_delivery_date
                        ? format(parseISO(po.expected_delivery_date), 'dd/MM/yyyy', { locale: vi })
                        : '—'}
                    </p>
                    <span className="text-[11px] text-[#76767b]">
                      Ngày tạo: {po.po_date || format(parseISO(po.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#999]">Tổng giá trị đơn</span>
                    <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {po.total_value ? `${po.total_value.toLocaleString('vi-VN')} ${po.currency}` : '—'}
                    </p>
                    <span className="text-[11px] text-[#76767b]">
                      {po.items?.length || 0} mặt hàng
                    </span>
                  </div>
                </div>

                {/* Quick Action Change Status */}
                {canEdit && (
                  <div className="p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#76767b]">
                      Cập nhật trạng thái nhanh
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      {(['shipping', 'partial_received', 'received'] as POStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(st)}
                          disabled={updatingStatus}
                          className={cn(
                            'h-9 rounded-xl text-[12px] font-semibold border transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50',
                            po.status === st
                              ? 'bg-[#0088FF] text-white border-[#0088FF] shadow-xs'
                              : 'bg-white/60 dark:bg-white/[0.04] text-[#1d1d1f] dark:text-white border-black/10 dark:border-white/10 hover:border-[#0088FF]'
                          )}
                        >
                          {PO_STATUS_CONFIG[st].icon} {PO_STATUS_CONFIG[st].label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="date"
                        value={actualDate}
                        onChange={(e) => setActualDate(e.target.value)}
                        placeholder="Ngày nhận thực tế"
                        className="h-8 px-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-[12px]"
                      />
                      <input
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        placeholder="Ghi chú nhận hàng / số xe..."
                        className="h-8 px-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-[12px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'items' ? (
              /* Items Line Table with Received Qty Editor */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold uppercase text-[#76767b]">
                    Danh sách sản phẩm & Kiểm nhận
                  </p>
                  <span className="text-[11px] text-[#999]">
                    Nhập số lượng nhận để hệ thống tự tính tiến độ
                  </span>
                </div>

                <div className="space-y-2">
                  {po.items && po.items.length > 0 ? (
                    po.items.map((it, idx) => {
                      const isFull = (it.received_qty || 0) >= (it.ordered_qty || 0);
                      const isPartial = (it.received_qty || 0) > 0 && !isFull;

                      return (
                        <div
                          key={it.id || idx}
                          className={cn(
                            'p-3 rounded-xl border transition-colors space-y-2',
                            isFull
                              ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.03] border-emerald-200/60 dark:border-emerald-500/20'
                              : isPartial
                              ? 'bg-amber-50/40 dark:bg-amber-500/[0.03] border-amber-200/60 dark:border-amber-500/20'
                              : 'bg-black/[0.015] dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.06]'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
                              {it.item_name}
                            </span>
                            {it.item_code && (
                              <span className="text-[11px] font-mono text-[#999] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                                {it.item_code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-[#76767b]">
                              Đặt: <b className="text-[#1d1d1f] dark:text-white">{it.ordered_qty} {it.unit}</b>
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="text-[#76767b]">Đã nhận:</span>
                              <input
                                type="number"
                                min="0"
                                max={it.ordered_qty * 1.5}
                                value={it.received_qty || 0}
                                disabled={!canEdit}
                                onChange={(e) => handleUpdateItemReceived(idx, Number(e.target.value))}
                                className="w-16 h-7 px-2 text-center rounded-lg bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[12px] font-bold tabular-nums"
                              />
                              <span className="text-[11px] text-[#999]">{it.unit}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-center text-[#999] py-8">
                      Chưa có danh sách mặt hàng chi tiết.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Permissions Tab */
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-500/15 text-[12px] text-[#555558] dark:text-[#a1a1a6]">
                  💡 <b>Phân quyền PO</b>: Chỉ những người được cấp phép mới xem được PO này (Admin có quyền xem/sửa toàn bộ).
                </div>

                {/* Add Permission Form */}
                <form onSubmit={handleGrantPermission} className="flex gap-2">
                  <input
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="User ID hoặc Email..."
                    required
                    className="flex-1 h-9 px-3 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[12px]"
                  />
                  <select
                    value={selectedPerm}
                    onChange={(e) => setSelectedPerm(e.target.value as any)}
                    className="h-9 px-2 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[12px]"
                  >
                    <option value="view">Chỉ xem</option>
                    <option value="comment">Bình luận</option>
                    <option value="edit">Chỉnh sửa</option>
                    <option value="admin">Toàn quyền</option>
                  </select>
                  <button
                    type="submit"
                    disabled={granting || !targetUserId.trim()}
                    className="h-9 px-4 rounded-xl fm-primary-pill-surface text-white text-[12px] font-semibold cursor-pointer disabled:opacity-40"
                  >
                    {granting ? '...' : '+ Thêm'}
                  </button>
                </form>

                {/* Permissions List */}
                <div className="space-y-2 pt-2">
                  {po.permissions && po.permissions.length > 0 ? (
                    po.permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] text-[12px]"
                      >
                        <div>
                          <p className="font-semibold text-[#1d1d1f] dark:text-white">
                            {perm.user_name || perm.email}
                          </p>
                          <span className="text-[10px] text-[#999] uppercase font-bold">
                            Quyền: {perm.permission}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokePermission(perm.id)}
                          className="text-red-500 hover:text-red-700 text-[11px] font-medium"
                        >
                          Thu hồi
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-center text-[#999] py-4">
                      Chưa có phân quyền riêng lẻ nào trên PO này.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
