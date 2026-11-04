import React, { useState, useEffect } from 'react';
import {
  POTrackerPO,
  POStatus,
  POPermission,
} from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POStatusPill, PO_STATUS_CONFIG_MAP } from './POStatusPill';
import { POProgressBar } from './POProgressBar';
import { Drawer } from '@/components/ui/drawer';
import {
  SFShippingboxFill,
  SFCheckmarkCircleFill,
  SFClockFill,
  SFTray2Fill,
  SFDocument,
  SFPencil,
  SFCalendar
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface PODetailDrawerProps {
  poId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const TIMELINE_STEPS: { status: POStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Tạo PO', icon: <SFDocument size={14} /> },
  { status: 'confirmed', label: 'Xác nhận', icon: <SFCheckmarkCircleFill size={14} /> },
  { status: 'shipping', label: 'Đang giao', icon: <SFTray2Fill size={14} /> },
  { status: 'partial_received', label: 'Nhận 1 phần', icon: <SFShippingboxFill size={14} /> },
  { status: 'received', label: 'Đã nhận đủ', icon: <SFCheckmarkCircleFill size={14} /> },
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

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actualDate, setActualDate] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

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
      toast.success(`Đã cập nhật trạng thái: ${PO_STATUS_CONFIG_MAP[newStatus]?.label || newStatus}`);
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

  const currentStepIdx = po ? TIMELINE_STEPS.findIndex((s) => s.status === po.status) : 0;
  const canEdit = !po?.user_permission || ['edit', 'admin'].includes(po.user_permission);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={po?.po_number || 'Chi tiết đơn hàng PO'}
      description={po?.supplier_name ? `Đối tác: ${po.supplier_name}` : 'Theo dõi tiến độ giao hàng & kiểm nhận'}
      width="lg"
    >
      <div className="space-y-5 font-sans text-left">
        {loading || !po ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#0088FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] font-medium text-[#86868b]">Đang tải dữ liệu đơn hàng...</p>
          </div>
        ) : (
          <>
            {/* Segmented Tab */}
            <div className="flex gap-1.5 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
              {[
                { id: 'info', label: 'Tiến độ & Chi tiết' },
                { id: 'items', label: `Hàng hóa (${po.items?.length || 0})` },
                { id: 'permissions', label: 'Phân quyền' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex-1 py-1.5 rounded-xl text-[12.5px] font-bold transition-all duration-150 cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-white dark:bg-zinc-800 text-[#0088FF] dark:text-[#0091FF] shadow-xs'
                      : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'info' && (
              <div className="space-y-5">
                {/* Visual Step Timeline */}
                <div className="p-4 sm:p-5 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-white">
                      Tiến độ giao hàng
                    </span>
                    <POStatusPill status={po.status} size="sm" />
                  </div>

                  {/* Horizontal Step Timeline */}
                  <div className="relative pt-2 pb-1">
                    <div className="absolute top-5 left-5 right-5 h-1 bg-black/[0.08] dark:bg-white/10 rounded-full -z-0" />
                    <div
                      className="absolute top-5 left-5 h-1 bg-[#0088FF] rounded-full transition-all duration-500 -z-0"
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
                                'w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold border-2 transition-all duration-200 select-none shadow-2xs',
                                isCurrent
                                  ? 'bg-[#0088FF] text-white border-white dark:border-[#16161a] ring-4 ring-[#0088FF]/20 scale-110'
                                  : isDone
                                  ? 'bg-emerald-500 text-white border-white dark:border-[#16161a]'
                                  : 'bg-white dark:bg-zinc-800 text-[#86868b] border-black/10 dark:border-white/10 group-hover:border-[#0088FF]'
                              )}
                            >
                              {step.icon}
                            </div>
                            <span
                              className={cn(
                                'text-[11px] font-bold text-center whitespace-nowrap',
                                isCurrent
                                  ? 'text-[#0088FF] dark:text-[#0091FF]'
                                  : isDone
                                  ? 'text-[#1d1d1f] dark:text-white'
                                  : 'text-[#86868b]'
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
                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-[#86868b]">Nhà cung cấp</span>
                    <p className="text-[14px] font-bold text-[#1d1d1f] dark:text-white">
                      {po.supplier_name || '—'}
                    </p>
                    {po.supplier_code && (
                      <span className="text-[12px] font-medium text-[#0088FF]">Mã: {po.supplier_code}</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-[#86868b]">Kho tiếp nhận</span>
                    <p className="text-[14px] font-bold text-[#1d1d1f] dark:text-white">
                      {po.warehouse || '—'}
                    </p>
                    <span className="text-[12px] text-[#86868b]">
                      Thư mục: {po.folder_name || 'Chưa phân nhóm'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-[#86868b]">Hạn giao dự kiến</span>
                    <p className="text-[14px] font-bold text-[#0088FF]">
                      {po.expected_delivery_date
                        ? format(parseISO(po.expected_delivery_date), 'dd/MM/yyyy', { locale: vi })
                        : '—'}
                    </p>
                    <span className="text-[12px] text-[#86868b]">
                      Ngày tạo: {po.po_date || format(parseISO(po.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-[#86868b]">Tổng giá trị đơn</span>
                    <p className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {po.total_value ? `${Number(po.total_value).toLocaleString('vi-VN')} ${po.currency}` : '—'}
                    </p>
                    <span className="text-[12px] text-[#86868b]">
                      {po.items?.length || 0} dòng sản phẩm
                    </span>
                  </div>
                </div>

                {/* Quick Status Bar */}
                {canEdit && (
                  <div className="p-4 rounded-2xl border border-black/[0.08] dark:border-white/10 space-y-3 bg-black/[0.01] dark:bg-white/[0.02]">
                    <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white">
                      Cập nhật trạng thái tiến độ giao
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      {(['shipping', 'partial_received', 'received'] as POStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(st)}
                          disabled={updatingStatus}
                          className={cn(
                            'h-10 rounded-xl text-[12.5px] font-bold border transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5',
                            po.status === st
                              ? 'bg-[#0088FF] text-white border-[#0088FF] shadow-xs'
                              : 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white border-black/10 dark:border-white/10 hover:border-[#0088FF]'
                          )}
                        >
                          {PO_STATUS_CONFIG_MAP[st]?.icon}
                          <span>{PO_STATUS_CONFIG_MAP[st]?.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <input
                        type="date"
                        value={actualDate}
                        onChange={(e) => setActualDate(e.target.value)}
                        className="h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-[12.5px] font-medium"
                      />
                      <input
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        placeholder="Ghi chú điều phối / số xe nhận..."
                        className="h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-[12.5px] font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'items' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-[#1d1d1f] dark:text-white">
                    Kiểm nhận số lượng hàng hóa
                  </p>
                  <span className="text-[11.5px] text-[#86868b]">
                    Nhập số lượng thực nhận để cập nhật tiến độ
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
                            'p-3.5 rounded-2xl border transition-colors space-y-2',
                            isFull
                              ? 'bg-emerald-50/50 dark:bg-emerald-500/[0.04] border-emerald-300/70 dark:border-emerald-500/30'
                              : isPartial
                              ? 'bg-amber-50/50 dark:bg-amber-500/[0.04] border-amber-300/70 dark:border-amber-500/30'
                              : 'bg-black/[0.015] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/10'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13.5px] font-bold text-[#1d1d1f] dark:text-white">
                              {it.item_name}
                            </span>
                            {it.item_code && (
                              <span className="text-[11.5px] font-mono text-[#86868b] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 font-semibold">
                                {it.item_code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-[#555558] dark:text-[#a1a1a6]">
                              Đặt: <b className="text-[#1d1d1f] dark:text-white font-bold">{it.ordered_qty} {it.unit}</b>
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="text-[#555558] dark:text-[#a1a1a6] font-semibold text-[12px]">Đã nhận:</span>
                              <input
                                type="number"
                                min="0"
                                max={it.ordered_qty * 1.5}
                                value={it.received_qty || 0}
                                disabled={!canEdit}
                                onChange={(e) => handleUpdateItemReceived(idx, Number(e.target.value))}
                                className="w-20 h-8 px-2 text-center rounded-xl bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[13px] font-bold tabular-nums"
                              />
                              <span className="text-[12px] text-[#86868b] font-medium">{it.unit}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-center text-[#86868b] py-8">
                      Chưa có danh sách mặt hàng chi tiết.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-[12.5px] text-[#1d1d1f] dark:text-white leading-relaxed">
                  Quản lý quyền truy cập đơn hàng: Chỉ người dùng được cấp phép mới có thể xem hoặc chỉnh sửa PO này.
                </div>

                <form onSubmit={handleGrantPermission} className="flex gap-2">
                  <input
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="Nhập User ID hoặc Email..."
                    required
                    className="flex-1 h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px]"
                  />
                  <select
                    value={selectedPerm}
                    onChange={(e) => setSelectedPerm(e.target.value as any)}
                    className="h-10 px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[12.5px] font-semibold"
                  >
                    <option value="view">Chỉ xem</option>
                    <option value="comment">Bình luận</option>
                    <option value="edit">Chỉnh sửa</option>
                    <option value="admin">Quản trị</option>
                  </select>
                  <button
                    type="submit"
                    disabled={granting || !targetUserId.trim()}
                    className="h-10 px-4 rounded-xl fm-primary-pill-surface text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-40"
                  >
                    {granting ? '...' : '+ Thêm'}
                  </button>
                </form>

                <div className="space-y-2 pt-1">
                  {po.permissions && po.permissions.length > 0 ? (
                    po.permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 text-[12.5px]"
                      >
                        <div>
                          <p className="font-bold text-[#1d1d1f] dark:text-white">
                            {perm.user_name || perm.email}
                          </p>
                          <span className="text-[11px] text-[#0088FF] uppercase font-bold">
                            Quyền: {perm.permission}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokePermission(perm.id)}
                          className="text-red-500 hover:text-red-700 font-semibold text-[12px] cursor-pointer"
                        >
                          Thu hồi
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-center text-[#86868b] py-6">
                      Chưa có phân quyền riêng lẻ nào trên PO này.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
};
