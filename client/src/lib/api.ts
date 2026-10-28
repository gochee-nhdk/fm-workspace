import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

export const resolveApiBaseUrl = (rawUrl?: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '/api';
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const getApiBaseUrl = (): string => {
  return resolveApiBaseUrl(import.meta.env?.VITE_API_URL);
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token if available
api.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } else if (error.response?.status === 403) {
      toast.error('Bạn không có quyền thực hiện hành động này.');
    } else if (error.response?.status && error.response.status >= 500) {
      toast.error('Lỗi hệ thống máy chủ. Vui lòng thử lại sau.');
    }
    return Promise.reject(error);
  }
);
