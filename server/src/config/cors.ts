/**
 * CORS Configuration & Origin Whitelist Resolver
 * 
 * Standard environment variables:
 * - CLIENT_URL: Primary frontend origin (e.g. https://farmers-market-procurement.vercel.app)
 * - ALLOWED_ORIGINS: Comma-separated list of additional allowed origins
 * - CORS_ORIGIN: Backward-compatible alias for CLIENT_URL
 */

export interface CorsOptionsConfig {
  clientUrl?: string;
  allowedOrigins?: string;
  corsOrigin?: string;
  nodeEnv?: string;
  isDesktop?: boolean;
}

/**
 * Resolves the list of trusted origins from environment variables.
 * Automatically trims whitespace and trailing slashes.
 */
export function getAllowedOrigins(config?: CorsOptionsConfig): string[] {
  const nodeEnv = config?.nodeEnv ?? process.env.NODE_ENV;
  const isProd = nodeEnv === 'production';
  const isDesktop = config?.isDesktop ?? (
    process.env.ELECTRON_RUN === 'true' || process.env.LOCAL_DEV === 'true'
  );

  const clientUrl = config?.clientUrl !== undefined ? config.clientUrl : process.env.CLIENT_URL;
  const corsOrigin = config?.corsOrigin !== undefined ? config.corsOrigin : process.env.CORS_ORIGIN;
  const rawAllowedOrigins = config?.allowedOrigins !== undefined ? config.allowedOrigins : process.env.ALLOWED_ORIGINS;

  const rawOrigins: (string | undefined)[] = [
    clientUrl,
    corsOrigin,
    ...(rawAllowedOrigins ? rawAllowedOrigins.split(',') : []),
  ];

  const envOrigins = rawOrigins
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().replace(/\/+$/, ''));

  // In local development or desktop mode, permit loopback dev servers
  const localDevOrigins = (!isProd || isDesktop)
    ? [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]
    : [];

  return Array.from(new Set([...localDevOrigins, ...envOrigins]));
}

/**
 * Verifies whether a given Origin is allowed.
 * Requests without an Origin header (e.g. health checks, server-to-server, curl) are permitted.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  const normalized = origin.trim().replace(/\/+$/, '');
  return allowedOrigins.includes(normalized);
}
