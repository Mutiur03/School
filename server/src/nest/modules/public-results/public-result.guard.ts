import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';

const PUBLIC_RESULT_ROLE = 'public_result';

/** Short-lived token handed out by POST /public-results/verification, bound to the issuing school. */
export const signPublicResultToken = (studentId: number, schoolId: number) =>
  jwt.sign({ id: studentId, schoolId, role: PUBLIC_RESULT_ROLE }, env.JWT_SECRET, {
    expiresIn: '15m',
  });

/**
 * Verifies the public-result bearer token (same school as the request host) and sets `req.user`
 * to that student (role 'student'), so `@CurrentUser()` and the marksheet access check work unchanged.
 */
@Injectable()
export class PublicResultGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException('Unauthorized');
    let decoded: { id?: number; schoolId?: number; role?: string };
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as typeof decoded;
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof jwt.TokenExpiredError
          ? 'Session expired. Please verify again.'
          : 'Invalid token',
      );
    }
    if (decoded?.role !== PUBLIC_RESULT_ROLE || !decoded.id || decoded.schoolId !== req.schoolId) {
      throw new UnauthorizedException('Invalid token');
    }
    req.user = { id: decoded.id, role: 'student' } as Request['user'];
    return true;
  }
}
