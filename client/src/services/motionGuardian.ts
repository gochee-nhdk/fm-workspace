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

    // 3. Inject explicit anti-reduced-motion stylesheet to override browser-level flags
    this.injectForcedMotionStyles();

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

  /**
   * Ghi đè tuyệt đối CSS stylesheet ở cấp trình duyệt:
   * Nếu hệ điều hành Windows tắt hiệu ứng animation ("Animation effects: Off"),
   * các class chuyển động Apple Liquid Glass vẫn tiếp tục hoạt động mượt mà 120 FPS.
   */
  private injectForcedMotionStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('motion-guardian-override')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'motion-guardian-override';
    styleEl.textContent = `
      @media (prefers-reduced-motion: reduce) {
        .liquid-auth-btn,
        .liquid-auth-trigger,
        .liquid-motion-forced,
        .liquid-motion-forced *,
        .liquid-lens-pill,
        .liquid-lens-pill-active,
        .animate-liquid-sheen,
        .animate-liquid-pulse {
          animation-play-state: running !important;
          transition-duration: 0.22s !important;
          transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

/**
 * Kích hoạt xung lực lò xo vật lý tức thì (Web Animations API),
 * hoàn toàn độc lập với hệ điều hành và hoạt động 100% trong mọi điều kiện.
 */
export function triggerLiquidSpringClick(target: HTMLElement | null): void {
  if (!target) return;
  try {
    target.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(0.952)', filter: 'brightness(0.95)' },
        { transform: 'scale(1.028)', filter: 'brightness(1.08)' },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      {
        duration: 260,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'none',
      }
    );
  } catch (_) {}
}

export const motionGuardian = new MotionGuardianAgent();
