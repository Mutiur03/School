import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Real client IP behind Cloudflare: CF-Connecting-IP is always the true client, unlike req.ip which depends on trust-proxy hop count. */
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return (req.headers['cf-connecting-ip'] as string) || req.ip || '';
});
