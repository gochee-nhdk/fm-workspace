import { api } from '@/lib/api';
import {
  POTrackerPO,
  POFolderItem,
  POExtractedData,
  POTrackerStats,
  POPermission,
} from '@/types/po-tracker';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export const poTrackerService = {
  // ─── Folders ───────────────────────────────────────────────────────────────
  getFolders: () =>
    api.get<ApiResponse<POFolderItem[]>>('/po-tracker/folders'),

  createFolder: (data: Partial<POFolderItem>) =>
    api.post<ApiResponse<POFolderItem>>('/po-tracker/folders', data),

  updateFolder: (id: string, data: Partial<POFolderItem>) =>
    api.put<ApiResponse<POFolderItem>>(`/po-tracker/folders/${id}`, data),

  deleteFolder: (id: string) =>
    api.delete<ApiResponse<null>>(`/po-tracker/folders/${id}`),

  // ─── PDF Upload ────────────────────────────────────────────────────────────
  uploadPdf: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<ApiResponse<POExtractedData>>('/po-tracker/upload-pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000, // 60s for large PDFs + Gemini processing
    });
  },

  // ─── Purchase Orders ───────────────────────────────────────────────────────
  getPOs: (params?: { folder_id?: string; status?: string; search?: string }) =>
    api.get<ApiResponse<POTrackerPO[]>>('/po-tracker/pos', { params }),

  getPO: (id: string) =>
    api.get<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`),

  createPO: (data: Partial<POTrackerPO> & { items?: any[] }) =>
    api.post<ApiResponse<POTrackerPO>>('/po-tracker/pos', data),

  updatePO: (id: string, data: Partial<POTrackerPO> & { items?: any[] }) =>
    api.put<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`, data),

  deletePO: (id: string) =>
    api.delete<ApiResponse<null>>(`/po-tracker/pos/${id}`),

  updateStatus: (id: string, status: string, actual_delivery_date?: string, notes?: string) =>
    api.patch<ApiResponse<null>>(`/po-tracker/pos/${id}/status`, {
      status,
      actual_delivery_date,
      notes,
    }),

  // ─── Stats ────────────────────────────────────────────────────────────────
  getStats: (folder_id?: string) =>
    api.get<ApiResponse<POTrackerStats>>('/po-tracker/stats', {
      params: folder_id ? { folder_id } : undefined,
    }),

  // ─── Permissions ──────────────────────────────────────────────────────────
  getPermissions: (resourceType: 'folder' | 'po', resourceId: string) =>
    api.get(`/po-tracker/permissions/${resourceType}/${resourceId}`),

  grantPermission: (payload: {
    target_user_id: string;
    resource_type: 'folder' | 'po' | 'global';
    resource_id: string | null;
    permission: POPermission;
  }) => api.post('/po-tracker/permissions', payload),

  revokePermission: (permId: string) =>
    api.delete(`/po-tracker/permissions/${permId}`),
};
