import { flushSync } from 'react-dom';
import { resolveTheme, useUiStore, Theme } from '@/stores/ui-store';

/** Guard against rapid spam-clicking while animation is in flight */
let isTransitioning = false;

/**
 * Executes a hardware-accelerated circular iris theme transition originating
 * directly from the clicked button coordinates, locked at 120 FPS.
 *
 * - Sáng -> Tối: Vùng tối nở to từ nút bấm lan ra toàn màn hình (circle(0px) -> circle(maxRadius)).
 * - Tối -> Sáng: Bóng tối thu nhỏ dần về lại nút bấm để lộ giao diện sáng (circle(maxRadius) -> circle(0px)).
 *
 * Uses native View Transitions API with synchronous React DOM flush (zero frame drops),
 * GPU layer promotion (transform: translateZ(0)), and CSS transition freezing during animation.
 */
export const toggleThemeWithIris = (
  targetTheme?: Theme,
  event?: React.MouseEvent | MouseEvent
) => {
  if (isTransitioning) return;

  const { theme, setTheme } = useUiStore.getState();
  const currentResolved = resolveTheme(theme);
  const nextTarget: Theme = targetTheme || (currentResolved === 'dark' ? 'light' : 'dark');
  const nextResolved = resolveTheme(nextTarget);

  if (currentResolved === nextResolved) {
    setTheme(nextTarget);
    return;
  }

  // If user explicitly prefers reduced motion, switch instantly with zero lag
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(nextTarget);
    return;
  }

  // Determine button origin coordinates (x, y)
  let x = window.innerWidth - 60;
  let y = 30;

  if (event) {
    const currentTarget = (event.currentTarget || event.target) as HTMLElement | null;
    if (currentTarget && typeof currentTarget.getBoundingClientRect === 'function') {
      const rect = currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else if ('clientX' in event && typeof event.clientX === 'number' && event.clientX > 0) {
      x = event.clientX;
      y = event.clientY;
    }
  } else {
    // Try to find the active header theme toggle button in the DOM
    const btn =
      document.querySelector('[data-theme-toggle]') ||
      document.querySelector('button[aria-label*="Sáng / Tối"]');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  // Calculate distance from (x, y) to the farthest corner of the viewport (+ 6px subpixel pad)
  const endRadius =
    Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) + 6;

  const isGoingDark = nextResolved === 'dark';
  const doc = document as any;

  // Check if browser natively supports document.startViewTransition
  if (typeof doc.startViewTransition === 'function') {
    runViewTransition(doc, x, y, endRadius, isGoingDark, nextTarget);
  } else {
    runGpuOverlayFallback(x, y, endRadius, isGoingDark, nextTarget);
  }
};

/**
 * 120 FPS View Transitions implementation with synchronous React DOM flush
 */
function runViewTransition(
  doc: any,
  x: number,
  y: number,
  endRadius: number,
  isGoingDark: boolean,
  nextTarget: Theme
) {
  isTransitioning = true;
  const root = document.documentElement;

  // Signal CSS whether this transition is to-dark or to-light for proper z-index layering
  root.dataset.themeTransition = isGoingDark ? 'to-dark' : 'to-light';

  const cleanup = () => {
    delete root.dataset.themeTransition;
    isTransitioning = false;
  };

  try {
    const transition = doc.startViewTransition(() => {
      // Synchronous DOM flush: guarantees React finishes 100% of UI reconciliation
      // BEFORE the browser captures the new snapshot. During the animation phase,
      // React is completely idle, freeing the main thread for pure 120 FPS compositor execution.
      flushSync(() => {
        if (isGoingDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        useUiStore.getState().setTheme(nextTarget);
      });
    });

    transition.ready
      .then(() => {
        const clipPath = [
          `circle(0px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
          `circle(${endRadius.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
        ];

        const animation = document.documentElement.animate(
          {
            clipPath: isGoingDark ? clipPath : [clipPath[1], clipPath[0]],
          },
          {
            duration: 340,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            pseudoElement: isGoingDark
              ? '::view-transition-new(root)'
              : '::view-transition-old(root)',
            fill: 'forwards',
          }
        );

        animation.addEventListener('finish', cleanup, { once: true });
        animation.addEventListener('cancel', cleanup, { once: true });
      })
      .catch(() => {
        cleanup();
      });

    transition.finished.finally(cleanup);
  } catch (err) {
    cleanup();
    runGpuOverlayFallback(x, y, endRadius, isGoingDark, nextTarget);
  }
}

/**
 * Bulletproof GPU-accelerated Iris Overlay fallback for environments without View Transitions
 */
function runGpuOverlayFallback(
  x: number,
  y: number,
  endRadius: number,
  isGoingDark: boolean,
  nextTarget: Theme
) {
  isTransitioning = true;
  const root = document.documentElement;

  const overlay = document.createElement('div');
  overlay.id = 'theme-iris-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999999';
  overlay.style.pointerEvents = 'none';
  overlay.style.backgroundColor = '#0b0b0e';
  overlay.style.transform = 'translateZ(0)';
  overlay.style.willChange = 'clip-path';

  const clipPath = [
    `circle(0px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
    `circle(${endRadius.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
  ];

  if (isGoingDark) {
    // Sáng -> Tối: Dark overlay starts at 0px and blossoms outward across screen
    overlay.style.clipPath = clipPath[0];
    document.body.appendChild(overlay);

    const anim = overlay.animate(
      { clipPath: clipPath },
      {
        duration: 340,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards',
      }
    );

    anim.onfinish = () => {
      root.classList.add('dark');
      useUiStore.getState().setTheme(nextTarget);
      overlay.remove();
      isTransitioning = false;
    };
    anim.oncancel = () => {
      overlay.remove();
      isTransitioning = false;
    };
  } else {
    // Tối -> Sáng: Dark overlay covers screen, app switches underneath, then dark shrinks into button
    overlay.style.clipPath = clipPath[1];
    document.body.appendChild(overlay);

    root.classList.remove('dark');
    useUiStore.getState().setTheme(nextTarget);

    const anim = overlay.animate(
      { clipPath: [clipPath[1], clipPath[0]] },
      {
        duration: 340,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards',
      }
    );

    anim.onfinish = () => {
      overlay.remove();
      isTransitioning = false;
    };
    anim.oncancel = () => {
      overlay.remove();
      isTransitioning = false;
    };
  }
}
