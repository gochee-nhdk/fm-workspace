import React, { useState, useEffect } from 'react';
import {
  SFKey,
  SFCheckmarkCircleFill,
  SFExclamationmarkTriangleFill,
  SFArrowClockwise,
  SFArrowUp,
  SFTrash,
  SFPlus,
  SFSparkles,
  SFSquareOnSquare,
} from '@/components/ui/AppleIcon';
import {
  getGeminiKeysPool,
  saveGeminiKeysPool,
  setStoredGeminiKey,
  addGeminiKey,
  updateGeminiKey,
  deleteGeminiKey,
  setPrimaryKey,
  testSingleGeminiKey,
  testAllGeminiKeys,
  type GeminiKeyItem,
} from '@/services/writingToolsService';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { AppleSwitch } from '@/components/ui/AppleCheckbox';
import { cn } from '@/lib/utils';
import { triggerLiquidSpringClick } from '@/services/motionGuardian';
import toast from 'react-hot-toast';

const GeminiLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    <path
      d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
      fill="url(#gemini-grad-settings)"
    />
    <defs>
      <linearGradient id="gemini-grad-settings" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1A73E8" />
        <stop offset="0.5" stopColor="#8AB4F8" />
        <stop offset="1" stopColor="#D93025" />
      </linearGradient>
    </defs>
  </svg>
);

