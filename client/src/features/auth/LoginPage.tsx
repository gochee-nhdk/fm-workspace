import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { Button, Input, Alert } from '@/components/ui';
import { Package, Lock, Mail, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@farmersmarket.vn');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      const resData = res.data;
      const token = resData?.token || resData?.data?.token;
      const user = resData?.user || resData?.data?.user;

      if (token && user) {
        login(token, user);
        toast.success(`Chào mừng ${user.full_name || 'Quản trị viên'} quay trở lại!`);
        navigate('/');
      } else {
        setError(resData?.message || resData?.error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Email hoặc mật khẩu không chính xác.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#e8f4fd] via-[#f0f4ff] to-[#eaf4f0] dark:from-[#0a0a0f] dark:via-[#0f0f1a] dark:to-[#0a1410]">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-400/20 dark:bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-teal-400/20 dark:bg-teal-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/20 mb-2">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            AI Procurement Copilot
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hệ thống hỗ trợ Thu mua & Merchandising — Farmers Market (Laria)
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-material rounded-[28px] p-8 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#1d1d1f] dark:text-white">Đăng nhập</h2>
            <p className="text-xs text-[#76767b] dark:text-[#a1a1a6]">
              Nhập tài khoản để truy cập không gian làm việc của bạn
            </p>
          </div>

          {error && (
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email công việc"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@farmersmarket.vn"
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
            />

            <Input
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="current-password"
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="glassProminent"
                className="w-full py-2.5"
                loading={loading}
              >
                Đăng nhập vào hệ thống
              </Button>
            </div>
          </form>

          <div className="pt-4 border-t border-white/20 dark:border-white/10 text-center">
            <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6]">
              Tài khoản quản trị viên mặc định: <code className="text-[#1d1d1f] dark:text-white font-mono">admin@farmersmarket.vn</code>
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-[#76767b] dark:text-[#a1a1a6]">
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>Bảo mật cấp doanh nghiệp • Zero-Data Workspace • Gemini AI Grounded</span>
        </div>
      </div>
    </div>
  );
};