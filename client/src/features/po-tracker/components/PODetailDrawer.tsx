import React, { useState, useEffect } from 'react';
import {
  POTrackerPO,
  POStatus,
  POPermission,
  POPermissionRecord,
  POTrackerItemLine,
} from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { useNoteStore } from '@/stores/note-store';
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
  SFTrash,
  SFEye,
  SFBubbleLeftFill,
  SFCheckmarkShieldFill,
  SFPersonFill,
  SFCheckmark,
  SFDocumentOnDocument,
  SFExclamationmarkTriangleFill,
  SFPlus,
  SFXmark,
  SFEnvelope
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
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
  const [updatingItems, setUpdatingItems] = useState(false);
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
  const [showMailModal, setShowMailModal] = useState(false);

  const generateMailDraft = () => {
    if (!po) return { subject: '', bodyText: '', htmlBody: '' };
    const finalPoNum = po.po_number || 'PO-CHUA-CO-MA';
    const finalSupplier = po.supplier_name || 'Quý Nhà cung cấp';
    const finalTotal = po.total_value || 0;

    const subject = `[Xác nhận đơn hàng PO] ${finalPoNum} - Farmers Market gửi ${finalSupplier}`;

    const itemsText = po.items && po.items.length > 0
      ? po.items.map((it, idx) => `  ${idx + 1}. ${it.item_name} (Mã: ${it.item_code || 'N/A'}) - SL đặt: ${it.ordered_qty} ${it.unit} (Đã nhận: ${it.received_qty || 0}) - Đơn giá: ${Math.round(it.unit_price).toLocaleString('vi-VN')} ₫`).join('\n')
      : '  (Chưa có danh mục mặt hàng chi tiết)';

    const bodyText = `Kính gửi Quý Nhà cung cấp ${finalSupplier},

Công ty TNHH Thương mại Laria (Farmers Market) xin gửi thông tin xác nhận đơn đặt hàng PO:

1. THÔNG TIN CHỨNG TỪ:
- Số hiệu chứng từ PO: ${finalPoNum}
- Ngày lập đơn hàng: ${po.po_date || 'Chưa cập nhật'}
- Hạn giao hàng dự kiến: ${po.expected_delivery_date || 'Theo thỏa thuận'}
- Kho tiếp nhận hàng: ${po.warehouse || 'Kho Farmers Market'}
- Tổng giá trị đơn hàng: ${Math.round(finalTotal).toLocaleString('vi-VN')} ₫
- Trạng thái hiện tại: ${PO_STATUS_CONFIG_MAP[po.status]?.label || po.status}

2. CHI TIẾT DANH MỤC HÀNG HÓA:
${itemsText}

${po.notes ? `3. GHI CHÚ ĐIỀU PHỐI:\n${po.notes}\n\n` : ''}
Kính đề nghị Quý NCC kiểm tra số lượng và phản hồi email này để xác nhận lịch giao hàng.

Trân trọng cảm ơn sự hợp tác của Quý đối tác!
Phòng Thu mua / Supply Chain - Farmers Market`;

    const htmlBody = `<h3>[Xác nhận đơn hàng PO] ${finalPoNum} - Farmers Market gửi ${finalSupplier}</h3>
<p>Kính gửi Quý Nhà cung cấp <b>${finalSupplier}</b>,</p>
<p>Farmers Market xin gửi thông tin xác nhận đơn đặt hàng PO chi tiết:</p>
<ul>
  <li><b>Số PO:</b> ${finalPoNum}</li>
  <li><b>Ngày lập đơn:</b> ${po.po_date || 'Chưa cập nhật'}</li>
  <li><b>Hạn giao hàng dự kiến:</b> ${po.expected_delivery_date || 'Theo thỏa thuận'}</li>
  <li><b>Kho tiếp nhận hàng:</b> ${po.warehouse || 'Kho Farmers Market'}</li>
  <li><b>Tổng giá trị đơn:</b> ${Math.round(finalTotal).toLocaleString('vi-VN')} ₫</li>
  <li><b>Trạng thái:</b> ${PO_STATUS_CONFIG_MAP[po.status]?.label || po.status}</li>
</ul>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%; margin: 12px 0;">
  <thead>
    <tr style="background-color: #f5f5f7;">
      <th>STT</th>
      <th>Mã hàng</th>
      <th>Tên mặt hàng</th>
      <th>ĐVT</th>
      <th>SL đặt</th>
      <th>Đã nhận</th>
      <th>Đơn giá</th>
    </tr>
  </thead>
  <tbody>
    ${(po.items || []).map((it, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${it.item_code || ''}</td>
        <td><b>${it.item_name}</b></td>
        <td style="text-align: center;">${it.unit}</td>
        <td style="text-align: right;">${it.ordered_qty}</td>
        <td style="text-align: right; color: green;"><b>${it.received_qty || 0}</b></td>
        <td style="text-align: right;">${Math.round(it.unit_price).toLocaleString('vi-VN')} ₫</td>
      </tr>
    `).join('')}
  </tbody>
