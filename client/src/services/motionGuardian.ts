/**
 * ==============================================================================
 * 🛡️ FM WORKSPACE - MOTION & ANIMATION GUARDIAN AGENT (macOS 27 & iOS 18)
 * ==============================================================================
 * Ràng buộc bất khả xâm phạm: Toàn bộ chuyển động, hiệu ứng lò xo vật lý Apple
 * Liquid Glass (120 FPS), chuyển tab, mở/đóng cửa sổ, và các hiệu ứng giao diện
 * BẮT BUỘC luôn hoạt động 100% bình thường, trơn tru và sinh động — NGAY CẢ KHI
 * cài đặt hệ thống của Windows ("Animation effects: Off") hoặc macOS ("Reduce Motion")
 * đang được bật.
 * ==============================================================================
 */

class MotionGuardianAgent {
  private isEnforced = false;

  public enforceMotion(): void {
    if (this.isEnforced || typeof window === 'undefined') return;
    this.isEnforced = true;

    // 1. Intercept window.matchMedia at the prototype / window level
    this.interceptMatchMedia();

    // 2. Enforce CSS Root Motion Tokens directly on DOM documentElement
    this.enforceCssTokens();

    console.log('[MotionGuardian] ✅ Đã kích hoạt Agent bảo vệ chuyển động: Toàn bộ animation Apple Liquid Glass 120 FPS được bảo lưu 100% độc lập với cài đặt Windows/macOS.');
  }

  /**
   * Đánh chặn mọi truy vấn `prefers-reduced-motion` từ các thư viện JS,
   * CSS-in-JS, browser hooks để luôn trả về `matches: false`.
   */
  private interceptMatchMedia(): void {
    if (!window.matchMedia) return;

    const originalMatchMedia = window.matchMedia.bind(window);

    window.matchMedia = function (query: string): MediaQueryList {
      const normalized = (query || '').toLowerCase();
      if (normalized.includes('prefers-reduced-motion') || normalized.includes('reduced-motion')) {
        const dummyMql: MediaQueryList = {
          matches: false, // Luôn là false: Không bao giờ giảm chuyển động
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        };
        return dummyMql;
      }
      return originalMatchMedia(query);
    };
  }

  /**
   * Đảm bảo toàn bộ CSS Variables về duration và easing luôn tồn tại
   * và không bị bất kỳ stylesheet nào ghi đè thành 0s hay none.
   */
  private enforceCssTokens(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--motion-duration-press', '80ms');
    root.style.setProperty('--motion-duration-micro', '110ms');
    root.style.setProperty('--motion-duration-hover', '150ms');
    root.style.setProperty('--motion-duration-tab', '180ms');
    root.style.setProperty('--motion-duration-popover', '210ms');
    root.style.setProperty('--motion-duration-exit', '180ms');
    root.style.setProperty('--motion-duration-sidebar', '240ms');
    root.style.setProperty('--motion-duration-modal', '260ms');
    root.style.setProperty('--motion-duration-spatial', '320ms');
    root.style.setProperty('--motion-ease-spring', 'cubic-bezier(0.16, 1, 0.3, 1)');
    root.style.setProperty('--motion-ease-fluid', 'cubic-bezier(0.32, 0.72, 0, 1)');
    root.style.setProperty('--motion-ease-snappy', 'cubic-bezier(0.18, 0.9, 0.22, 1)');
    root.style.setProperty('--motion-ease-exit', 'cubic-bezier(0.3, 0, 0.8, 0.15)');
  }
}

export const motionGuardian = new MotionGuardianAgent();
