import logger from '../utils/logger.js';

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordConfirm',
  'confirmPassword',
  'newPassword',
  'oldPassword',
  'token',
  'secret',
  'authorization',
]);

const redact = (obj, depth = 0) => {
  if (depth > 5 || typeof obj !== 'object' || obj === null) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_FIELDS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1),
    ]),
  );
};

const getClientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.headers['x-real-ip'] ||
  req.socket?.remoteAddress ||
  'unknown';

export const detailedRequestLogger = (req, res, next) => {
  const startAt = process.hrtime.bigint();
  const originalEnd = res.end.bind(res);

  res.end = function (...args) {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1e6;
    const statusCode = res.statusCode;

    const logPayload = {
      type: 'request',
      method: req.method,
      url: req.originalUrl || req.url,
      status: statusCode,
      duration_ms: parseFloat(durationMs.toFixed(2)),
      ip: getClientIp(req),
      user_agent: req.headers['user-agent'] || 'unknown',
      content_length: res.getHeader('content-length') || null,
      ...(req.user ? { user: { id: req.user.id, role: req.user.role } } : {}),
      body:
        req.method !== 'GET' && req.body && Object.keys(req.body).length > 0
          ? redact(req.body)
          : undefined,
    };

    if (statusCode >= 500) {
      logger.error('Server error response', logPayload);
    } else if (statusCode >= 400) {
      logger.warn('Client error response', logPayload);
    } else {
      logger.http('Request completed', logPayload);
    }

    return originalEnd(...args);
  };

  next();
};
