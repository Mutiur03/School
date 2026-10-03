import express from 'express';
import logger from '@/utils/logger.js';
import { ApiError } from '@/utils/ApiError.js';
import { buildClientErrorBody } from '@/utils/clientErrorBody.js';
import { captureServerException } from '@/config/sentry.js';
import { Prisma } from '@/generated/prisma/client.js';

const isRawDatabaseError = (error: any) =>
  error instanceof Prisma.PrismaClientKnownRequestError ||
  error instanceof Prisma.PrismaClientUnknownRequestError ||
  error instanceof Prisma.PrismaClientRustPanicError ||
  error instanceof Prisma.PrismaClientInitializationError ||
  error instanceof Prisma.PrismaClientValidationError;

/** Single error → response mapping, shared by legacy Express routes and the Nest filter. */
export const errorHandler = (
  error: any,
  req: express.Request,
  res: express.Response,
  _next?: express.NextFunction,
) => {
  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;
  const message = isRawDatabaseError(error)
    ? 'Internal server error'
    : error.message || 'Internal server error';

  const logMethod = statusCode >= 500 ? 'error' : 'warn';
  const logTitle = statusCode >= 500 ? 'Unhandled server error' : 'Client error response';

  if (statusCode >= 500) {
    captureServerException(error);
  }

  (logger as any)[logMethod](logTitle, {
    status: statusCode,
    message,
    stack: statusCode >= 500 ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip:
      (
        (Array.isArray(req.headers['x-forwarded-for'])
          ? req.headers['x-forwarded-for'][0]
          : req.headers['x-forwarded-for']) || ''
      )
        .split(',')[0]
        .trim() || req.socket?.remoteAddress,
  });

  // Never include Error.stack / absolute paths in the client body (any NODE_ENV).
  // Full stack remains in server logs / Sentry above for 500s.
  res.status(statusCode).json(buildClientErrorBody(message, isApiError ? error.errors || [] : []));
};
