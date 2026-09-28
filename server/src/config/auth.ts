/**
 * Authentication & Security Configuration
 * Enforces secure JWT secrets in production and fails fast if missing.
 */

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isFallback = !secret || secret.trim() === '' || secret === 'fallback_secret_change_in_production';

  if (isFallback) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY FATAL: Biến môi trường JWT_SECRET chưa được thiết lập hoặc đang dùng chuỗi mặc định không an toàn trong môi trường Production. ' +
        'Vui lòng cấu hình JWT_SECRET ngẫu nhiên có độ dài tối thiểu 32 ký tự trong file .env hoặc cấu hình server.'
      );
    }
    // Safe dev key for offline development only
    return 'dev_secret_farmers_market_local_development_only_2026';
  }

  return secret;
}
