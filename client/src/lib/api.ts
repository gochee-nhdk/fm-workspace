import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`;
  }
  return '/api';
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
