import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  SFExclamationmarkTriangleFill,
  SFArrowCounterclockwise,
  SFHouse,
  SFChevronDown,
  SFChevronUp,
  SFSquareOnSquare,
  SFCheckmark
} from 'sf-symbols-lib';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public handleGoHome = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  public handleCopyError = () => {
    const errorText = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}\n${this.state.error?.stack || ''}`;
    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="relative min-h-[460px] w-full flex items-center justify-center p-4 sm:p-8 font-sans select-none overflow-hidden">
          {/* Ambient Caustic Glows */}
          <div className="ambient-glow-azure opacity-60 pointer-events-none" />
          <div className="ambient-glow-sunset opacity-40 pointer-events-none" />

          {/* Liquid Glass Error Card */}
          <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-[28px] backdrop-blur-3xl bg-white/80 dark:bg-[#16161c]/80 border border-white/80 dark:border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.12),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-1px_1.5px_rgba(0,0,0,0.06)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.18)] flex flex-col items-center text-center z-10 transition-all duration-300">
            {/* Top Specular Meniscus Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none" />

            {/* Apple Squircle Alert Badge */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-amber-500/20 to-rose-500/10 dark:from-amber-400/25 dark:to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-md shadow-amber-500/15 mb-4 group">
              <SFExclamationmarkTriangleFill size={28} className="drop-shadow-xs" />
            </div>

            {/* Heading */}
            <h3 className="text-[18px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight mb-2">
              Đã có sự cố hiển thị xảy ra
            </h3>

            {/* Friendly explanation */}
            <p className="text-[13.5px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed max-w-sm mb-5">
              Hệ thống đã tự động cách ly sự cố hiển thị để bảo vệ dữ liệu công việc của bạn an toàn. Bạn có thể tải lại trang để tiếp tục.
            </p>

            {/* Error Message Pill */}
            <div className="w-full mb-5">
              <div className="px-3.5 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[12px] font-mono text-[#d70015] dark:text-[#ff6961] truncate">
                {this.state.error?.message || 'Lỗi không xác định'}
              </div>

              {/* Toggle technical details */}
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="mt-2 text-[11.5px] font-medium text-[#0071e3] dark:text-[#2997ff] hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                {this.state.showDetails ? (
                  <>
                    <span>Ẩn chi tiết kỹ thuật</span>
                    <SFChevronUp size={12} />
                  </>
                ) : (
                  <>
                    <span>Xem chi tiết lỗi kỹ thuật</span>
                    <SFChevronDown size={12} />
                  </>
                )}
              </button>

              {/* Collapsible Details Drawer */}
              {this.state.showDetails && (
                <div className="mt-2.5 p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 text-left relative animate-in fade-in duration-200">
                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="absolute top-2 right-2 px-2 py-1 rounded-md text-[10.5px] font-medium bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 text-[#1d1d1f] dark:text-white border border-black/10 dark:border-white/10 flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Sao chép lỗi"
                  >
                    {this.state.copied ? (
                      <>
                        <SFCheckmark size={12} className="text-[#34c759]" />
                        <span className="text-[#34c759]">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <SFSquareOnSquare size={12} />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                  <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-36 pr-16 select-text whitespace-pre-wrap break-words">
                    {this.state.error?.stack || this.state.error?.message || 'No stack trace available'}
                  </pre>
                </div>
              )}
            </div>

            {/* Apple Liquid Glass Action Buttons */}
            <div className="flex items-center gap-3 w-full justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-b from-[#007aff] to-[#0062cc] text-white font-semibold text-[13px] shadow-[0_6px_20px_rgba(0,122,255,0.35),inset_0_1.5px_1px_rgba(255,255,255,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <SFArrowCounterclockwise size={14} />
                <span>Tải lại trang</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[13px] border border-black/[0.06] dark:border-white/10 active:scale-[0.98] transition-all cursor-pointer"
              >
                <SFHouse size={14} />
                <span>Về trang chủ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