export const AiKeysTab: React.FC = React.memo(() => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [geminiKeys, setGeminiKeys] = useState<GeminiKeyItem[]>(() => getGeminiKeysPool());
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isTestingAllKeys, setIsTestingAllKeys] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; name: string } | null>(null);

  const syncPoolToServer = (pool: GeminiKeyItem[]) => {
    if (!useAuthStore.getState().isAuthenticated) return;
    api.put('/settings/gemini-keys-pool', { pool }).catch((err) => {
      console.warn('[AiKeysTab] Failed to sync Gemini key pool to server:', err);
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchServerKeys = async () => {
      try {
        const res = await api.get('/settings/gemini-keys-pool');
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const local = getGeminiKeysPool();
          if (local.length === 0) {
            setGeminiKeys(res.data.data);
            const unmaskedOnly = res.data.data.filter(
              (item: GeminiKeyItem) => item.key && !item.key.includes('••••')
            );
            if (unmaskedOnly.length > 0) {
              saveGeminiKeysPool(unmaskedOnly);
            }
          }
        }
      } catch (err) {
        console.warn('[AiKeysTab] Failed to fetch server Gemini keys:', err);
      }
    };
    fetchServerKeys();
  }, [isAuthenticated]);

  const handleAddGeminiKey = async () => {
    const key = newKeyInput.trim();
    if (!key) {
      toast.error('Vui lòng nhập Google Gemini API Key.');
      return;
    }
    if (geminiKeys.some((k) => k.key === key)) {
      toast.error('Khóa API này đã tồn tại trong danh sách.');
      return;
    }

    setIsAddingKey(true);
    try {
      const newItem = addGeminiKey(key);
      setStoredGeminiKey(key);
      const updatedPool = getGeminiKeysPool();
      setGeminiKeys(updatedPool);
      setNewKeyInput('');
      toast.success(`Đã thêm ${newItem.name} vào danh sách dự phòng!`);

      setTestingKeyId(newItem.id);
      const testRes = await testSingleGeminiKey(newItem.key);
      updateGeminiKey(newItem.id, {
        status: testRes.status,
        statusMessage: testRes.message,
        model: testRes.model,
        provider: 'gemini',
        lastCheckedAt: new Date().toISOString(),
      });
      const refreshedPool = getGeminiKeysPool();
      setGeminiKeys(refreshedPool);

      syncPoolToServer(refreshedPool);
      if (useAuthStore.getState().isAuthenticated) {
        api.put('/settings/gemini-key', { api_key: key }).catch((err) => {
          console.warn('[AiKeysTab] Failed to sync primary Gemini key:', err);
        });
      }
    } finally {
      setIsAddingKey(false);
      setTestingKeyId(null);
    }
  };

  const executeDeleteGeminiKey = (id: string, name: string) => {
    deleteGeminiKey(id);
    const updated = getGeminiKeysPool();
    setGeminiKeys(updated);
    syncPoolToServer(updated);
    toast.success(`Đã xóa ${name}.`);
    setKeyToDelete(null);
  };

  const handleSetPrimaryGeminiKey = (id: string) => {
    setPrimaryKey(id);
    const updated = getGeminiKeysPool();
    setGeminiKeys(updated);
    syncPoolToServer(updated);
    toast.success('Đã chuyển thành Khóa chính ưu tiên số 1!');
  };

  const handleToggleActiveGeminiKey = (id: string, currentActive: boolean) => {
    updateGeminiKey(id, { isActive: !currentActive });
    const updated = getGeminiKeysPool();
    setGeminiKeys(updated);
    syncPoolToServer(updated);
    toast.success(!currentActive ? 'Đã kích hoạt khóa.' : 'Đã tạm dừng khóa.');
  };

  const handleTestSingleGeminiKey = async (item: GeminiKeyItem) => {
    setTestingKeyId(item.id);
    try {
      const res = await testSingleGeminiKey(item.key);
      updateGeminiKey(item.id, {
        status: res.status,
        statusMessage: res.message,
        model: res.model,
        provider: 'gemini',
        lastCheckedAt: new Date().toISOString(),
      });
      const updated = getGeminiKeysPool();
      setGeminiKeys(updated);
      syncPoolToServer(updated);

      if (res.status === 'active') {
        toast.success(`${item.name}: Hoạt động tốt! (${res.model || 'Gemini Flash'})`);
      } else if (res.status === 'quota_exceeded') {
        toast('Khóa đã hết hạn mức (429) — Hệ thống sẽ dùng khóa dự phòng!', { icon: '⚠️' });
      } else {
        toast.error(`${item.name}: ${res.message}`);
      }
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleTestAllGeminiKeys = async () => {
    if (geminiKeys.length === 0) {
      toast('Chưa có khóa API nào để kiểm tra.', { icon: 'ℹ️' });
      return;
    }
    setIsTestingAllKeys(true);
    toast.loading('Đang kiểm tra toàn bộ các khóa API Gemini...', { id: 'test-all-keys' });
    try {
      const tested = await testAllGeminiKeys();
      setGeminiKeys(tested);
      syncPoolToServer(tested);
      toast.dismiss('test-all-keys');
      const activeCount = tested.filter((k) => k.status === 'active').length;
      const quotaCount = tested.filter((k) => k.status === 'quota_exceeded').length;
      if (activeCount > 0) {
        toast.success(`Đã kiểm tra xong! ${activeCount} khóa hoạt động realtime, ${quotaCount} khóa hết quota.`);
      } else {
        toast('Đã kiểm tra xong! Tất cả các khóa đều đã chạm hạn mức quota trên Google AI Studio.', { icon: '⚠️' });
      }
    } catch (err: any) {
      toast.dismiss('test-all-keys');
      toast.error('Lỗi khi kiểm tra danh sách khóa: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsTestingAllKeys(false);
    }
  };

  const activeCount = geminiKeys.filter((k) => k.isActive && k.status === 'active').length;
  const quotaCount = geminiKeys.filter((k) => k.isActive && k.status === 'quota_exceeded').length;
  const invalidCount = geminiKeys.filter((k) => k.status === 'invalid').length;

  return (
    <div className="space-y-6">
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SFKey size={18} className="text-[#0071e3] dark:text-[#2997ff]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
              Cấu Hình API Key (AI Soạn Thảo &amp; OCR)
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {geminiKeys.length === 0 ? (
              <div className="apple-badge-base apple-badge-neutral">
                <SFKey size={12} className="shrink-0" />
                <span>Chưa cài đặt khóa</span>
              </div>
            ) : (
              <>
                {activeCount > 0 && (
                  <div className="apple-badge-base apple-badge-success">
                    <SFCheckmarkCircleFill size={12} className="shrink-0" />
                    <span>{activeCount} khóa sẵn sàng</span>
                  </div>
                )}
                {quotaCount > 0 && (
                  <div className="apple-badge-base apple-badge-warning">
                    <SFExclamationmarkTriangleFill size={12} className="shrink-0 text-amber-500" />
                    <span>{quotaCount} khóa hết quota</span>
                  </div>
                )}
                {invalidCount > 0 && (
                  <div className="apple-badge-base bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    <span>{invalidCount} khóa lỗi</span>
                  </div>
                )}
              </>
            )}

            <Button
              variant="glass"
              size="sm"
              onClick={handleTestAllGeminiKeys}
              disabled={isTestingAllKeys || geminiKeys.length === 0}
              icon={<SFArrowClockwise size={13} className={isTestingAllKeys ? 'animate-spin' : ''} />}
              title="Kiểm tra trạng thái thực tế của tất cả các khóa"
            >
              {isTestingAllKeys ? 'Đang kiểm tra...' : 'Kiểm tra tất cả'}
            </Button>
          </div>
        </div>

        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Cấu hình các khóa API Google Gemini áp dụng cho toàn bộ ứng dụng gồm <strong>Trợ lý soạn thảo thông minh</strong> (Writing Tools) và <strong>Quét trích xuất nội dung từ ảnh</strong> (OCR). Bạn có thể thêm không giới hạn các khóa dự phòng để hệ thống tự động chuyển đổi khi khóa trước đó chạm trần hạn mức (429 Too Many Requests).
        </p>

        <div className="space-y-3">
          {geminiKeys.length === 0 ? (
            <div className="p-8 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 text-center">
              <div className="w-12 h-12 rounded-full bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center mx-auto mb-3">
                <SFKey size={22} />
              </div>
              <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white">Chưa có khóa API nào được cài đặt</p>
              <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] mt-1 max-w-sm mx-auto">
                Hãy thêm khóa Gemini API bên dưới để sử dụng đầy đủ tính năng AI Soạn thảo văn bản và Quét trích xuất chữ từ ảnh (OCR).
              </p>
            </div>
          ) : (
            geminiKeys.map((item, idx) => {
              const isPrimary = idx === 0;
              const isTesting = testingKeyId === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 rounded-xl transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-200 border',
                    isPrimary
                      ? 'bg-[#0071e3]/[0.03] dark:bg-[#0071e3]/[0.05] border-[#0071e3]/25 shadow-2xs'
                      : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10',
                    !item.isActive && 'opacity-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white">
                          {item.name}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-white border border-black/5 dark:border-white/5 tracking-wide">
                          <GeminiLogo className="w-3.5 h-3.5 shrink-0" />
                          <span className="uppercase font-semibold">Gemini</span>
                        </span>

                        {item.status === 'active' && (
                          <div className="apple-badge-base apple-badge-success text-[11px] py-0.5 px-2.5 min-h-[22px]">
                            <SFCheckmarkCircleFill size={11} className="shrink-0" />
                            <span>Hoạt động {item.model ? `(${item.model})` : ''}</span>
                          </div>
                        )}
                        {item.status === 'quota_exceeded' && (
                          <div className="apple-badge-base apple-badge-warning text-[11px] py-0.5 px-2.5 min-h-[22px]">
                            <SFExclamationmarkTriangleFill size={11} className="shrink-0 text-amber-500" />
                            <span>Hết hạn mức (429) — Sẵn sàng chuyển dự phòng</span>
                          </div>
                        )}
                        {item.status === 'invalid' && (
                          <div className="apple-badge-base bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[11px] py-0.5 px-2.5 min-h-[22px]">
                            <span>Khóa không hợp lệ</span>
                          </div>
                        )}
                        {item.status === 'unchecked' && (
                          <div className="apple-badge-base apple-badge-neutral text-[11px] py-0.5 px-2.5 min-h-[22px]">
                            <span>Chưa kiểm tra</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <div className="font-mono text-[12px] text-[#1d1d1f] dark:text-white bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 max-w-full overflow-hidden">
                          <span className="truncate">
                            {item.key.length > 10
                              ? `${item.key.substring(0, 6)}••••••••••••••••${item.key.slice(-4)}`
                              : '••••••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(item.key)
                                .then(() => toast.success('Đã sao chép khóa API!'))
                                .catch(() => toast.error('Không thể sao chép khóa API'));
                            }}
                            className="text-[#86868b] hover:text-[#0071e3] dark:hover:text-[#2997ff] p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                            title="Sao chép khóa API"
                          >
                            <SFSquareOnSquare size={13} />
                          </button>
                        </div>
                      </div>

                      {item.statusMessage && (
                        <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] pt-0.5">
                          {item.statusMessage}
                          {item.lastCheckedAt && (
                            <span className="opacity-60 ml-2">
                              • Kiểm tra lúc {new Date(item.lastCheckedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <button
                        type="button"
                        onClick={() => handleTestSingleGeminiKey(item)}
                        disabled={isTesting}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1d1d1f] dark:text-white transition-[transform,opacity,background-color,border-color,color,box-shadow] cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Kiểm tra khóa này"
                      >
                        <SFArrowClockwise size={13} className={isTesting ? 'animate-spin' : ''} />
                      </button>

                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={(e) => {
                            triggerLiquidSpringClick(e.currentTarget);
                            handleSetPrimaryGeminiKey(item.id);
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] transition-[transform,opacity,background-color,border-color,color,box-shadow] cursor-pointer active:scale-95"
                          title="Đưa lên đầu danh sách (Làm khóa mặc định)"
                        >
                          <SFArrowUp size={13} />
                        </button>
                      )}

                      <AppleSwitch
                        checked={item.isActive}
                        onChange={() => handleToggleActiveGeminiKey(item.id, item.isActive)}
                        size="sm"
                        title={item.isActive ? 'Khóa đang BẬT (nhấp để tạm dừng)' : 'Khóa đang TẮT (nhấp để kích hoạt)'}
                      />

                      <button
                        type="button"
                        onClick={() => setKeyToDelete({ id: item.id, name: item.name })}
                        className="w-7 h-7 rounded-full text-[#86868b] hover:text-[#ff383c] hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
                        title="Xóa khóa này"
                      >
                        <SFTrash size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-4 border-t border-[#e0e0e0] dark:border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
              <SFPlus size={13} className="text-[#0071e3] dark:text-[#2997ff]" />
              <span>Thêm khóa Google Gemini API</span>
            </h4>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0071e3] dark:text-[#2997ff] hover:underline"
            >
              <SFKey size={12} />
              <span>Lấy khóa Gemini miễn phí (Google AI Studio) ↗</span>
            </a>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2">
            <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
              <SFSparkles size={13} className="text-[#0071e3] dark:text-[#2997ff]" />
              <span>Cách lấy khóa Google Gemini API trong 3 bước:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11.5px] text-[#555558] dark:text-[#a1a1a6]">
              <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-0.5">
                <span className="font-semibold text-[#0071e3] dark:text-[#2997ff]">Bước 1:</span>
                <p>Nhấp vào liên kết <strong>Google AI Studio</strong> ở góc trên và đăng nhập bằng tài khoản Google.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-0.5">
                <span className="font-semibold text-[#0071e3] dark:text-[#2997ff]">Bước 2:</span>
                <p>Bấm nút <strong>Create API key</strong> (Tạo khóa API) rồi chọn tạo khóa mới cho dự án.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-0.5">
                <span className="font-semibold text-[#0071e3] dark:text-[#2997ff]">Bước 3:</span>
                <p>Sao chép mã khóa từ Google AI Studio (bắt đầu bằng <strong>AIzaSy...</strong> hoặc <strong>AQ.Ab...</strong>), dán vào ô bên dưới và bấm <strong>Thêm khóa</strong>.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <GeminiLogo className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                placeholder="Dán mã Google Gemini API Key (AIzaSy... hoặc AQ.Ab...)"
                className="w-full pl-9 pr-3.5 py-2 text-[13px] font-mono rounded-xl bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] dark:focus:border-[#2997ff] transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGeminiKey();
                  }
                }}
              />
            </div>
            <Button
              variant="glassProminent"
              size="sm"
              onClick={handleAddGeminiKey}
              disabled={isAddingKey || !newKeyInput.trim()}
              icon={<SFPlus size={13} />}
              className="rounded-xl px-4 py-2"
            >
              {isAddingKey ? 'Đang thêm...' : 'Thêm khóa'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        isOpen={Boolean(keyToDelete)}
        title="Xóa khóa API?"
        message="Hệ thống sẽ không thể sử dụng khóa API này để dự phòng khi gọi Google Gemini hoặc OCR nữa. Hành động này không thể hoàn tác."
        itemLabel={keyToDelete?.name}
        confirmText="Xóa khóa"
        cancelText="Hủy"
        onConfirm={() => {
          if (keyToDelete) {
            executeDeleteGeminiKey(keyToDelete.id, keyToDelete.name);
          }
        }}
        onCancel={() => setKeyToDelete(null)}
      />
    </div>
  );
});
