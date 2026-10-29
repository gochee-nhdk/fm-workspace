import { flushSync } from 'react-dom';
import { resolveTheme, useUiStore, Theme } from '@/stores/ui-store';

/** Guard against rapid spam-clicking while animation is in flight */
let isTransitioning = false;

/**
 * Executes a hardware-accelerated circular iris theme transition originating
 * directly from the clicked button coordinates.
 *
 * - Sáng -> Tối: Vùng tối nở to từ nút bấm lan ra toàn màn hình (circle(0px) -> circle(maxRadius)).
 * - Tối -> Sáng: Bóng tối thu nhỏ dần về lại nút bấm để lộ giao diện sáng (circle(maxRadius) -> circle(0px)).
 *
 * Uses native View Transitions API with synchronous DOM flush where supported,
 * and seamlessly falls back to a GPU-accelerated Iris Overlay on browsers without it.
 */
export const toggleThemeWithIris = (
  targetTheme?: 'light' | 'dark',
  event?: React.MouseEvent | MouseEvent
) => {
  if (isTransitioning) return;

  const { theme, setTheme } = useUiStore.getState();
  const currentResolved = resolveTheme(theme);
  const nextResolved = targetTheme || (currentResolved === 'dark' ? 'light' : 'dark');

  if (currentResolved === nextResolved) return;

  // If user explicitly prefers reduced motion, switch instantly with zero lag
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(nextResolved);
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

  // Calculate distance from (x, y) to the farthest corner of the viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const isGoingDark = nextResolved === 'dark';
  const doc = document as any;

  // Check if browser natively supports document.startViewTransition
  if (typeof doc.startViewTransition === 'function') {
    runViewTransition(doc, x, y, endRadius, isGoingDark, nextResolved);
  } else {
    runGpuOverlayFallback(x, y, endRadius, isGoingDark, nextResolved);
  }
};

/**
 * Implementation using modern View Transitions API with synchronous DOM flush
 */
function runViewTransition(
  doc: any,
  x: number,
  y: number,
  endRadius: number,
  isGoingDark: boolean,
  nextResolved: 'light' | 'dark'
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
      // Synchronously flush all React DOM mutations before capturing snapshot
      flushSync(() => {
        if (isGoingDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        useUiStore.getState().setTheme(nextResolved);
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
            clipPath: isGoingDark ? clipPath : [...clipPath].reverse(),
          },
          {
            duration: 420,
            easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
            pseudoElement: isGoingDark
              ? '::view-transition-new(root)'
              : '::view-transition-old(root)',
          }
        );

        animation.addEventListener('finish', cleanup);
        animation.addEventListener('cancel', cleanup);
      })
      .catch(() => {
        cleanup();
      });

    transition.finished.finally(cleanup);
  } catch (err) {
    cleanup();
    // Fallback if startViewTransition throws unexpectedly
    runGpuOverlayFallback(x, y, endRadius, isGoingDark, nextResolved);
  }
}

/**
 * Bulletproof GPU-accelerated Iris Overlay fallback for browsers without View Transitions
 */
function runGpuOverlayFallback(
  x: number,
  y: number,
  endRadius: number,
  isGoingDark: boolean,
  nextResolved: 'light' | 'dark'
) {
  isTransitioning = true;
  const root = document.documentElement;

  const overlay = document.createElement('div');
  overlay.id = 'theme-iris-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999999';
  overlay.style.pointerEvents = 'none';
  overlay.style.backgroundColor = '#0f0f13';
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
        duration: 400,
        easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
        fill: 'forwards',
      }
    );

    anim.onfinish = () => {
      root.classList.add('dark');
      useUiStore.getState().setTheme(nextResolved);
      overlay.remove();
      isTransitioning = false;
    };
    anim.oncancel = () => {
      overlay.remove();
      isTransitioning = false;
    };
  } else {
    // Tối -> Sáng: Dark overlay is shown, app switches underneath, then dark shrinks into button
    overlay.style.clipPath = clipPath[1];
    document.body.appendChild(overlay);

    root.classList.remove('dark');
    useUiStore.getState().setTheme(nextResolved);

    const anim = overlay.animate(
      { clipPath: [...clipPath].reverse() },
      {
        duration: 400,
        easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
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
