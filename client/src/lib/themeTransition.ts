import { resolveTheme, useUiStore, Theme } from '@/stores/ui-store';

/** Guard against rapid spam-clicking while animation is in flight */
let isTransitioning = false;

/**
 * Executes a true 120 FPS hardware-accelerated circular iris theme transition
 * originating directly from the clicked button coordinates.
 *
 * - Sáng -> Tối: Vùng tối (#0f0f13) nở to từ nút bấm lan ra toàn màn hình (scale(0) -> scale(1)).
 * - Tối -> Sáng: Bóng tối (#0f0f13) thu nhỏ dần về lại nút bấm để lộ giao diện sáng (scale(1) -> scale(0)).
 *
 * 100% GPU Compositor Thread execution via transform: scale() with ZERO clip-path re-rasterization
 * and ZERO View Transitions stutter on Windows / Edge / Chrome.
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

  const root = document.documentElement;
  const isGoingDark = nextResolved === 'dark';

  // Check user prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
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

  // Calculate distance from (x, y) to the farthest corner of the viewport (+ 24px safety pad)
  const endRadius =
    Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) + 24;

  const diameter = Math.ceil(endRadius * 2);

  isTransitioning = true;
  root.dataset.themeTransition = isGoingDark ? 'to-dark' : 'to-light';

  // Clean up any lingering previous orb
  const oldOrb = document.getElementById('theme-iris-orb');
  if (oldOrb) oldOrb.remove();

  const orb = document.createElement('div');
  orb.id = 'theme-iris-orb';
  orb.style.position = 'fixed';
  orb.style.left = `${Math.round(x - endRadius)}px`;
  orb.style.top = `${Math.round(y - endRadius)}px`;
  orb.style.width = `${diameter}px`;
  orb.style.height = `${diameter}px`;
  orb.style.borderRadius = '50%';
  orb.style.backgroundColor = '#0f0f13';
  orb.style.pointerEvents = 'none';
  orb.style.zIndex = '99999999';
  orb.style.willChange = 'transform';
  orb.style.transformOrigin = '50% 50%';

  let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

  const finishTransition = () => {
    if (safetyTimeout) clearTimeout(safetyTimeout);
    orb.remove();
    delete root.dataset.themeTransition;
    isTransitioning = false;
  };

  // Fail-safe timeout to prevent state lock under any circumstances
  safetyTimeout = setTimeout(finishTransition, 500);

  if (isGoingDark) {
    // Sáng -> Tối: Orb starts at scale(0) and blossoms outward across the screen
    orb.style.transform = 'scale(0)';
    document.body.appendChild(orb);

    const anim = orb.animate(
      [
        { transform: 'scale(0)' },
        { transform: 'scale(1)' }
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      }
    );

    const onComplete = () => {
      root.classList.add('dark');
      useUiStore.getState().setTheme(nextTarget);

      // Double rAF ensures the dark DOM paint has committed behind the orb
      requestAnimationFrame(() => {
        requestAnimationFrame(finishTransition);
      });
    };

    anim.addEventListener('finish', onComplete, { once: true });
    anim.addEventListener('cancel', finishTransition, { once: true });
  } else {
    // Tối -> Sáng: Orb starts at scale(1) covering the screen.
    // DOM switches immediately underneath, then orb collapses back into button.
    orb.style.transform = 'scale(1)';
    document.body.appendChild(orb);

    // Switch DOM immediately underneath the opaque dark orb
    root.classList.remove('dark');
    useUiStore.getState().setTheme(nextTarget);

    // Give 1 frame for the light DOM paint to register underneath the dark orb
    requestAnimationFrame(() => {
      const anim = orb.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0)' }
        ],
        {
          duration: 300,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          fill: 'forwards'
        }
      );

      anim.addEventListener('finish', finishTransition, { once: true });
      anim.addEventListener('cancel', finishTransition, { once: true });
    });
  }
};
