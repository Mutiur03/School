import { Catch, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import { ApiError } from '@/utils/ApiError.js';
import { errorHandler } from '@/middlewares/errorHandler.js';

const PRISMA_HTTP: Record<string, () => HttpException> = {
  P2002: () => new ConflictException('A record with this information already exists'),
  P2025: () => new NotFoundException('Record not found'),
};

/** ValidationPipe puts its messages in an array; join them so clients can toast `message`. */
const httpMessage = (error: HttpException) => {
  const { message } = error.getResponse() as { message?: string | string[] };
  return Array.isArray(message) ? message.join(', ') : error.message;
};

/** Every error (Nest routes, legacy next(err), unmatched paths) → the legacy envelope. */
@Catch()
export class LegacyErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse();

    // Map known Prisma errors to HTTP exceptions before the generic handler.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const factory = PRISMA_HTTP[error.code];
      if (factory) return this.catch(factory(), host);
    }

    // Nest's unmatched-path 404 reads "Cannot GET /x". A NotFoundException thrown by a handler keeps its own message.
    if (error instanceof NotFoundException && error.message.startsWith('Cannot ')) {
      res.status(404).json({ success: false, message: 'Route not found' });
      return;
    }
    const err =
      error instanceof HttpException ? new ApiError(error.getStatus(), httpMessage(error)) : error;
    errorHandler(err, http.getRequest(), res);
  }
}
