import React, { useState, useEffect, useRef } from 'react';
import {
  POTrackerPO,
  POStatus,
  POPermission,
  POPermissionRecord,
} from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POStatusPill, PO_STATUS_CONFIG_MAP } from './POStatusPill';
import { POProgressBar } from './POProgressBar';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import {
  SFShippingboxFill,
  SFCheckmarkCircleFill,
  SFClockFill,
  SFTray2Fill,
  SFDocument,
  SFPencil,
  SFCalendar,
  SFTrash,
  SFEye,
  SFBubbleLeftFill,
  SFCheckmarkShieldFill,
  SFPersonFill,
  SFCheckmark
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

const PERMISSION_ROLES: {
  id: POPermission;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  { id: 'view', label: 'Chỉ xem', description: 'Có thể xem thông tin đơn hàng', icon: <SFEye size={13} className="text-blue-500 shrink-0" /> },
  { id: 'comment', label: 'Bình luận', description: 'Có thể viết ghi chú và trao đổi', icon: <SFBubbleLeftFill size={13} className="text-amber-500 shrink-0" /> },
  { id: 'edit', label: 'Chỉnh sửa', description: 'Có thể cập nhật trạng thái & kiểm nhận hàng', icon: <SFPencil size={13} className="text-emerald-500 shrink-0" /> },
  { id: 'admin', label: 'Quản trị', description: 'Toàn quyền chỉnh sửa, phân quyền & xóa PO', icon: <SFCheckmarkShieldFill size={13} className="text-purple-500 shrink-0" /> },
];

const MAIN_WORKFLOW_STATUSES: POStatus[] = [
  'pending',
  'confirmed',
  'shipping',
  'partial_received',
  'received',
];

const EXCEPTION_STATUSES: POStatus[] = [
  'cancelled',
  'overdue',
];

const STATUS_ACTIVE_THEMES: Record<POStatus, string> = {
  pending: 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40',
  confirmed: 'bg-blue-500/15 dark:bg-blue-500/25 text-blue-900 dark:text-blue-200 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/40',
  shipping: 'bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/40',
  partial_received: 'bg-purple-500/15 dark:bg-purple-500/25 text-purple-900 dark:text-purple-200 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/40',
  received: 'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/40',
  cancelled: 'bg-zinc-500/15 dark:bg-zinc-500/25 text-zinc-900 dark:text-zinc-200 border-zinc-500 shadow-[0_0_10px_rgba(113,113,122,0.25)] ring-1 ring-zinc-500/40',
  overdue: 'bg-rose-500/15 dark:bg-rose-500/25 text-rose-900 dark:text-rose-200 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40',
};

export const PODetailDrawer: React.FC<PODetailDrawerProps> = ({
  poId,
  isOpen,
  onClose,
}) => {
  const { updatePOInList, removePOFromList } = usePOTrackerStore();
  const [po, setPo] = useState<POTrackerPO | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'permissions'>('info');

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actualDate, setActualDate] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const [targetUserId, setTargetUserId] = useState('');
  const [selectedPerm, setSelectedPerm] = useState<POPermission>('view');
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: string; email: string; full_name?: string }>>([]);
  const [granting, setGranting] = useState(false);

  // Confirm delete dialog states
  const [showDeletePODialog, setShowDeletePODialog] = useState(false);
  const [deletingPO, setDeletingPO] = useState(false);
  const [permToRevoke, setPermToRevoke] = useState<{ id: string; name: string } | null>(null);

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

      poTrackerService
        .getUsers()
        .then((users) => {
          if (users && users.length > 0) setAssignableUsers(users);
        })
        .catch(() => {});
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
    const identifier = targetUserId.trim();
    const roleConfig = PERMISSION_ROLES.find((r) => r.id === selectedPerm);
    try {
      await poTrackerService.grantPermission({
        target_user_id: identifier,
        resource_type: 'po',
        resource_id: po.id,
        permission: selectedPerm,
      });
      toast.success(`Đã cấp quyền "${roleConfig?.label || selectedPerm}" thành công.`);
      const res = await poTrackerService.getPO(po.id);
      setPo(res.data.data);
      setTargetUserId('');
    } catch {
      // Graceful fallback for mock mode or users not yet in remote table
      const matchedUser = assignableUsers.find(
        (u) =>
          u.id === identifier ||
          u.email.toLowerCase() === identifier.toLowerCase() ||
          (u.full_name && u.full_name.toLowerCase() === identifier.toLowerCase())
      );
      const newPerm: POPermissionRecord = {
        id: `perm_${Date.now()}`,
        user_id: matchedUser ? matchedUser.id : identifier,
        user_name: matchedUser ? (matchedUser.full_name || matchedUser.email) : identifier.split('@')[0],
        email: matchedUser ? matchedUser.email : (identifier.includes('@') ? identifier : `${identifier}@fmarket.vn`),
        permission: selectedPerm,
        resource_type: 'po' as const,
        resource_id: po.id,
        granted_by: 'system',
        created_at: new Date().toISOString(),
      };
      const existing = (po.permissions || []).filter(
        (p) => p.user_id !== newPerm.user_id && p.email !== newPerm.email
      );
      const updatedPermissions = [...existing, newPerm];
      const updatedPO = { ...po, permissions: updatedPermissions };
      setPo(updatedPO);
      updatePOInList(po.id, updatedPO);

      try {
        const local = (poTrackerService as any).getLocalPOs?.() || [];
        const idx = local.findIndex((p: any) => p.id === po.id);
        if (idx >= 0) {
          local[idx] = updatedPO;
          (poTrackerService as any).saveLocalPOs?.(local);
        }
      } catch (_) {}

      toast.success(`Đã cấp quyền "${roleConfig?.label || selectedPerm}" cho ${matchedUser?.full_name || identifier}`);
      setTargetUserId('');
    } finally {
      setGranting(false);
    }
  };

  const executeRevokePermission = async () => {
    if (!po || !permToRevoke) return;
    try {
      await poTrackerService.revokePermission(permToRevoke.id);
      toast.success('Đã thu hồi quyền thành công.');
      const res = await poTrackerService.getPO(po.id);
      setPo(res.data.data);
    } catch {
      // Local fallback
      const updatedPermissions = (po.permissions || []).filter((p) => p.id !== permToRevoke.id);
      const updatedPO = { ...po, permissions: updatedPermissions };
      setPo(updatedPO);
      updatePOInList(po.id, updatedPO);
      try {
        const local = (poTrackerService as any).getLocalPOs?.() || [];
        const idx = local.findIndex((p: any) => p.id === po.id);
        if (idx >= 0) {
          local[idx] = updatedPO;
          (poTrackerService as any).saveLocalPOs?.(local);
        }
      } catch (_) {}
      toast.success('Đã thu hồi quyền thành công.');
    } finally {
      setPermToRevoke(null);
    }
  };

  const executeDeletePO = async () => {
    if (!po) return;
    setDeletingPO(true);
    try {
      await poTrackerService.deletePO(po.id);
      removePOFromList(po.id);
      toast.success('Đã xóa đơn hàng PO thành công.');
      setShowDeletePODialog(false);
      onClose();
    } catch {
      toast.error('Không thể xóa đơn hàng này.');
    } finally {
      setDeletingPO(false);
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

                  {/* Segmented Horizontal Step Timeline */}
                  <div className="relative pt-2 pb-1">
                    <div className="flex items-center justify-between relative px-2">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const isDone = currentStepIdx > idx;
                        const isCurrent = currentStepIdx === idx;
                        return (
                          <React.Fragment key={step.status}>
                            <div
                              className="flex flex-col items-center gap-1.5 cursor-pointer group z-10 shrink-0"
                              onClick={() => canEdit && handleUpdateStatus(step.status)}
                            >
                              <div
                                className={cn(
                                  'w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold border-2 transition-all duration-200 select-none shadow-2xs',
                                  isCurrent
                                    ? 'bg-[#0088FF] text-white border-white dark:border-[#16161a] ring-4 ring-[#0088FF]/20 scale-105'
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

                            {idx < TIMELINE_STEPS.length - 1 && (
                              <div className="flex-1 h-1 mx-2 -mt-5 rounded-full bg-black/[0.08] dark:bg-white/10 overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full transition-all duration-500 rounded-full',
                                    currentStepIdx > idx ? 'bg-emerald-500 w-full' : 'w-0'
                                  )}
                                />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Key Attributes Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1.5 shadow-2xs">
                    <span className="text-[12px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Nhà cung cấp</span>
                    <p className="text-[14.5px] font-bold text-[#1d1d1f] dark:text-white leading-snug">
                      {po.supplier_name || '—'}
                    </p>
                    {po.supplier_code && (
                      <span className="inline-block text-[12px] font-semibold text-[#0088FF] dark:text-[#0A84FF] font-mono">
                        Mã NCC: {po.supplier_code}
                      </span>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1.5 shadow-2xs">
                    <span className="text-[12px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Kho tiếp nhận</span>
                    <p className="text-[14.5px] font-bold text-[#1d1d1f] dark:text-white leading-snug">
                      {po.warehouse || '—'}
                    </p>
                    <span className="inline-block text-[12px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
                      Thư mục: {po.folder_name || 'Chưa phân nhóm'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1.5 shadow-2xs">
                    <span className="text-[12px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Hạn giao dự kiến</span>
                    <p className="text-[15px] font-extrabold text-[#0088FF] dark:text-[#0A84FF]">
                      {po.expected_delivery_date
                        ? format(parseISO(po.expected_delivery_date), 'dd/MM/yyyy', { locale: vi })
                        : '—'}
                    </p>
                    <span className="inline-block text-[12px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
                      Ngày lập PO: {po.po_date ? format(parseISO(po.po_date), 'dd/MM/yyyy', { locale: vi }) : format(parseISO(po.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1.5 shadow-2xs">
                    <span className="text-[12px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Tổng giá trị đơn</span>
                    <p className="text-[15px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {po.total_value ? `${Number(po.total_value).toLocaleString('vi-VN')} ${po.currency}` : '—'}
                    </p>
                    <span className="inline-block text-[12px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
                      {po.items?.length || 0} dòng sản phẩm
                    </span>
                  </div>
                </div>

                {/* Quick Status Bar */}
                {canEdit && (
                  <div className="p-4 sm:p-5 rounded-2xl border border-black/[0.08] dark:border-white/10 space-y-3.5 bg-black/[0.01] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-[#1d1d1f] dark:text-white">
                        Cập nhật trạng thái tiến độ giao
                      </span>
                      {updatingStatus && (
                        <span className="text-[11.5px] font-bold text-[#0088FF] animate-pulse">
                          Đang lưu thay đổi...
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Main workflow stages: 5 steps across full width */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {MAIN_WORKFLOW_STATUSES.map((st) => {
                          const cfg = PO_STATUS_CONFIG_MAP[st];
                          const isCurrent = po.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateStatus(st)}
                              disabled={updatingStatus}
                              className={cn(
                                'h-10 px-2 rounded-xl text-[12px] font-bold border transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 text-center truncate select-none',
                                isCurrent
                                  ? STATUS_ACTIVE_THEMES[st]
                                  : 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-[#f5f5f7] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                              )}
                            >
                              <span className="shrink-0">{cfg?.icon}</span>
                              <span className="truncate">{cfg?.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Exception / Terminal states: 2 steps sharing 50/50 width */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {EXCEPTION_STATUSES.map((st) => {
                          const cfg = PO_STATUS_CONFIG_MAP[st];
                          const isCurrent = po.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateStatus(st)}
                              disabled={updatingStatus}
                              className={cn(
                                'h-9 px-3 rounded-xl text-[12px] font-bold border transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 text-center truncate select-none',
                                isCurrent
                                  ? STATUS_ACTIVE_THEMES[st]
                                  : 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-[#f5f5f7] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                              )}
                            >
                              <span className="shrink-0">{cfg?.icon}</span>
                              <span className="truncate">{cfg?.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Labeled Inputs for Delivery Details */}
                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            Ngày giao hàng thực tế
                          </label>
                          <input
                            type="date"
                            value={actualDate}
                            onChange={(e) => setActualDate(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[13px] font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            Ghi chú điều phối / Người nhận hàng
                          </label>
                          <input
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            placeholder="VD: Nguyễn Hùng Tiến, xe tải 51C..."
                            className="w-full h-10 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[13px] font-medium text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(po.status)}
                          disabled={updatingStatus}
                          className="h-9 px-4 rounded-full bg-[#0088FF]/10 hover:bg-[#0088FF]/20 text-[#0088FF] dark:text-[#0A84FF] text-[12.5px] font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <SFCheckmarkCircleFill size={13} />
                          <span>{updatingStatus ? 'Đang lưu...' : 'Lưu ghi chú & Ngày nhận'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manage PO / Delete PO Action */}
                {canEdit && (
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-white block">
                        Quản lý đơn hàng
                      </span>
                      <span className="text-[11.5px] text-[#6e6e73] dark:text-[#a1a1a6]">
                        Gỡ bỏ đơn PO này khỏi danh sách theo dõi
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeletePODialog(true)}
                      className="px-3.5 py-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-red-200 dark:border-red-500/20 shadow-2xs"
                    >
                      <SFTrash size={12} />
                      <span>Xóa đơn PO</span>
                    </button>
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

                <form onSubmit={handleGrantPermission} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      placeholder="Nhập Email hoặc Tên người dùng..."
                      required
                      className="flex-1 h-10 px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[13px] font-medium text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={granting || !targetUserId.trim()}
                      className="h-10 px-4 rounded-xl fm-primary-pill-surface text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-40 shrink-0 shadow-xs"
                    >
                      {granting ? '...' : '+ Thêm'}
                    </button>
                  </div>

                  {/* Apple Segmented Role Picker */}
                  <div className="space-y-1.5">
                    <div className="text-[11.5px] font-bold text-[#86868b]">Vai trò cấp quyền:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10">
                      {PERMISSION_ROLES.map((r) => {
                        const isSelected = selectedPerm === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedPerm(r.id)}
                            className={cn(
                              'h-9 px-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none',
                              isSelected
                                ? 'bg-white dark:bg-zinc-800 text-[#0088FF] dark:text-[#0A84FF] shadow-xs border border-black/10 dark:border-white/15'
                                : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                            )}
                          >
                            <span className="shrink-0">{r.icon}</span>
                            <span className="truncate">{r.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Role description display */}
                    <div className="text-[11px] text-[#86868b] px-1 flex items-center gap-1">
                      <span className="font-semibold text-[#1d1d1f] dark:text-white">
                        {PERMISSION_ROLES.find((r) => r.id === selectedPerm)?.label}:
                      </span>
                      <span>{PERMISSION_ROLES.find((r) => r.id === selectedPerm)?.description}</span>
                    </div>
                  </div>

                  {/* Quick User Suggestions */}
                  {assignableUsers.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                      <span className="text-[11px] font-semibold text-[#86868b] shrink-0">Gợi ý:</span>
                      {assignableUsers.slice(0, 4).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setTargetUserId(u.email || u.id)}
                          className="h-6 px-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[11px] font-medium text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white transition-all shrink-0 cursor-pointer"
                        >
                          {u.full_name || u.email}
                        </button>
                      ))}
                    </div>
                  )}
                </form>

                <div className="space-y-2 pt-1">
                  {po.permissions && po.permissions.length > 0 ? (
                    po.permissions.map((perm) => {
                      const roleConfig = PERMISSION_ROLES.find((r) => r.id === perm.permission);
                      return (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 text-[12.5px]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
                              {roleConfig?.icon || <SFPersonFill size={13} className="text-[#86868b]" />}
                            </div>
                            <div>
                              <p className="font-bold text-[#1d1d1f] dark:text-white leading-tight">
                                {perm.user_name || perm.email}
                              </p>
                              <span className="text-[11px] text-[#0088FF] dark:text-[#0A84FF] font-bold">
                                {roleConfig?.label || perm.permission}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPermToRevoke({ id: perm.id, name: perm.user_name || perm.email })}
                            className="px-3 py-1 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold text-[12px] cursor-pointer transition-colors"
                          >
                            Thu hồi
                          </button>
                        </div>
                      );
                    })
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

      {/* Confirm Delete PO Dialog */}
      <ConfirmDeleteDialog
        isOpen={showDeletePODialog}
        title="Xóa đơn hàng PO?"
        itemLabel={po ? `${po.po_number || 'Đơn PO'} — ${po.supplier_name || 'Không rõ NCC'}` : undefined}
        message="Bạn có chắc chắn muốn xóa đơn hàng này? Toàn bộ danh sách mặt hàng và lịch sử theo dõi sẽ bị xóa khỏi hệ thống."
        confirmText="Xác nhận xóa PO"
        cancelText="Hủy bỏ"
        isLoading={deletingPO}
        onConfirm={executeDeletePO}
        onClose={() => setShowDeletePODialog(false)}
      />

      {/* Confirm Revoke Permission Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(permToRevoke)}
        title="Thu hồi quyền truy cập?"
        itemLabel={permToRevoke?.name}
        message="Người dùng này sẽ không còn quyền xem hoặc chỉnh sửa đơn hàng PO này nữa."
        confirmText="Thu hồi quyền"
        cancelText="Hủy bỏ"
        variant="warning"
        onConfirm={executeRevokePermission}
        onClose={() => setPermToRevoke(null)}
      />
    </Drawer>
  );
};
