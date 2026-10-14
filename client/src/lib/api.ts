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

let tokenBootstrapPromise: Promise<string | null> | null = null;

async function ensureLocalToken(): Promise<string | null> {
  const existingToken = localStorage.getItem('token');
  if (existingToken) return existingToken;

  if (!tokenBootstrapPromise) {
    tokenBootstrapPromise = (async () => {
      try {
        const res = await axios.post(`${getApiBaseUrl()}/auth/local-token`, {}, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 4000,
        });
        if (res.data?.token) {
          localStorage.setItem('token', res.data.token);
          if (res.data?.user) {
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
          return res.data.token;
        }
      } catch (_) {
        // Fallback or offline
      } finally {
        tokenBootstrapPromise = null;
      }
      return null;
    })();
  }
  return tokenBootstrapPromise;
}

// Request interceptor to attach JWT token
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('token');
  if (!token && !config.url?.includes('/auth/')) {
    token = await ensureLocalToken();
  }
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
