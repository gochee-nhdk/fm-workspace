import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind CSS class names, resolving conflicts correctly */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Vietnamese Dong currency (or specified currency) */
export function formatCurrency(amount: number, currency: string = 'VND') {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
}

/** Extract initials from a full name (up to 2 characters) */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Format bytes into a human-readable string.
 * @example formatBytes(1536) → "1.5 KB"
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
  return `${value} ${sizes[i]}`;
}

/**
 * Clamp a number between min and max.
 * @example clamp(150, 0, 100) → 100
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Create a debounced version of any function.
 * @example const debouncedSearch = debounce(search, 300)
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate a string with ellipsis if it exceeds maxLength.
 * @example truncate("Hello World", 5) → "Hello..."
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '...';
}

/**
 * Sanitize external URLs to prevent javascript:, vbscript:, data:, file:, blob:, or malicious protocol execution.
 * Only allows http:, https:, mailto:, and tel: protocols.
 * Defends against whitespace evasion, control character insertion, HTML entity encoding, and malformed schemes.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';

  // Strip invisible ASCII control characters, null bytes, backspaces, and zero-width spaces
  const clean = url
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!clean) return '';

  // Decode common URL encoded entities in the scheme portion to prevent bypasses like java%0ascript: or &#x6a;avascript:
  const normalized = clean.replace(/&#[xX]?([0-9a-fA-F]+);?/g, (_, hexOrDec) => {
    try {
      const code = hexOrDec.startsWith('x') || hexOrDec.startsWith('X')
        ? parseInt(hexOrDec.slice(1), 16)
        : parseInt(hexOrDec, 10);
      return String.fromCharCode(code);
    } catch {
      return '';
    }
  });

  const lower = normalized.toLowerCase().replace(/\s+/g, '');

  // Explicitly block dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:')
  ) {
    return '';
  }

  // Safe explicitly allowed protocols
  if (/^https?:\/\//i.test(clean) || /^mailto:/i.test(clean) || /^tel:/i.test(clean)) {
    return clean;
  }

  // If protocol-relative url starts with //, ensure https:
  if (clean.startsWith('//')) {
    return `https:${clean}`;
  }

  return `https://${clean}`;
}
