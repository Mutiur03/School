import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';
import { BillingService } from '@/modules/billing/billing.service.js';

const TENANT_ROLES = new Set(['admin', 'teacher', 'student']);
const ALLOWED_WHEN_LOCKED = new Set([
  'GET /api/schools/billing',
  'GET /api/schools/subscription-access',
]);

const requestPath = (req: Request) => (req.originalUrl || req.url || '').split('?')[0];

export async function enforceSubscriptionAccess(req: Request, res: Response, next: NextFunction) {
  const path = requestPath(req);
  // Auth must keep working while locked (refresh / logout / login).
  if (path.startsWith('/api/auth/')) return next();

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token || !req.schoolId) return next();

  let role: string | undefined;
  try {
    role = (jwt.verify(token, env.JWT_SECRET) as { role?: string }).role;
  } catch {
    // Expired/invalid access token — let AuthMiddleware return 401 so refresh can run.
    return next();
  }
  if (!role || !TENANT_ROLES.has(role)) return next();

  const routeKey = `${req.method.toUpperCase()} ${path}`;
  if (ALLOWED_WHEN_LOCKED.has(routeKey)) return next();

  try {
    const access = await BillingService.getAccessForSchool(req.schoolId);
    if (!access.is_locked) return next();

    return res.status(402).json({
      success: false,
      message: 'Subscription access is locked. Renew the annual subscription to continue.',
      data: access,
      errors: [],
    });
  } catch {
    return res.status(402).json({
      success: false,
      message: 'Subscription access is unavailable. Contact the platform administrator.',
      data: { access_state: 'locked', is_locked: true },
      errors: [],
    });
  }
}