</table>
${po.notes ? `<p><b>Ghi chú điều phối:</b> ${po.notes}</p>` : ''}
<p>Trân trọng cảm ơn sự hợp tác của Quý đối tác!<br/><b>Farmers Market Procurement Team</b></p>`;

    return { subject, bodyText, htmlBody };
  };

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

  const handleUpdateStatus = async (newStatus: POStatus, autoReceiveAllItems = false) => {
    if (!po) return;
    setUpdatingStatus(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextActualDate = actualDate || (newStatus === 'received' ? today : po.actual_delivery_date);

      let nextItems = po.items ? [...po.items] : [];
      if (autoReceiveAllItems && nextItems.length > 0) {
        nextItems = nextItems.map((it) => ({
          ...it,
          received_qty: it.ordered_qty,
          status: 'received' as const,
        }));
      }

      await poTrackerService.updateStatus(
        po.id,
        newStatus,
        nextActualDate || undefined,
        statusNotes
      );

      if (autoReceiveAllItems && nextItems.length > 0) {
        await poTrackerService.updatePO(po.id, {
          items: nextItems,
          status: newStatus,
          actual_delivery_date: nextActualDate || undefined,
          notes: statusNotes,
        });
      }

      const updated: POTrackerPO = {
        ...po,
        status: newStatus,
        actual_delivery_date: nextActualDate || null,
        notes: statusNotes,
        items: nextItems,
        total_received_qty: nextItems.reduce((s, i) => s + (i.received_qty || 0), 0),
      };

      setPo(updated);
      updatePOInList(po.id, updated);
      toast.success(`Đã cập nhật: ${PO_STATUS_CONFIG_MAP[newStatus]?.label || newStatus}`);
    } catch {
      toast.error('Lỗi cập nhật trạng thái đơn hàng.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdateItemReceived = async (itemIndex: number, receivedQty: number) => {
    if (!po || !po.items) return;
    if (receivedQty < 0) {
      toast.error('Số lượng nhận không được là số âm.');
    }
    const safeQty = Math.max(0, receivedQty);
    const nextItems = [...po.items];
    const item = { ...nextItems[itemIndex] };

    // BUG-011: Warn if receivedQty exceeds ordered_qty
    if (safeQty > item.ordered_qty) {
      toast(`Cảnh báo: Số lượng nhận (${safeQty}) vượt quá số lượng đặt (${item.ordered_qty})!`, {
        icon: '⚠️',
        id: `over-receive-${item.id || itemIndex}`,
      });
    }

    item.received_qty = safeQty;
    item.status = safeQty >= item.ordered_qty ? 'received' : safeQty > 0 ? 'partial' : 'pending';
    nextItems[itemIndex] = item;

    const allReceived = nextItems.every((it) => it.received_qty >= it.ordered_qty);
    const someReceived = nextItems.some((it) => (it.received_qty || 0) > 0);
    const newStatus: POStatus = allReceived ? 'received' : someReceived ? 'partial_received' : po.status;

    try {
      poTrackerService.receiveItems(po.id, {
        items: [{ id: item.id, item_code: item.item_code || undefined, received_qty: safeQty }],
      }).catch(() => {});
      await poTrackerService.updatePO(po.id, {
        items: nextItems,
        status: newStatus,
      });
      const updated = {
        ...po,
        items: nextItems,
        status: newStatus,
        total_received_qty: nextItems.reduce((s, i) => s + (i.received_qty || 0), 0),
      };
      setPo(updated);
      updatePOInList(po.id, updated);
    } catch {
      toast.error('Không thể lưu số lượng đã nhận.');
    }
  };

  // Quick Action: Mark all items 100% received
  const handleMarkAllReceived = async () => {
    if (!po || !po.items || po.items.length === 0) return;
    setUpdatingItems(true);
    const nextItems: POTrackerItemLine[] = po.items.map((it) => ({
      ...it,
      received_qty: it.ordered_qty,
      status: 'received' as const,
    }));
    const newStatus: POStatus = 'received';
    const today = new Date().toISOString().split('T')[0];

    try {
      poTrackerService.receiveItems(po.id, { receive_all: true }).catch(() => {});
      await poTrackerService.updatePO(po.id, {
        items: nextItems,
        status: newStatus,
        actual_delivery_date: actualDate || today,
      });
      await poTrackerService.updateStatus(po.id, newStatus, actualDate || today, statusNotes);

      const updated = {
        ...po,
        items: nextItems,
        status: newStatus,
        actual_delivery_date: actualDate || today,
        total_received_qty: nextItems.reduce((s, i) => s + (i.ordered_qty || 0), 0),
      };
      setPo(updated);
      setActualDate(today);
      updatePOInList(po.id, updated);
      toast.success('Đã đánh dấu nhận đủ 100% toàn bộ hàng hóa!');
    } catch {
      toast.error('Không thể cập nhật danh sách hàng hóa.');
    } finally {
      setUpdatingItems(false);
    }
  };

  // Quick Action: Reset all items to 0
  const handleResetAllReceived = async () => {
    if (!po || !po.items || po.items.length === 0) return;
    setUpdatingItems(true);
    const nextItems: POTrackerItemLine[] = po.items.map((it) => ({
      ...it,
      received_qty: 0,
      status: 'pending' as const,
    }));

    try {
      await poTrackerService.updatePO(po.id, {
        items: nextItems,
        status: po.status === 'received' ? 'shipping' : po.status,
      });

      const updated = {
        ...po,
        items: nextItems,
        status: (po.status === 'received' ? 'shipping' : po.status) as POStatus,
        total_received_qty: 0,
      };
      setPo(updated);
      updatePOInList(po.id, updated);
      toast.success('Đã đặt lại số lượng nhận về 0.');
    } catch {
      toast.error('Lỗi khi đặt lại số lượng.');
    } finally {
      setUpdatingItems(false);
    }
  };

  // Copy PO Summary
  const handleCopySummary = () => {
    if (!po) return;
    const lines = [
      `📦 ĐƠN HÀNG: ${po.po_number || 'Chưa có số PO'}`,
      `🏢 Nhà cung cấp: ${po.supplier_name || '—'}${po.supplier_code ? ` [${po.supplier_code}]` : ''}`,
      `📅 Hạn giao: ${po.expected_delivery_date ? format(parseISO(po.expected_delivery_date), 'dd/MM/yyyy') : '—'}`,
      `📍 Kho nhận: ${po.warehouse || '—'}`,
      `💰 Giá trị: ${po.total_value ? Number(po.total_value).toLocaleString('vi-VN') + ' ' + (po.currency || 'VND') : '—'}`,
      `📊 Trạng thái: ${PO_STATUS_CONFIG_MAP[po.status]?.label || po.status}`,
    ];
    if (po.items && po.items.length > 0) {
      lines.push(`📋 Mặt hàng (${po.items.length} món):`);
      po.items.slice(0, 8).forEach((it, i) => {
        lines.push(`  ${i + 1}. ${it.item_name}: Đã nhận ${it.received_qty || 0}/${it.ordered_qty} ${it.unit}`);
      });
      if (po.items.length > 8) {
        lines.push(`  ... và ${po.items.length - 8} mặt hàng khác`);
      }
    }
    if (po.notes) {
      lines.push(`📝 Ghi chú: ${po.notes}`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Đã sao chép tóm tắt đơn PO vào Clipboard!', { id: 'copy-po-summary' });
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
      // Local fallback
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

  const daysLeft = po?.expected_delivery_date
    ? differenceInDays(parseISO(po.expected_delivery_date), new Date())
    : null;
  const isOverdue =
    daysLeft !== null &&
    daysLeft < 0 &&
    !['received', 'cancelled'].includes(po?.status || '');

  // Computed summary in items tab
  const totalOrdered = po?.items ? po.items.reduce((s, i) => s + (i.ordered_qty || 0), 0) : 0;
  const totalReceived = po?.items ? po.items.reduce((s, i) => s + (i.received_qty || 0), 0) : 0;
  const overallPercentage = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={po?.po_number || 'Chi tiết đơn hàng PO'}
      description={po?.supplier_name ? `Đối tác: ${po.supplier_name}` : 'Theo dõi tiến độ giao hàng & kiểm nhận'}
      width="lg"
    >
      <div className="space-y-4 font-sans text-left pb-6">
        {loading || !po ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#0088FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] font-medium text-[#86868b]">Đang tải dữ liệu đơn hàng...</p>
          </div>
        ) : (
          <>
            {/* Top Toolbar: Copy Summary & Status Pill */}
            <div className="flex items-center justify-between gap-2 p-2 px-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <POStatusPill status={po.status} expectedDate={po.expected_delivery_date} size="sm" />
                {po.folder_name && (
                  <span className="text-[11.5px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] truncate">
                    📁 {po.folder_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMailModal(true)}
                  className="h-8 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 text-[11.5px] font-bold text-[#0088FF] dark:text-[#0A84FF] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Tạo / Gửi Mail xác nhận NCC theo mẫu MAIL PO"
                >
                  <SFEnvelope size={12} />
                  <span>Mail NCC</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="h-8 px-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/15 text-[11.5px] font-bold text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Sao chép toàn bộ tóm tắt đơn PO để gửi Zalo / Slack"
                >
                  <SFDocumentOnDocument size={12} className="text-[#0088FF]" />
                  <span>Sao chép tóm tắt</span>
                </button>
              </div>
            </div>

            {/* Alert Banner for Overdue or Cancelled */}
            {isOverdue && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 flex items-start gap-3 text-rose-900 dark:text-rose-200">
                <SFExclamationmarkTriangleFill size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5 text-[12.5px]">
                  <p className="font-extrabold">Đơn hàng này đã quá hạn giao {Math.abs(daysLeft!)} ngày!</p>
                  <p className="text-rose-700 dark:text-rose-300">
                    Hạn giao cam kết là ngày <b>{format(parseISO(po.expected_delivery_date!), 'dd/MM/yyyy')}</b>. Vui lòng liên hệ nhà cung cấp để đốc thúc giao hoặc cập nhật ngày nhận mới.
                  </p>
                </div>
              </div>
            )}

            {po.status === 'cancelled' && (
              <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 text-[12.5px]">
                <SFXmark size={14} className="text-zinc-500" />
                <span>Đơn hàng đã được đánh dấu hủy giao dịch.</span>
              </div>
            )}

            {/* Segmented Tab Bar */}
            <div className="flex gap-1.5 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
              {[
                { id: 'info', label: 'Tiến độ & Chi tiết' },
                { id: 'items', label: `Kiểm nhận hàng (${po.items?.length || 0})` },
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

            {/* ============================================================== */}
            {/* TAB 1: INFO & PROGRESS */}
            {/* ============================================================== */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* Visual Step Timeline */}
                <div className="p-4 sm:p-5 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-white">
                      Quy trình giao hàng
                    </span>
                    <span className="text-[12px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
                      {po.status === 'received' ? 'Đã hoàn tất 100%' : `Tiến độ: ${overallPercentage}%`}
                    </span>
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
                              onClick={() => {
                                if (canEdit) {
                                  if (step.status === 'received' && po.items && po.items.length > 0) {
                                    handleUpdateStatus('received', true);
                                  } else {
                                    handleUpdateStatus(step.status);
                                  }
                                }
                              }}
                              title={canEdit ? `Nhấp để chuyển sang: ${step.label}` : undefined}
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
                  <div className="p-3.5 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1 shadow-2xs">
                    <span className="text-[11.5px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Nhà cung cấp</span>
                    <p className="text-[14px] font-bold text-[#1d1d1f] dark:text-white leading-snug truncate" title={po.supplier_name || ''}>
                      {po.supplier_name || '—'}
                    </p>
                    {po.supplier_code && (
                      <span className="inline-block text-[11.5px] font-semibold text-[#0088FF] dark:text-[#0A84FF] font-mono">
                        Mã NCC: {po.supplier_code}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1 shadow-2xs">
                    <span className="text-[11.5px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Kho tiếp nhận</span>
                    <p className="text-[14px] font-bold text-[#1d1d1f] dark:text-white leading-snug truncate" title={po.warehouse || ''}>
                      {po.warehouse || '—'}
                    </p>
                    <span className="inline-block text-[11.5px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
                      Thư mục: {po.folder_name || 'Chưa phân nhóm'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1 shadow-2xs">
                    <span className="text-[11.5px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Hạn giao dự kiến</span>
                    <p className={cn(
                      'text-[14px] font-extrabold',
                      isOverdue ? 'text-rose-600' : 'text-[#0088FF] dark:text-[#0A84FF]'
                    )}>
                      {po.expected_delivery_date
                        ? format(parseISO(po.expected_delivery_date), 'dd/MM/yyyy', { locale: vi })
                        : '—'}
                    </p>
                    <span className="inline-block text-[11.5px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
                      Ngày lập PO: {po.po_date ? format(parseISO(po.po_date), 'dd/MM/yyyy', { locale: vi }) : format(parseISO(po.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#fbfbfd] dark:bg-[#18181c] border border-black/[0.08] dark:border-white/10 space-y-1 shadow-2xs">
                    <span className="text-[11.5px] font-extrabold uppercase text-[#48484a] dark:text-[#d1d1d6] tracking-wide">Tổng giá trị đơn</span>
                    <p className="text-[14.5px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {po.total_value ? `${Math.round(Number(po.total_value)).toLocaleString('vi-VN')} ${po.currency || 'VND'}` : '—'}
                    </p>
                    <span className="inline-block text-[11.5px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
                      {po.items?.length || 0} dòng mặt hàng ({totalOrdered} sp)
                    </span>
                  </div>
                </div>

                {/* Quick Status Bar */}
                {canEdit && (
                  <div className="p-4 rounded-2xl border border-black/[0.08] dark:border-white/10 space-y-3 bg-black/[0.01] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-[#1d1d1f] dark:text-white">
                        Cập nhật trạng thái tiến độ
                      </span>
                      {updatingStatus && (
                        <span className="text-[11.5px] font-bold text-[#0088FF] animate-pulse">
                          Đang lưu...
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {MAIN_WORKFLOW_STATUSES.map((st) => {
                          const cfg = PO_STATUS_CONFIG_MAP[st];
                          const isCurrent = po.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                if (st === 'received' && po.items && po.items.length > 0 && po.status !== 'received') {
                                  handleUpdateStatus('received', true);
                                } else {
                                  handleUpdateStatus(st);
                                }
                              }}
                              disabled={updatingStatus}
                              className={cn(
                                'h-9 px-2 rounded-xl text-[12px] font-bold border transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 text-center truncate select-none',
                                isCurrent
                                  ? STATUS_ACTIVE_THEMES[st]
                                  : 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-[#f5f5f7] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02]'
                              )}
                            >
                              <span className="shrink-0">{cfg?.icon}</span>
                              <span className="truncate">{cfg?.label}</span>
                            </button>
                          );
                        })}
                      </div>

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
                                'h-8 px-3 rounded-xl text-[12px] font-bold border transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 text-center truncate select-none',
                                isCurrent
                                  ? STATUS_ACTIVE_THEMES[st]
                                  : 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-[#f5f5f7] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02]'
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
                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            Ngày giao hàng thực tế
                          </label>
                          <input
                            type="date"
                            value={actualDate}
                            onChange={(e) => setActualDate(e.target.value)}
                            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            Ghi chú điều phối / Người nhận
                          </label>
                          <input
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            placeholder="VD: Kiểm hàng đủ, tài xế anh Nam..."
                            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[12.5px] font-medium text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(po.status)}
                          disabled={updatingStatus}
                          className="h-8 px-3.5 rounded-full bg-[#0088FF]/10 hover:bg-[#0088FF]/20 text-[#0088FF] dark:text-[#0A84FF] text-[12px] font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <SFCheckmarkCircleFill size={12} />
                          <span>{updatingStatus ? 'Đang lưu...' : 'Lưu ghi chú & Ngày thực nhận'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manage PO / Delete */}
                {canEdit && (
                  <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white block">
                        Xóa đơn hàng PO
                      </span>
                      <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">
                        Gỡ đơn này khỏi danh sách theo dõi
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeletePODialog(true)}
                      className="px-3 py-1 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[11.5px] font-bold transition-colors cursor-pointer flex items-center gap-1 border border-red-200 dark:border-red-500/20"
                    >
                      <SFTrash size={11} />
                      <span>Xóa đơn PO</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: ITEMS CHECK-IN (STREAMLINED QUICK ACTIONS) */}
            {/* ============================================================== */}
            {activeTab === 'items' && (
              <div className="space-y-3.5">
                {/* Header Summary & Bulk Actions */}
                <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-[13px] font-bold text-[#1d1d1f] dark:text-white">
                        Kiểm nhận số lượng hàng hóa
                      </h4>
                      <p className="text-[11.5px] text-[#6e6e73] dark:text-[#a1a1a6]">
                        Đã nhận: <b className="text-emerald-600 dark:text-emerald-400 font-extrabold">{totalReceived}</b> / {totalOrdered} sản phẩm ({overallPercentage}%)
                      </p>
                    </div>

                    {canEdit && po.items && po.items.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleMarkAllReceived}
                          disabled={updatingItems}
                          className="h-8 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11.5px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                          title="Tự động điền số lượng đã nhận bằng 100% số lượng đặt cho mọi mặt hàng"
                        >
                          <SFCheckmark size={12} />
                          <span>Nhận đủ 100% tất cả</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetAllReceived}
                          disabled={updatingItems}
                          className="h-8 px-2.5 rounded-xl border border-black/15 dark:border-white/15 text-[#6e6e73] hover:text-red-600 hover:bg-red-50 font-bold text-[11.5px] active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                          title="Đặt lại toàn bộ số lượng đã nhận về 0"
                        >
                          Đặt lại về 0
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Overall Item Progress Bar */}
                  <POProgressBar
                    status={po.status}
                    items={po.items}
                    received={totalReceived}
                    total={totalOrdered}
                    size="md"
                  />
                </div>

                {/* Items List */}
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {po.items && po.items.length > 0 ? (
                    po.items.map((it, idx) => {
                      const ordered = Number(it.ordered_qty || 0);
                      const received = Number(it.received_qty || 0);
                      const isFull = received >= ordered && ordered > 0;
                      const isPartial = received > 0 && !isFull;
                      const missing = Math.max(0, ordered - received);

                      return (
                        <div
                          key={it.id || idx}
                          className={cn(
                            'p-3.5 rounded-2xl border transition-all space-y-2 shadow-2xs',
                            isFull
                              ? 'bg-emerald-50/50 dark:bg-emerald-500/[0.04] border-emerald-300/80 dark:border-emerald-500/30'
                              : isPartial
                              ? 'bg-amber-50/50 dark:bg-amber-500/[0.04] border-amber-300/80 dark:border-amber-500/30'
                              : 'bg-white dark:bg-[#18181c] border-black/[0.08] dark:border-white/10'
                          )}
                        >
                          {/* Top: Name, SKU, Status Pill */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[13.5px] font-bold text-[#1d1d1f] dark:text-white leading-snug block">
                                {it.item_name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">
                                {it.item_code && (
                                  <span className="font-mono font-semibold px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5">
                                    {it.item_code}
                                  </span>
                                )}
                                {it.unit_price > 0 && (
                                  <span>Đơn giá: {Math.round(it.unit_price).toLocaleString('vi-VN')} ₫</span>
                                )}
                              </div>
                            </div>

                            <span
                              className={cn(
                                'text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums',
                                isFull
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : isPartial
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                              )}
                            >
                              {isFull ? 'Đủ 100%' : isPartial ? `Đạt ${Math.round((received / ordered) * 100)}%` : 'Chưa nhận'}
                            </span>
                          </div>

                          {/* Bottom: Ordered vs Received + Quick Controls */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04] flex-wrap">
                            <div className="text-[12px] text-[#555558] dark:text-[#a1a1a6]">
                              Đặt: <b className="text-[#1d1d1f] dark:text-white font-extrabold">{ordered} {it.unit}</b>
                              {missing > 0 && (
                                <span className="text-amber-600 dark:text-amber-400 font-medium ml-2">
                                  (thiếu {missing} {it.unit})
                                </span>
                              )}
                            </div>

                            {/* Quick Receive Controls */}
                            <div className="flex items-center gap-1.5">
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemReceived(idx, ordered)}
                                    className="h-7 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-[11px] font-bold transition-all cursor-pointer"
                                    title="Nhận đủ số lượng đặt"
                                  >
                                    Đủ ({ordered})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemReceived(idx, 0)}
                                    className="h-7 px-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 text-[#86868b] text-[11px] font-semibold transition-all cursor-pointer"
                                    title="Đặt về 0"
                                  >
                                    0
                                  </button>
                                </>
                              )}

                              <div className="flex items-center gap-1 ml-1 bg-black/[0.02] dark:bg-white/[0.04] rounded-xl px-2 py-0.5 border border-black/10 dark:border-white/10">
                                <span className="text-[11px] font-bold text-[#6e6e73]">Nhận:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={ordered * 2}
                                  value={received}
                                  disabled={!canEdit}
                                  onChange={(e) => handleUpdateItemReceived(idx, Number(e.target.value))}
                                  className="w-16 h-7 text-center rounded-lg bg-white dark:bg-zinc-800 border border-black/15 dark:border-white/15 text-[12.5px] font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0088FF]"
                                />
                                <span className="text-[11.5px] text-[#86868b] font-medium">{it.unit}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-[#86868b] text-[13px] bg-black/[0.01] rounded-2xl border border-dashed border-black/10">
                      Chưa có danh sách mặt hàng chi tiết trong đơn PO này.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: PERMISSIONS */}
            {/* ============================================================== */}
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

                  {/* Role Picker */}
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
                                : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.02]'
                            )}
                          >
                            <span className="shrink-0">{r.icon}</span>
                            <span className="truncate">{r.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suggestions */}
                  {assignableUsers.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                      <span className="text-[11px] font-semibold text-[#86868b] shrink-0">Gợi ý:</span>
                      {assignableUsers.slice(0, 4).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setTargetUserId(u.email || u.id)}
                          className="h-6 px-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] text-[11px] font-medium text-[#555558] dark:text-[#a1a1a6] transition-all shrink-0 cursor-pointer"
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
        message="Hành động này không thể hoàn tác. Toàn bộ danh sách mặt hàng và lịch sử theo dõi sẽ bị xóa khỏi hệ thống."
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
