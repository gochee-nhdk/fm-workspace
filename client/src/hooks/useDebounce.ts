import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Delays updating the returned value until the input value has stopped changing
 * for the specified delay period. Useful for search inputs to avoid over-fetching.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns a stable debounced function reference.
 * Useful for debouncing callbacks (e.g., search onChange handlers).
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always keep fnRef current without triggering re-renders
  useEffect(() => {
    fnRef.current = fn;
  });

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
}
