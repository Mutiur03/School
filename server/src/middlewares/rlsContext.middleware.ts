import type { NextFunction, Request, Response } from 'express';
import { patchRlsContext, runWithRlsContext } from '@/config/rlsContextStore.js';
import { accessTokenRole } from '@/modules/auth/auth-tokens.js';

/** Role of a valid ACCESS token only; refresh tokens never set super-admin RLS context. */
const getTokenRole = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  return accessTokenRole(token);
};

export const initRlsContextMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const role = getTokenRole(req);

  runWithRlsContext(
    {
      schoolId: req.schoolId,
      isSuperAdmin: role === 'super_admin',
      inRlsTransaction: false,
    },
    () => next(),
  );
};

export const syncRlsSchoolContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  patchRlsContext({
    schoolId: req.schoolId,
    isSuperAdmin: req.user?.role === 'super_admin' || undefined,
  });
  next();
};
