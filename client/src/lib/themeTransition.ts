import { resolveTheme, useUiStore } from '@/stores/ui-store';

/**
 * Executes an Apple Iris Circular Transition from the origin of the event / button.
 * - When transitioning to Dark: the dark theme circle blossoms outwards from the clicked button.
 * - When transitioning to Light: the darkness contracts back into the button, revealing the light theme.
 */
export const toggleThemeWithIris = (
  targetTheme?: 'light' | 'dark',
  event?: React.MouseEvent | MouseEvent
) => {
  const { theme, setTheme } = useUiStore.getState();
  const currentResolved = resolveTheme(theme);
  const nextResolved = targetTheme || (currentResolved === 'dark' ? 'light' : 'dark');

  if (currentResolved === nextResolved) return;

  const doc = document as any;

  // Fallback if View Transitions API is not supported or user prefers reduced motion
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(nextResolved);
    return;
  }

  // Calculate center of clicked button or fallback to top-right
  let x = window.innerWidth - 60;
  let y = 30;

  if (event) {
    const currentTarget = (event.currentTarget || event.target) as HTMLElement | null;
    if (currentTarget && typeof currentTarget.getBoundingClientRect === 'function') {
      const rect = currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else if ('clientX' in event && typeof event.clientX === 'number') {
      x = event.clientX;
      y = event.clientY;
    }
  }

  // Calculate distance from (x, y) to the farthest viewport corner
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const isGoingDark = nextResolved === 'dark';

  const transition = doc.startViewTransition(() => {
    // Immediately set dark class on html so snapshot matches target state
    const root = document.documentElement;
    if (isGoingDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setTheme(nextResolved);
  });

  transition.ready.then(() => {
    const clipPath = [
      `circle(0px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
      `circle(${endRadius.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
    ];

    if (isGoingDark) {
      // Light -> Dark: The new dark mode circle expands outwards from the button
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    } else {
      // Dark -> Light: The old dark mode circle shrinks back into the button
      document.documentElement.animate(
        {
          clipPath: [...clipPath].reverse(),
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
          pseudoElement: '::view-transition-old(root)',
        }
      );
    }
  });
};
