import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Apple macOS / iOS Liquid Glass Motion System Tokens
 * Master specification for durations, bezier curves, scales, and elevation.
 * Matches Apple HIG and macOS 27 spatial interaction principles:
 * - Immediate response
 * - Spatial continuity
 * - Fluid morphing & layout springs
 * - Interruptible transitions
 * - Subtle physicality
 */
export const motionTokens = {
  duration: {
    press: 90,        // 70–140ms
    micro: 130,       // 100–160ms
    hover: 160,       // 120–180ms
    tabContent: 180,  // Fast, crisp tab content settle
    popover: 210,     // 180–260ms
    sidebar: 280,     // 220–320ms
    modal: 300,       // 260–400ms
    spatial: 380,     // 350–500ms
  },
  easing: {
    // Apple's signature fluid spring: immediate reaction, ultra-smooth settling, zero cartoon bounce
    // Corresponds to spring stiffness: 450, damping: 35, mass: 0.7
    spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
    // macOS window / sheet fluid motion
    fluid: 'cubic-bezier(0.32, 0.72, 0, 1)',
    // Tactile press & snap back
    snappy: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
    // Controlled deceleration for exits
    smooth: 'cubic-bezier(0.25, 1, 0.5, 1)',
    // Exit drop-off curve for modals/popovers
    exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    // Subtle physical badge bounce
    subtleBounce: 'cubic-bezier(0.34, 1.25, 0.64, 1)',
  },
  spring: {
    stiffness: 450,
    damping: 35,
    mass: 0.7,
  },
  scale: {
    hover: 1.015,
    press: 0.975,
    activeSubtle: 0.985,
    dragElevation: 1.018,
    modalEntrance: 0.96,
  },
  elevation: {
    rest: '0 4px 20px rgba(0, 0, 0, 0.04)',
    hover: '0 8px 24px rgba(0, 0, 0, 0.08)',
    dragging: '0 24px 60px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.12)',
    modal: '0 28px 80px rgba(0, 0, 0, 0.28), inset 0 1.5px 1px rgba(255, 255, 255, 0.95)',
  }
} as const;

/**
 * React hook to detect if the user has requested reduced motion in their OS
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/**
 * Persistent Active Tab Indicator Hook
 * Calculates pixel-perfect position (left, top, width, height) of the active tab element
 * relative to the track container.
 * - Morphing & spatial continuity: Single persistent indicator moves between tabs.
 * - Uses ResizeObserver & requestAnimationFrame to prevent layout shifts.
 * - Handles horizontal & vertical navigation layouts.
 */
export interface TabIndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
  ready: boolean;
}

export function useTabIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeTabId: string,
  dependencies: any[] = []
): TabIndicatorRect {
  const [indicator, setIndicator] = useState<TabIndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (!activeEl) return;

    requestAnimationFrame(() => {
      setIndicator({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        ready: true,
      });
    });
  }, [containerRef, activeTabId]);

  useEffect(() => {
    update();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      update();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [update, ...dependencies]);

  return indicator;
}

/**
 * Apple-Quality macOS / Liquid Glass Shared Navigation Pill Spring Engine
 *
 * Implements an authentic continuous physical spring simulation:
 * - Spring configuration: stiffness 460, damping 34, mass 0.7
 * - Velocity-based micro-deformation (scaleX subtle stretch 1.015-1.025, scaleY compression 0.990-0.995)
 * - True physical continuity: Position & width morph simultaneously
 * - Fully interruptible: Rapid clicking immediately redirects momentum toward the new destination
 * - Zero animation queuing, zero visual snapping
 * - 60 FPS direct GPU-accelerated transforms
 * - Automatic bypass on prefers-reduced-motion
 */
export interface AppleTabSpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
  allowDeformation?: boolean;
}

