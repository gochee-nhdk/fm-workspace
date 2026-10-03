import React, { useState, useEffect, useRef } from 'react';
import { useSecurityStore } from '@/stores/security-store';
import { SFShieldFill } from 'sf-symbols-lib';
import { Lock, Unlock, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const LocalLockScreen: React.FC = () => {
  const { isLocked, unlock } = useSecurityStore();
  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLocked) {
      setPin('');
      setErrorMsg('');
      inputRef.current?.focus();
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleUnlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin.trim()) return;

    const success = await unlock(pin.trim());
    if (!success) {
      setIsShaking(true);
      setErrorMsg('Mã PIN không chính xác. Vui lòng thử lại.');
      setPin('');
      setTimeout(() => {
        setIsShaking(false);
        inputRef.current?.focus();
      }, 500);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-3xl select-none animate-fade-in">
      {/* Specular Ambient Glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-[#0071e3]/20 dark:bg-[#0071e3]/30 rounded-full blur-[120px] pointer-events-none" />

      <div
        className={`relative w-full max-w-sm p-8 rounded-[28px] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col items-center text-center space-y-6 ${
          isShaking ? 'apple-shake' : ''
        }`}
      >
        {/* Apple Lock Glass Emblem */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#0088ff] to-[#0071e3] p-0.5 shadow-[0_8px_24px_rgba(0,113,227,0.35)] flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
            <Lock size={28} className="drop-shadow-sm" />
          </div>
        </div>

        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
            FM Workspace Đã Khóa
          </h2>
          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-1">
            Nhập mã PIN cá nhân để tiếp tục làm việc
          </p>
        </div>

        {/* PIN Dots Indicator */}
        <div className="flex items-center justify-center gap-3 py-1">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-[#0071e3] dark:bg-[#2997ff] scale-110 shadow-[0_0_8px_rgba(0,113,227,0.5)]'
                    : 'bg-black/15 dark:bg-white/20'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <p className="text-[12px] font-medium text-red-500 dark:text-red-400 animate-fade-in -mt-2">
            {errorMsg}
          </p>
        )}

        {/* Hidden or direct input */}
        <form onSubmit={handleUnlock} className="w-full">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setErrorMsg('');
            }}
            placeholder="Nhập mã PIN..."
            className="w-full px-4 py-2.5 rounded-xl text-center text-[18px] tracking-[0.3em] font-mono bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
            autoFocus
          />

          <div className="mt-4 flex gap-2">
            <Button
              type="submit"
              variant="glassProminent"
              size="md"
              disabled={!pin.trim()}
              className="w-full rounded-full py-2.5 font-semibold text-[14px]"
            >
              Mở Khóa
            </Button>
          </div>
        </form>

        <div className="pt-2 text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] flex items-center justify-center gap-1.5">
          <SFShieldFill size={13} className="text-[#34c759]" />
          <span>Mã PIN được bảo vệ bằng mã hóa SHA-256 an toàn cục bộ</span>
        </div>
      </div>
    </div>
  );
};
