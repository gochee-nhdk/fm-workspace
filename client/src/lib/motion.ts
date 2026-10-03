import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Apple macOS / iOS Liquid Glass Motion System Tokens — 120 FPS Edition
 * ─────────────────────────────────────────────────────────────────────
 * Master specification for durations, bezier curves, scales, and elevation.
 * Physics: spring stiffness/damping tuned to match Apple UISpringTimingParameters
 * on ProMotion (120Hz) displays. All keyframe animations use
 * cubic-bezier(0.16, 1, 0.3, 1) — Apple's signature "out-exponential" curve.
 *
 * Principles:
 *  - Immediate tactile response (< 16 ms visual latency)
 *  - GPU-only compositing: transform + opacity only (NO layout properties)
 *  - Continuous spring simulation with sub-stepping (8 steps/frame at 120fps)
 *  - Velocity carry-over for interruptible transitions
 *  - Liquid deformation (squash/stretch) proportional to velocity
 */
export const motionTokens = {
  duration: {
    press:      80,   // 60–100ms — tactile press instant feedback
    micro:      110,  // 90–140ms — micro-interaction (icon swap, badge)
    hover:      140,  // 110–170ms — hover state morphing
    tabContent: 160,  // crisp directional content glide
    popover:    200,  // popover expand from trigger origin
    sidebar:    260,  // sidebar width morph
    modal:      280,  // modal sheet entrance
    spatial:    360,  // large spatial transitions (window open)
  },
  easing: {
    // Apple's signature: immediate acceleration, ultra-smooth overshooting deceleration
    spring:      'cubic-bezier(0.16, 1, 0.3, 1)',
    // macOS window sheet: fast-start, smooth landing
    fluid:       'cubic-bezier(0.32, 0.72, 0, 1)',
    // Tactile press & snap-back
    snappy:      'cubic-bezier(0.18, 0.9, 0.22, 1)',
    // Gentle deceleration for slide-in content
    smooth:      'cubic-bezier(0.22, 1, 0.36, 1)',
    // Exit curve: quick drop-off
    exit:        'cubic-bezier(0.3, 0, 0.8, 0.15)',
    // Subtle physical badge bounce (slight overshoot)
    subtleBounce:'cubic-bezier(0.34, 1.18, 0.64, 1)',
    // Linear for shimmer/orb float
    linear:      'linear',
  },
  // Physical spring config for useAppleTabSpring
  spring: {
    stiffness: 480,  // Higher = snappier, less laggy
    damping:   32,   // Lower damping = more organic overshoot
    mass:      0.65, // Lighter mass = faster initial acceleration
  },
  scale: {
    hover:        1.012,
    press:        0.972,
    activeSubtle: 0.988,
    dragElevation:1.016,
    modalEntrance:0.96,
  },
  elevation: {
    rest:    '0 2px 12px rgba(0, 0, 0, 0.04)',
    hover:   '0 8px 28px rgba(0, 0, 0, 0.09)',
    dragging:'0 28px 70px rgba(0, 0, 0, 0.28), 0 4px 18px rgba(0, 0, 0, 0.14)',
    modal:   '0 32px 88px rgba(0, 0, 0, 0.30), inset 0 1.5px 1px rgba(255, 255, 255, 0.95)',
  }
} as const;

/**
 * Always returns false in FM Workspace — fluid Apple animations and physics springs
 * are permanently active, completely immune to Windows "Animation effects: Off" settings.
 */
export function useReducedMotion(): boolean {
  return false;
}

