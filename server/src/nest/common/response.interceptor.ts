import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import type { NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';

/** Wraps every success response as `{ success: true, data }`. Errors are handled by the filter. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
