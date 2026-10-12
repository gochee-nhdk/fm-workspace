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
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const render = () => {
      rafId = 0;
      const event = lastEvent;
      if (event && active) {
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        targetX = ((x - rect.width / 2) / (rect.width / 2)) * maxTilt;
        targetY = -((y - rect.height / 2) / (rect.height / 2)) * maxTilt;
        el.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
        el.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
      } else {
        targetX = 0;
        targetY = 0;
        lastEvent = null;
      }
      const response = Math.min(0.35, 16 / Math.max(speed, 1));
      currentX += (targetX - currentX) * response;
      currentY += (targetY - currentY) * response;
      const activeScale = active ? scale : 1;
      el.style.transform = `perspective(${perspective}px) rotateX(${currentY.toFixed(2)}deg) rotateY(${currentX.toFixed(2)}deg) scale3d(${activeScale}, ${activeScale}, ${activeScale})`;
      if (active || Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01) rafId = requestAnimationFrame(render);
    };
    const schedule = () => { if (!rafId) rafId = requestAnimationFrame(render); };
    const handleMouseMove = (event: MouseEvent) => { active = true; lastEvent = event; schedule(); };
    const handleMouseLeave = () => { active = false; lastEvent = null; schedule(); };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.style.willChange = 'transform';

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
