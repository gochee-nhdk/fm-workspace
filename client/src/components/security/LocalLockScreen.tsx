import React, { useState, useEffect, useRef } from 'react';
import { useSecurityStore } from '@/stores/security-store';
import { SFShieldFill } from 'sf-symbols-lib';
import { Lock, Delete, Grid3X3 } from 'lucide-react';
import toast from 'react-hot-toast';

export const LocalLockScreen: React.FC = () => {
  const { isLocked, unlock } = useSecurityStore();
  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showKeypad, setShowKeypad] = useState(() => typeof window !== 'undefined' && (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus hidden input on lock and handle auto-refocus
  useEffect(() => {
    if (isLocked) {
      setPin('');
      setIsError(false);
      setIsShaking(false);
      setIsVerifying(false);
      setShowResetConfirm(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isLocked]);

  useEffect(() => {
    if (!isLocked) return;
    const handleWindowFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isLocked]);

  if (!isLocked) return null;

  const submitPin = async (candidatePin: string) => {
    if (isVerifying || candidatePin.length !== 6) return;
    setIsVerifying(true);

    const success = await unlock(candidatePin);
    if (success) {
      setPin('');
      setIsError(false);
      setIsShaking(false);
      setIsVerifying(false);
      setFailedAttempts(0);
      setShowResetConfirm(false);
    } else {
      setIsShaking(true);
      setIsError(true);
      setFailedAttempts((prev) => prev + 1);

      // Tactile reset: keep red indicator during shake, then clear for next attempt
      setTimeout(() => {
        setPin('');
        setIsShaking(false);
        setIsError(false);
        setIsVerifying(false);
        inputRef.current?.focus();
      }, 600);
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= 6 || isVerifying) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setIsError(false);
    if (nextPin.length === 6) {
      submitPin(nextPin);
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
    inputRef.current?.focus();
  };

  const handleEmergencyReset = () => {
    useSecurityStore.setState({ isLocked: false, isLockEnabled: false, pinHash: null });
    toast.success('🛡️ Đã mở khóa workspace và đặt lại mã PIN. Dữ liệu của bạn được giữ nguyên an toàn 100%.');
    setShowResetConfirm(false);
    setFailedAttempts(0);
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-2xl select-none animate-fade-in">
      {/* Specular Ambient Glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-[#0071e3]/15 dark:bg-[#0071e3]/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Apple Liquid Glass Dialog Card - 100% Identical to PIN Setup Modal */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.focus();
        }}
        className={`w-full max-w-[340px] bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 text-center space-y-4 relative cursor-default ${
          isShaking ? 'apple-shake' : ''
        }`}
      >
        {/* Header Icon */}
        <div className="space-y-1.5 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs mx-auto mb-2">
            <Lock size={22} />
          </div>
          <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
            FM Workspace Đã Khóa
          </h3>
          <p className="text-[12px] min-h-[18px] transition-colors duration-150">
            {isError ? (
              <span className="text-rose-500 font-medium">Mã PIN không chính xác! Vui lòng thử lại</span>
            ) : isVerifying ? (
              <span className="text-[#0071e3] dark:text-[#2997ff] font-medium">Đang xác thực mã PIN...</span>
            ) : (
              <span className="text-[#86868b] dark:text-[#a1a1a6]">Nhập mã PIN 6 số để mở khóa</span>
            )}
          </p>
        </div>

        {/* 6 Visual Apple Passcode Dots with Fluid Scale & Fill */}
        <div className="flex items-center justify-center gap-3.5 my-2 cursor-pointer relative py-2">
          {Array.from({ length: 6 }).map((_, i) => {
            const isFilled = i < pin.length;
            return (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  isError
                    ? 'bg-rose-500 shadow-xs scale-110'
                    : isFilled
                    ? 'bg-[#0071e3] dark:bg-[#2997ff] shadow-xs scale-110'
                    : 'border-2 border-black/20 dark:border-white/25 bg-transparent'
                }`}
              />
            );
          })}

          {/* Hidden Active Input for True Numeric Keypad / Keyboard capture */}
          <input
            ref={inputRef}
            id="local-lock-screen-pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={pin}
            onKeyDown={(e) => {
              if (['Backspace', 'Tab', 'Escape'].includes(e.key)) {
                if (e.key === 'Escape') {
                  if (pin.length > 0) {
                    setPin('');
                    setIsError(false);
                  }
                }
                if (e.key === 'Backspace') {
                  e.preventDefault();
                  handleBackspace();
                }
                return;
              }
              if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                return;
              }
              e.preventDefault();
              handleDigit(e.key);
            }}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPin(digits);
              setIsError(false);
              if (digits.length === 6) {
                submitPin(digits);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Nhập mã PIN 6 số"
          />
        </div>

        {/* Security status pill badge */}
        <div className="flex items-center justify-center">
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1.5">
            <SFShieldFill size={11} className="text-[#34c759]" />
            <span>Bảo mật SHA-256 an toàn cục bộ</span>
          </span>
        </div>

        {/* Optional Clean Apple Numeric Keypad for mouse/touch interactions */}
        {showKeypad && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="grid grid-cols-3 gap-2 pt-2 animate-fade-in"
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-10 rounded-2xl text-[16px] font-medium bg-black/[0.04] dark:bg-white/[0.07] hover:bg-[#0071e3]/15 dark:hover:bg-[#2997ff]/25 text-[#1d1d1f] dark:text-white border border-black/5 dark:border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center select-none"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setIsError(false);
                inputRef.current?.focus();
              }}
              className="h-10 rounded-2xl text-[12px] font-medium text-[#86868b] dark:text-[#a1a1a6] bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/5 dark:border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center select-none"
            >
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-10 rounded-2xl text-[16px] font-medium bg-black/[0.04] dark:bg-white/[0.07] hover:bg-[#0071e3]/15 dark:hover:bg-[#2997ff]/25 text-[#1d1d1f] dark:text-white border border-black/5 dark:border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-10 rounded-2xl text-[14px] text-[#86868b] dark:text-[#a1a1a6] bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/5 dark:border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center select-none"
            >
              <Delete size={16} />
            </button>
          </div>
        )}

        {/* Emergency Reset Box if multiple failed attempts */}
        {failedAttempts >= 3 && !showResetConfirm && (
          <div className="pt-1 animate-fade-in text-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowResetConfirm(true);
              }}
              className="text-[11.5px] font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Quên mã PIN? Mở khóa khẩn cấp
            </button>
          </div>
        )}

        {showResetConfirm && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-3 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 text-center space-y-2 animate-fade-in"
          >
            <p className="text-[11.5px] text-rose-600 dark:text-rose-300 font-medium leading-relaxed">
              Đặt lại mã PIN và mở khóa ngay? Dữ liệu hàng hóa của bạn sẽ được giữ nguyên an toàn 100%.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1 rounded-full text-[11px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleEmergencyReset}
                className="px-3 py-1 rounded-full text-[11px] font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                Xác nhận mở khóa
              </button>
            </div>
          </div>
        )}

        {/* Bottom Actions - Identical to Settings Apple dialog action row */}
        <div className="flex items-center justify-between w-full pt-2 border-t border-black/[0.06] dark:border-white/10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowKeypad((prev) => !prev);
            }}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <Grid3X3 size={13} className="text-[#0071e3] dark:text-[#2997ff]" />
            <span>{showKeypad ? 'Ẩn phím' : 'Bàn phím số'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBackspace();
            }}
            disabled={pin.length === 0}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
          >
            <Delete size={13} />
            <span>Xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