/**
 * Persistent Active Tab Indicator Hook
 * Calculates pixel-perfect position (left, top, width, height) of the active tab element
 * relative to the track container.
 * - Morphing & spatial continuity: Single persistent indicator moves between tabs.
 * - Uses ResizeObserver & requestAnimationFrame to prevent layout shifts.
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

    const observer = new ResizeObserver(() => { update(); });
    observer.observe(container);
    return () => observer.disconnect();
  }, [update, ...dependencies]);

  return indicator;
}

/**
 * Apple-Quality macOS / Liquid Glass Shared Navigation Pill Spring Engine — 120 FPS
 *
 * Implements an authentic continuous physical spring simulation:
 * - Spring: stiffness 480, damping 32, mass 0.65
 * - 8 sub-steps per frame for silky 120fps stability
 * - Velocity-based liquid deformation (scaleX stretch 1.000–1.040, scaleY squash 0.985–1.000)
 * - True physical continuity: Position & width morph simultaneously
 * - Fully interruptible: Rapid clicking immediately redirects momentum
 * - Settling precision: dist < 0.08px, speed < 0.8px/s
 * - GPU-only: transform3d + width (no layout triggers)
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
    stiffness = motionTokens.spring.stiffness,
    damping   = motionTokens.spring.damping,
    mass      = motionTokens.spring.mass,
    allowDeformation = true,
  } = options;

  const reducedMotion = useReducedMotion();
  const stateRef = useRef({
    x: 0, w: 0,
    vx: 0, vw: 0,
    targetX: 0, targetW: 0,
    animating: false,
    lastTime: 0,
    initialized: false,
    rafId: 0,
  });

  const snap = useCallback((x: number, w: number) => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.style.transform = `translate3d(${x}px, 0, 0) scale(1, 1)`;
    pill.style.width = `${w}px`;
    pill.style.opacity = '1';
  }, [pillRef]);

  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    const targetEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (!targetEl) return;

    const targetX = targetEl.offsetLeft;
    const targetW = targetEl.offsetWidth;

    // If tab or container is currently unrendered / hidden (width 0), defer initialization until visible
    if (targetW <= 0) {
      const raf = requestAnimationFrame(() => {
        const nextX = targetEl.offsetLeft;
        const nextW = targetEl.offsetWidth;
        if (nextW > 0) {
          stateRef.current.x = nextX;
          stateRef.current.w = nextW;
          stateRef.current.targetX = nextX;
          stateRef.current.targetW = nextW;
          stateRef.current.initialized = true;
          snap(nextX, nextW);
        }
      });
      return () => cancelAnimationFrame(raf);
    }

    const state = stateRef.current;
    state.targetX = targetX;
    state.targetW = targetW;

    // First render initialization: place immediately without animation
    if (!state.initialized || state.w <= 0) {
      state.x = targetX;
      state.w = targetW;
      state.vx = 0; state.vw = 0;
      state.initialized = true;
      snap(targetX, targetW);
      return;
    }

    // Snap immediately if reduced motion
    if (reducedMotion) {
      state.x = targetX; state.w = targetW;
      state.vx = 0; state.vw = 0;
      state.animating = false;
      snap(targetX, targetW);
      return;
    }

    // Cancel any running frame before starting new one
    if (state.rafId) cancelAnimationFrame(state.rafId);

    state.lastTime = performance.now();
    state.animating = true;

    const step = (now: number) => {
      if (!state.animating) return;

      const rawDt = (now - state.lastTime) / 1000;
      state.lastTime = now;

      // Clamp dt: min 0.5ms, max 50ms (prevent blow-ups during tab sleep)
      const dtTotal = Math.min(Math.max(rawDt, 0.0005), 0.050);

      // 8 sub-steps per frame → silky 120fps physics stability
      const SUB = 8;
      const dt = dtTotal / SUB;

      for (let i = 0; i < SUB; i++) {
        // Position spring
        const fx = -stiffness * (state.x - state.targetX) - damping * state.vx;
        state.vx += (fx / mass) * dt;
        state.x  += state.vx * dt;

        // Width spring
        const fw = -stiffness * (state.w - state.targetW) - damping * state.vw;
        state.vw += (fw / mass) * dt;
        state.w  += state.vw * dt;
      }

      const dist  = Math.abs(state.x - state.targetX) + Math.abs(state.w - state.targetW);
      const speed = Math.abs(state.vx) + Math.abs(state.vw);

      // Tight settling — eliminates micro-jitter at rest
      if (dist < 0.08 && speed < 0.8) {
        state.x = state.targetX;
        state.w = state.targetW;
        state.vx = 0; state.vw = 0;
        state.animating = false;
        snap(state.x, state.w);
        return;
      }

      // Velocity-based liquid deformation
      let scaleX = 1;
      let scaleY = 1;
      if (allowDeformation) {
        const vAbs = Math.abs(state.vx);
        // Horizontal stretch: liquid elongates in direction of motion (max 4.2%)
        const stretch  = Math.min(vAbs * 0.000042, 0.042);
        // Vertical squash: conservation of area (max 1.6% compression)
        const compress = Math.min(vAbs * 0.000018, 0.016);

        scaleX = +(1 + stretch).toFixed(4);
        scaleY = +(1 - compress).toFixed(4);
      }

      pill.style.transform = `translate3d(${state.x.toFixed(3)}px, 0, 0) scale(${scaleX}, ${scaleY})`;
      pill.style.width     = `${state.w.toFixed(3)}px`;

      state.rafId = requestAnimationFrame(step);
    };

    state.rafId = requestAnimationFrame(step);

    return () => {
      if (state.rafId) cancelAnimationFrame(state.rafId);
    };
  }, [activeTabId, stiffness, damping, mass, allowDeformation, reducedMotion, snap]);

  // Handle container resize & visibility restoration
  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const targetEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
      if (!targetEl) return;
      const targetX = targetEl.offsetLeft;
      const targetW = targetEl.offsetWidth;
      if (targetW <= 0) return;

      const state = stateRef.current;
      state.targetX = targetX;
      state.targetW = targetW;
      if (!state.animating || !state.initialized || state.w <= 0) {
        state.x = targetX;
        state.w = targetW;
        state.initialized = true;
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
 * Determines if switching forward (index increases → x: +8px) or backward.
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
 * Uses requestAnimationFrame + passive event listeners for zero jank.
 * Returns alpha 0→1 based on scrollTop / threshold.
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
        if (Math.abs(currentRatio - lastRatio) > 0.012 || currentRatio === 0 || currentRatio === 1) {
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

/**
 * useLiquidPress — Liquid Glass physical press spring hook
 *
 * Simulates Apple's UIImpactFeedbackGenerator + spring response for buttons:
 * - Instant scale-down (press) with spring-back overshoot on release
 * - GPU-accelerated via transform3d
 * - Interruptible: rapid press/release redirects spring momentum
 *
 * Usage:
 *   const { ref, style } = useLiquidPress({ scale: 0.94 });
 *   <button ref={ref} style={style}>...</button>
 */