export function useAppleTabSpring(
  containerRef: React.RefObject<HTMLElement | null>,
  pillRef: React.RefObject<HTMLElement | null>,
  activeTabId: string,
  options: AppleTabSpringOptions = {}
) {
  const {
    stiffness = 460,
    damping = 34,
    mass = 0.7,
    allowDeformation = true,
  } = options;

  const reducedMotion = useReducedMotion();
  const stateRef = useRef({
    x: 0,
    w: 0,
    vx: 0,
    vw: 0,
    targetX: 0,
    targetW: 0,
    animating: false,
    lastTime: 0,
    initialized: false,
  });

  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    const targetEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (!targetEl) return;

    const targetX = targetEl.offsetLeft;
    const targetW = targetEl.offsetWidth;

    const state = stateRef.current;
    state.targetX = targetX;
    state.targetW = targetW;

    // First render initialization: place immediately without animation
    if (!state.initialized) {
      state.x = targetX;
      state.w = targetW;
      state.vx = 0;
      state.vw = 0;
      state.initialized = true;

      pill.style.transform = `translate3d(${targetX}px, 0, 0) scale(1, 1)`;
      pill.style.width = `${targetW}px`;
      pill.style.opacity = '1';
      return;
    }

    // If reduced motion is requested by OS, snap immediately
    if (reducedMotion) {
      state.x = targetX;
      state.w = targetW;
      state.vx = 0;
      state.vw = 0;
      state.animating = false;

      pill.style.transform = `translate3d(${targetX}px, 0, 0) scale(1, 1)`;
      pill.style.width = `${targetW}px`;
      pill.style.opacity = '1';
      return;
    }

    // Start or continue spring simulation
    state.lastTime = performance.now();
    if (!state.animating) {
      state.animating = true;

      const step = (now: number) => {
        if (!state.animating) return;

        const rawDt = (now - state.lastTime) / 1000;
        state.lastTime = now;
        // Clamp frame time to prevent blow-ups during lag or backgrounding
        const dtTotal = Math.min(Math.max(rawDt, 0.001), 0.064);

        // Sub-stepping for ultra-stable, smooth physics (4 sub-steps per frame)
        const subSteps = 4;
        const dt = dtTotal / subSteps;

        for (let i = 0; i < subSteps; i++) {
          // Spring force for X position
          const fx = -stiffness * (state.x - state.targetX) - damping * state.vx;
          const ax = fx / mass;
          state.vx += ax * dt;
          state.x += state.vx * dt;

          // Spring force for Width morphing
          const fw = -stiffness * (state.w - state.targetW) - damping * state.vw;
          const aw = fw / mass;
          state.vw += aw * dt;
          state.w += state.vw * dt;
        }

        const dist = Math.abs(state.x - state.targetX) + Math.abs(state.w - state.targetW);
        const speed = Math.abs(state.vx) + Math.abs(state.vw);

        // Precise settling condition
        if (dist < 0.15 && speed < 1.2) {
          state.x = state.targetX;
          state.w = state.targetW;
          state.vx = 0;
          state.vw = 0;
          state.animating = false;

          pill.style.transform = `translate3d(${state.x}px, 0, 0) scale(1, 1)`;
          pill.style.width = `${state.w}px`;
          return;
        }

        // Velocity-based physical deformation — chất lỏng nẩy nhẹ uyển chuyển
        let scaleX = 1;
        let scaleY = 1;
        if (allowDeformation) {
          const vxAbs = Math.abs(state.vx);
          // Horizontal stretch: giãn nhẹ tự nhiên khi di chuyển nhanh (1.000 to 1.036)
          const stretch = Math.min(vxAbs * 0.000045, 0.036);
          // Vertical compression: nén nhẹ (1.000 to 0.985)
          const compress = Math.min(vxAbs * 0.000020, 0.015);

          scaleX = +(1 + stretch).toFixed(4);
          scaleY = +(1 - compress).toFixed(4);
        }

        pill.style.transform = `translate3d(${state.x.toFixed(2)}px, 0, 0) scale(${scaleX}, ${scaleY})`;
        pill.style.width = `${state.w.toFixed(2)}px`;

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }
  }, [activeTabId, stiffness, damping, mass, allowDeformation, reducedMotion]);

  // Handle window/container resizing
  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const targetEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
      if (!targetEl) return;
      const targetX = targetEl.offsetLeft;
      const targetW = targetEl.offsetWidth;
      const state = stateRef.current;
      state.targetX = targetX;
      state.targetW = targetW;
      if (!state.animating) {
        state.x = targetX;
        state.w = targetW;
        pill.style.transform = `translate3d(${targetX}px, 0, 0) scale(1, 1)`;
        pill.style.width = `${targetW}px`;
        pill.style.opacity = '1';
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [activeTabId]);
}

/**
 * Directional Tab Switch Hook
 * Determines if switching forward (index increases -> x: +8px) or backward (index decreases -> x: -8px).
 * Returns 'forward' | 'backward' | 'initial'
 */
export function useDirectionalTab<T extends string>(
  currentTab: T,
  tabOrder: readonly T[]
): {
  direction: 'forward' | 'backward';
  animationClass: string;
} {
  const prevTabRef = useRef<T>(currentTab);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    const prevIndex = tabOrder.indexOf(prevTabRef.current);
    const currIndex = tabOrder.indexOf(currentTab);

    if (prevIndex !== -1 && currIndex !== -1 && prevIndex !== currIndex) {
      setDirection(currIndex > prevIndex ? 'forward' : 'backward');
    }
    prevTabRef.current = currentTab;
  }, [currentTab, tabOrder]);

  return {
    direction,
    animationClass: direction === 'forward' ? 'apple-tab-content-enter' : 'apple-tab-content-enter-rev',
  };
}

/**
 * Optimized continuous scroll interpolation hook.
 * Avoids binary threshold switching; continuously computes alpha (0 to 1)
 * based on scroll offset using requestAnimationFrame.
 */
export function useScrollInterpolation(
  scrollContainerRef: React.RefObject<HTMLElement | null>,
  threshold = 60
): number {
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let lastRatio = 0;

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const top = el.scrollTop;
        const currentRatio = Math.min(1, Math.max(0, top / threshold));
        if (Math.abs(currentRatio - lastRatio) > 0.015 || currentRatio === 0 || currentRatio === 1) {
          lastRatio = currentRatio;
          setRatio(currentRatio);
        }
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollContainerRef, threshold]);

  return ratio;
}
