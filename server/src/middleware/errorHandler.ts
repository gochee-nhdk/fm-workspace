import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Enterprise Secure Error Handler
 * Strictly prevents stack trace leaks, database schema disclosure, and secret exposure
 */

export function secureErrorHandler(error: any, request: FastifyRequest, reply: FastifyReply) {
  // Internal logging for observability
  request.log.error(error);

  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
    ? error.statusCode
    : 500;

  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  let clientMessage = error.message || 'Lỗi xử lý yêu cầu';
  const errorName = error.name || 'Error';

  // Redact internal database details and sensitive file paths from error messages
  const isDbOrInternalError = 
    statusCode >= 500 ||
    /sqlite|libsql|syntax error|constraint|foreign key|table|column|path|connect ECONNREFUSED/i.test(clientMessage);

  if (isDbOrInternalError && (isProd || !isTest)) {
    clientMessage = statusCode >= 500
      ? 'Đã xảy ra lỗi nội bộ hệ thống. Vui lòng liên hệ quản trị viên.'
      : 'Yêu cầu không thể thực hiện do dữ liệu không hợp lệ.';
  }

  // Never ever return stack traces to clients
  reply.status(statusCode).send({
    success: false,
    error: isProd && statusCode >= 500 ? 'InternalServerError' : errorName,
    message: clientMessage,
  });
}