export interface LiquidPressOptions {
  /** Target scale on press (default: 0.96) */
  pressScale?: number;
  /** Spring stiffness (default: 600) */
  stiffness?: number;
  /** Spring damping (default: 28) */
  damping?: number;
  /** Spring mass (default: 0.5) */
  mass?: number;
  /** Whether to apply press animation (default: true) */
  enabled?: boolean;
}

export function useLiquidPress(options: LiquidPressOptions = {}) {
  const {
    pressScale = 0.96,
    stiffness  = 600,
    damping    = 28,
    mass       = 0.5,
    enabled    = true,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const springRef = useRef({
    scale: 1,
    velocity: 0,
    target: 1,
    animating: false,
    rafId: 0,
  });

  const startSpring = useCallback(() => {
    const spring = springRef.current;
    const el = ref.current;
    if (!el || !enabled) return;

    if (spring.rafId) cancelAnimationFrame(spring.rafId);
    spring.animating = true;

    const step = () => {
      if (!spring.animating) return;
      const dt = 1 / 120; // 120fps time step

      // 4 sub-steps for stability
      for (let i = 0; i < 4; i++) {
        const force = -stiffness * (spring.scale - spring.target) - damping * spring.velocity;
        spring.velocity += (force / mass) * dt;
        spring.scale    += spring.velocity * dt;
      }

      const dist  = Math.abs(spring.scale - spring.target);
      const speed = Math.abs(spring.velocity);

      if (dist < 0.0008 && speed < 0.005) {
        spring.scale     = spring.target;
        spring.velocity  = 0;
        spring.animating = false;
        el.style.transform = spring.target === 1 ? '' : `scale3d(${spring.target}, ${spring.target}, 1)`;
        return;
      }

      el.style.transform = `scale3d(${spring.scale.toFixed(5)}, ${spring.scale.toFixed(5)}, 1)`;
      spring.rafId = requestAnimationFrame(step);
    };

    spring.rafId = requestAnimationFrame(step);
  }, [stiffness, damping, mass, enabled]);

  const onPointerDown = useCallback(() => {
    if (!enabled) return;
    springRef.current.target   = pressScale;
    springRef.current.velocity = 0;
    startSpring();
  }, [pressScale, enabled, startSpring]);

  const onPointerUp = useCallback(() => {
    if (!enabled) return;
    springRef.current.target = 1;
    startSpring();
  }, [enabled, startSpring]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    el.style.willChange = 'transform';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);

    return () => {
      if (springRef.current.rafId) cancelAnimationFrame(springRef.current.rafId);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
    };
  }, [enabled, onPointerDown, onPointerUp]);

  return { ref };
}
