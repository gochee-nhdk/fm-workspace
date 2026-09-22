import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link as LinkIcon,
  Shield,
  Store,
  FileSpreadsheet,
  Plus,
  ExternalLink,
  Star,
  Copy,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataService } from '@/services/dataService';
import { WorkspaceSummary, LinkItem, StoreItem, ActivityLogItem } from '@/types/workspace';
import { LinkDrawerForm } from '@/components/forms/LinkDrawerForm';
import { AccountDrawerForm } from '@/components/forms/AccountDrawerForm';
import { StoreDrawerForm } from '@/components/forms/StoreDrawerForm';
import { useLiquidTilt } from '@/hooks/useLiquidTilt';
import toast from 'react-hot-toast';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [openLinkDrawer, setOpenLinkDrawer] = useState(false);
  const [openAccountDrawer, setOpenAccountDrawer] = useState(false);
  const [openStoreDrawer, setOpenStoreDrawer] = useState(false);

  const bannerTiltRef = useLiquidTilt<HTMLDivElement>({ maxTilt: 1.5 });
  const linksCardRef = useLiquidTilt<HTMLDivElement>({ maxTilt: 2.8 });
  const accountsCardRef = useLiquidTilt<HTMLDivElement>({ maxTilt: 2.8 });
  const storesCardRef = useLiquidTilt<HTMLDivElement>({ maxTilt: 2.8 });

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await dataService.getWorkspaceSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  const isAllEmpty =
    summary &&
    summary.totalLinks === 0 &&
    summary.totalAccounts === 0 &&
    summary.totalStores === 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner / Welcome with 3D Liquid Glass */}
      <div
        ref={bannerTiltRef}
        className="glass-material-interactive liquid-tilt-card ios-animate-in rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-7 sm:p-8 hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/40 transition-all duration-300"
      >
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-14 h-14 rounded-2xl overflow-hidden bg-[#FAC426] flex items-center justify-center shadow-xs border border-black/5 dark:border-white/20 shrink-0 mt-1 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none"
            title="Nhấn để làm mới trang"
          >
            <img src="/logo.png" alt="Farmers Market" className="w-full h-full object-cover" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]">
                FARMERS MARKET
              </span>
              <span className="text-[13px] text-[#7a7a7a]">Internal Workspace</span>
            </div>
            <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white mt-1.5">
              Bàn làm việc Tổng hợp
            </h1>
            <p className="text-[15px] sm:text-[17px] text-[#7a7a7a] mt-1 max-w-xl leading-[1.47]">
              Mọi phím tắt hệ thống, thông tin tài khoản và danh sách cửa hàng tập trung tại một nơi với giao diện tối giản, tiện lợi và hiện đại.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons with Glass Grouping Container */}
        <div className="glass-container p-1.5 flex flex-wrap items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
            icon={<FileSpreadsheet className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff]" />}
          >
            Import Excel
          </Button>
          <Button
            variant="glassProminent"
            size="sm"
            onClick={() => setOpenLinkDrawer(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Thêm Link mới
          </Button>
        </div>
      </div>

      {/* 3 Metric Cards (Apple 3D Liquid Glass Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 ios-animate-in ios-stagger-1">
        {/* Total Links Card */}
        <div
          ref={linksCardRef}
          onClick={() => navigate('/links')}
          className="glass-material-interactive liquid-tilt-card rounded-[22px] p-6 cursor-pointer hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/50 transition-all duration-300 active:scale-[0.985] group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#76767b] dark:text-[#a1a1a6] uppercase tracking-wider">
              Quick Links
            </span>
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#0066cc]/15 to-[#0077ed]/5 dark:from-[#2997ff]/20 dark:to-transparent border border-[#0066cc]/20 dark:border-[#2997ff]/30 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shadow-[0_0_16px_rgba(0,102,204,0.18)] group-hover:scale-110 transition-transform duration-200">
              <LinkIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[36px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
              {summary?.totalLinks ?? 0}
            </span>
            <span className="text-[13px] text-[#76767b] dark:text-[#a1a1a6]">hệ thống</span>
          </div>
          <div className="mt-3 flex items-center text-[14px] text-[#0066cc] dark:text-[#2997ff] font-medium gap-1">
            <span>Xem và mở link nhanh</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Total Accounts Card */}
        <div
          ref={accountsCardRef}
          onClick={() => navigate('/accounts')}
          className="glass-material-interactive liquid-tilt-card rounded-[22px] p-6 cursor-pointer hover:border-emerald-500/40 dark:hover:border-emerald-400/50 transition-all duration-300 active:scale-[0.985] group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#76767b] dark:text-[#a1a1a6] uppercase tracking-wider">
              Account Vault
            </span>
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-emerald-500/15 to-teal-500/5 dark:from-emerald-400/20 dark:to-transparent border border-emerald-500/20 dark:border-emerald-400/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.18)] group-hover:scale-110 transition-transform duration-200">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[36px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
              {summary?.totalAccounts ?? 0}
            </span>
            <span className="text-[13px] text-[#76767b] dark:text-[#a1a1a6]">tài khoản</span>
          </div>
          <div className="mt-3 flex items-center text-[14px] text-emerald-600 dark:text-emerald-400 font-medium gap-1">
            <span>Quản lý thông tin đăng nhập</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Total Stores Card */}
        <div
          ref={storesCardRef}
          onClick={() => navigate('/stores')}
          className="glass-material-interactive liquid-tilt-card rounded-[22px] p-6 cursor-pointer hover:border-amber-500/40 dark:hover:border-amber-400/50 transition-all duration-300 active:scale-[0.985] group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#76767b] dark:text-[#a1a1a6] uppercase tracking-wider">
              Danh Mục Cửa Hàng
            </span>
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-amber-500/15 to-orange-500/5 dark:from-amber-400/20 dark:to-transparent border border-amber-500/20 dark:border-amber-400/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.18)] group-hover:scale-110 transition-transform duration-200">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[36px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
              {summary?.totalStores ?? 0}
            </span>
            <span className="text-[13px] text-[#76767b] dark:text-[#a1a1a6]">chi nhánh</span>
          </div>
          <div className="mt-3 flex items-center text-[14px] text-amber-600 dark:text-amber-400 font-medium gap-1">
            <span>Tra cứu địa chỉ & Maps</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>


      {/* When All Empty: Prominent Empty State */}
      {isAllEmpty && (
        <div className="glass-material p-10 text-center rounded-[22px] space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] flex items-center justify-center shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
              Workspace của bạn đang trống
            </h3>
            <p className="text-[13px] text-[#76767b] dark:text-[#a1a1a6] leading-relaxed">
              Bạn có thể bắt đầu thêm dữ liệu ngay bằng cách bấm Import file Excel hoặc dùng các nút thêm nhanh bên dưới.
            </p>
          </div>
          <div className="glass-container p-1.5 inline-flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button
              variant="glassProminent"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
              icon={<FileSpreadsheet className="w-4 h-4" />}
            >
              Import File Excel
            </Button>
            <Button
              variant="glass"
              size="sm"
              onClick={() => setOpenLinkDrawer(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Thêm Link đầu tiên
            </Button>
            <Button
              variant="glass"
              size="sm"
              onClick={() => setOpenAccountDrawer(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Thêm Tài khoản
            </Button>
            <Button
              variant="glass"
              size="sm"
              onClick={() => setOpenStoreDrawer(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Thêm Cửa hàng
            </Button>
          </div>
        </div>
      )}

      {/* Grid: Favorite Links & Recent Stores */}
      {!isAllEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 ios-animate-in ios-stagger-2">
          {/* Favorite & Quick Access Links */}
          <div className="glass-material rounded-[22px] p-6 flex flex-col hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/40 transition-all duration-300">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0]/70 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
                  Phím tắt & Liên kết Thường dùng
                </h3>
              </div>
              <button
                onClick={() => navigate('/links')}
                className="text-[13px] text-[#0066cc] dark:text-[#2997ff] font-normal hover:underline flex items-center gap-1"
              >
                Tất cả ({summary?.totalLinks})
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="pt-3 divide-y divide-[#e0e0e0]/50 dark:divide-white/5 flex-1">
              {summary && summary.favoriteLinks.length > 0 ? (
                summary.favoriteLinks.slice(0, 6).map((link) => (
                  <div
                    key={link.id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-black/5 dark:hover:bg-white/5 px-2.5 rounded-xl transition-all duration-150"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#1d1d1f] dark:text-white truncate">
                          {link.hangMuc}
                        </span>
                        {link.category && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 text-[#7a7a7a]">
                            {link.category}
                          </span>
                        )}
                      </div>
                      {link.note && (
                        <p className="text-[12px] text-[#7a7a7a] truncate mt-0.5">{link.note}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {link.link ? (
                        <a
                          href={link.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0066cc]/10 transition-all active:scale-95 shadow-2xs"
                          title="Mở trong tab mới"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#272729] text-[#7a7a7a]">
                          Missing link
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[14px] text-[#7a7a7a] space-y-2">
                  <p>Chưa có liên kết nào được ghim yêu thích.</p>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => navigate('/links')}
                  >
                    Vào trang Links để ghim
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stores Directory */}
          <div className="glass-material rounded-[22px] p-6 flex flex-col hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/40 transition-all duration-300">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0]/70 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#0066cc]" />
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
                  Cửa Hàng Tra cứu Nhanh
                </h3>
              </div>
              <button
                onClick={() => navigate('/stores')}
                className="text-[13px] text-[#0066cc] dark:text-[#2997ff] font-normal hover:underline flex items-center gap-1"
              >
                Tất cả ({summary?.totalStores})
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="pt-3 divide-y divide-[#e0e0e0]/50 dark:divide-white/5 flex-1">
              {summary && summary.recentStores.length > 0 ? (
                summary.recentStores.map((st) => (
                  <div
                    key={st.id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-black/5 dark:hover:bg-white/5 px-2.5 rounded-xl transition-all duration-150"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-[#0066cc] dark:text-[#2997ff] px-2 py-0.5 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/20">
                          {st.storeCode}
                        </span>
                        <span className="text-[14px] text-[#1d1d1f] dark:text-white truncate">
                          {st.address}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopy(st.address, 'địa chỉ')}
                        className="w-8 h-8 rounded-full bg-[#fafafc] dark:bg-[#272729] border border-[#e0e0e0] dark:border-white/10 flex items-center justify-center text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white transition-colors active:scale-95"
                        title="Sao chép địa chỉ"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {st.googleMaps && (
                        <a
                          href={st.googleMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center hover:bg-[#0066cc]/20 transition-colors active:scale-95"
                          title="Mở Google Maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[14px] text-[#7a7a7a] space-y-2">
                  <p>Chưa có thông tin cửa hàng nào.</p>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => setOpenStoreDrawer(true)}
                  >
                    Thêm cửa hàng
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activities Section */}
      {summary && summary.recentActivities.length > 0 && (
        <div className="glass-material p-6 rounded-[22px] hover:border-[#0066cc]/40 dark:hover:border-[#2997ff]/40 ios-animate-in ios-stagger-3 transition-all duration-300">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0]/70 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#7a7a7a]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
                Nhật ký Hoạt động Workspace
              </h3>
            </div>
            <span className="text-[12px] text-[#7a7a7a]">
              Lưu trữ cục bộ an toàn
            </span>
          </div>

          <div className="mt-3 divide-y divide-[#e0e0e0]/50 dark:divide-white/5">
            {summary.recentActivities.slice(0, 5).map((act) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between gap-4 text-[13px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] shrink-0" />
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#272729] text-[#7a7a7a] font-medium">
                    {act.action}
                  </span>
                  <span className="text-[#1d1d1f] dark:text-white truncate">
                    {act.details}
                  </span>
                </div>
                <span className="text-[12px] text-[#7a7a7a] shrink-0">
                  {new Date(act.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(act.timestamp).toLocaleDateString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawers & Modals */}
      <LinkDrawerForm
        isOpen={openLinkDrawer}
        onClose={() => setOpenLinkDrawer(false)}
        onSave={async (data) => {
          await dataService.createLink(data);
          loadData();
        }}
      />

      <AccountDrawerForm
        isOpen={openAccountDrawer}
        onClose={() => setOpenAccountDrawer(false)}
        onSave={async (data) => {
          await dataService.createAccount(data);
          loadData();
        }}
      />

      <StoreDrawerForm
        isOpen={openStoreDrawer}
        onClose={() => setOpenStoreDrawer(false)}
        onSave={async (data) => {
          await dataService.createStore(data);
          loadData();
        }}
      />
    </div>
  );
};