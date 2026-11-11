import { RateLimitPluginOptions } from '@fastify/rate-limit';

/**
 * Enterprise Rate Limiting Policy
 * Protects against Brute-Force, Credential Stuffing, and Application DoS
 */

export const globalRateLimitOptions: RateLimitPluginOptions = {
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Hệ thống đã nhận quá nhiều yêu cầu trong thời gian ngắn. Vui lòng chậm lại.',
    retryAfter: Math.ceil(context.ttl / 1000),
  }),
};

export const authRateLimitConfig = {
  login: {
    max: 8,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại để bảo vệ an toàn tài khoản.',
    }),
  },
  register: {
    max: 6,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Số lần đăng ký tài khoản vượt quá giới hạn cho phép. Vui lòng thử lại sau 1 phút.',
    }),
  },
  refresh: {
    max: 30,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Phiên làm việc gửi yêu cầu làm mới quá nhanh. Vui lòng thử lại sau.',
    }),
  },
  sensitive: {
    max: 15,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Thao tác bảo mật nhạy cảm đã vượt quá tần suất cho phép.',
    }),
  },
};
