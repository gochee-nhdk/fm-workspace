import { useState, useEffect } from 'react';

export interface AnimatedPresenceState {
  shouldRender: boolean;
  isExiting: boolean;
}

/**
 * useAnimatedPresence - Apple Fluid Motion Lifecycle Hook
 * Keeps components rendered in the DOM for a specified duration while `isExiting === true`
 * so closing/exit animations can complete smoothly before unmounting.
 */
export function useAnimatedPresence(isOpen: boolean, durationMs = 180): AnimatedPresenceState {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, durationMs, shouldRender]);

  return { shouldRender, isExiting };
}
