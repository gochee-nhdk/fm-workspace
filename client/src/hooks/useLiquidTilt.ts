import { useRef, useEffect, useCallback } from 'react';

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (disabled || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const percentX = (mouseX / rect.width) * 100;
    const percentY = (mouseY / rect.height) * 100;

    // Normalised between -1 and 1
    const normX = (mouseX - rect.width / 2) / (rect.width / 2);
    const normY = (mouseY - rect.height / 2) / (rect.height / 2);

    const tiltX = -normY * maxTilt;
    const tiltY = normX * maxTilt;

    el.style.setProperty('--mouse-x', `${percentX.toFixed(1)}%`);
    el.style.setProperty('--mouse-y', `${percentY.toFixed(1)}%`);
    el.style.transform = `perspective(${perspective}px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`;
    el.style.transition = 'transform 80ms ease-out';
  }, [maxTilt, perspective, scale, disabled]);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    el.style.transition = `transform ${speed}ms cubic-bezier(0.16, 1, 0.3, 1)`;
  }, [perspective, speed]);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave, disabled]);

  return ref;
}
