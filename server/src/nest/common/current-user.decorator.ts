import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** `req.user` set by the auth guard (admin/teacher rows include `levels` for access checks). */
export type AuthUser = NonNullable<Request['user']> & { levels?: any[] };

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().user as AuthUser,
);
