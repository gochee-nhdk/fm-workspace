import { useRef, useEffect } from 'react';

export interface LiquidTiltOptions {
  maxTilt?: number; // max tilt degrees (default: 3)
  perspective?: number; // perspective in px (default: 1000)
  scale?: number; // scale on hover (default: 1.01)
  speed?: number; // transition speed in ms (default: 300)
  disabled?: boolean;
}

export function useLiquidTilt<T extends HTMLElement = HTMLDivElement>(options: LiquidTiltOptions = {}) {
  const ref = useRef<T>(null);
  const {
    maxTilt = 2.5,
    perspective = 1000,
    scale = 1.01,
    speed = 300,
    disabled = false
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    let rafId = 0;
    let active = false;
    let lastEvent: MouseEvent | null = null;
    let lastTime = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const render = (now: number) => {
      rafId = 0;
      const dt = lastTime ? Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.05) : 1 / 120;
      lastTime = now;

      const event = lastEvent;
      if (event && active) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          targetX = ((x - rect.width / 2) / (rect.width / 2)) * maxTilt;
          targetY = -((y - rect.height / 2) / (rect.height / 2)) * maxTilt;
          el.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
          el.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
        }
      } else {
        targetX = 0;
        targetY = 0;
        lastEvent = null;
      }

      // Frame-rate independent exponential smoothing (consistent across 60Hz/120Hz/240Hz)
      const tauMs = Math.max(speed * 0.25, 16);
      const alpha = 1 - Math.exp((-dt * 1000) / tauMs);
      currentX += (targetX - currentX) * alpha;
      currentY += (targetY - currentY) * alpha;

      const isSettledAtRest = !active && Math.abs(currentX) <= 0.01 && Math.abs(currentY) <= 0.01;
      if (isSettledAtRest) {
        currentX = 0;
        currentY = 0;
        lastTime = 0;
        el.style.transform = '';
        el.style.willChange = 'auto';
        return;
      }

      el.style.willChange = 'transform';
      const activeScale = active ? scale : 1;
      el.style.transform = `perspective(${perspective}px) rotateX(${currentY.toFixed(2)}deg) rotateY(${currentX.toFixed(2)}deg) scale3d(${activeScale}, ${activeScale}, ${activeScale})`;
      rafId = requestAnimationFrame(render);
    };
    const schedule = () => { if (!rafId) rafId = requestAnimationFrame(render); };
    const handleMouseMove = (event: MouseEvent) => { active = true; lastEvent = event; schedule(); };
    const handleMouseLeave = () => { active = false; lastEvent = null; schedule(); };

    el.addEventListener('mousemove', handleMouseMove, { passive: true });
    el.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.style.willChange = 'auto';
      el.style.transform = '';
    };
  }, [maxTilt, perspective, scale, speed, disabled]);

  return ref;
}
