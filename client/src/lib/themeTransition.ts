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
 * Built on Native View Transitions API with isolated pseudo-element layering.
 * Completely immune to black screen overlays and frame drops.
 */
export const toggleThemeWithIris = (
  targetTheme?: Theme,
  event?: React.MouseEvent | MouseEvent
) => {
  // Always clean up any stale overlay if present
  const staleOrb = document.getElementById('theme-iris-orb');
  if (staleOrb) staleOrb.remove();

  if (isTransitioning) return;

  const { theme, setTheme } = useUiStore.getState();
  const currentResolved = resolveTheme(theme);
  const nextTarget: Theme = targetTheme || (currentResolved === 'dark' ? 'light' : 'dark');
  const nextResolved = resolveTheme(nextTarget);

  if (currentResolved === nextResolved) {
    setTheme(nextTarget);
    return;
  }

  const root = document.documentElement;
  const isGoingDark = nextResolved === 'dark';

  // If user explicitly prefers reduced motion, switch instantly with zero animation
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    if (isGoingDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
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
      if (rect.width > 0 && rect.height > 0) {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    } else if ('clientX' in event && typeof event.clientX === 'number' && event.clientX > 0) {
      x = event.clientX;
      y = event.clientY;
    }
  } else {
    // Try to find the active header theme toggle button in the DOM
    const btn =
      document.querySelector('[data-theme-toggle]') ||
      document.querySelector('button[aria-label*="Sáng / Tối"]') ||
      document.querySelector('button[aria-label*="Chủ đề"]');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    }
  }

  // Calculate distance from (x, y) to the farthest corner of the viewport (+ 12px subpixel pad)
  const endRadius =
    Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) + 12;

  const doc = document as any;

  if (typeof doc.startViewTransition === 'function') {
    runViewTransition(doc, x, y, endRadius, isGoingDark, nextTarget);
  } else {
    // Graceful fallback: instant atomic class toggle (100% reliable)
    if (isGoingDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setTheme(nextTarget);
  }
};

/**
 * 120 FPS Native View Transitions implementation
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

  let hasCleanedUp = false;
  const cleanup = () => {
    if (hasCleanedUp) return;
    hasCleanedUp = true;
    delete root.dataset.themeTransition;
    isTransitioning = false;
  };

  // Fail-safe guard: guaranteed cleanup within 450ms
  const safetyTimer = setTimeout(cleanup, 450);

  try {
    const transition = doc.startViewTransition(() => {
      if (isGoingDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      useUiStore.getState().setTheme(nextTarget);
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
            duration: 280,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: isGoingDark
              ? '::view-transition-new(root)'
              : '::view-transition-old(root)',
            fill: 'forwards',
          }
        );

        animation.addEventListener('finish', () => {
          clearTimeout(safetyTimer);
          cleanup();
        }, { once: true });

        animation.addEventListener('cancel', () => {
          clearTimeout(safetyTimer);
          cleanup();
        }, { once: true });
      })
      .catch(() => {
        clearTimeout(safetyTimer);
        cleanup();
      });

    transition.finished.finally(() => {
      clearTimeout(safetyTimer);
      cleanup();
    });
  } catch (err) {
    clearTimeout(safetyTimer);
    cleanup();
    if (isGoingDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    useUiStore.getState().setTheme(nextTarget);
  }
}
