import jwt from 'jsonwebtoken';
import { ApiError } from '@/utils/ApiError.js';
import { verifyAccessToken } from '@/modules/auth/auth-tokens.js';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config/prisma.js';
import { assertSuperAdminHostAllowed } from '@/utils/superAdminDomain.js';
import { assertTenantContextForAuthenticatedRequest } from '@/middlewares/access.middleware.js';
import { syncSentryUser } from '@/config/sentry.js';
class AuthMiddleware {
  static authenticate(roles: string[] = []) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) return next(new ApiError(401, 'Unauthorized'));

      try {
        // Rejects refresh tokens (typ claim) even when both are signed with the same secret.
        const decoded = verifyAccessToken(token);

        if (!decoded || !decoded.id) {
          return next(new ApiError(401, 'Invalid Token'));
        }

        // Token issued for another school than the one this host resolves to.
        if (
          decoded.role !== 'super_admin' &&
          decoded.sch !== null &&
          decoded.sch !== req.schoolId
        ) {
          return next(new ApiError(403, 'Forbidden: Tenant context mismatch'));
        }

        if (roles.length > 0 && !roles.includes(decoded.role)) {
          return next(new ApiError(403, 'Forbidden: Insufficient permissions'));
        }

        let dbUser: any = null;

        if (decoded.role === 'super_admin') {
          await assertSuperAdminHostAllowed(req);
          dbUser = await prisma.superAdmin.findUnique({
            where: { id: decoded.id },
          });
        } else {
          if (!req.schoolId) {
            return next(new ApiError(400, 'School context missing'));
          }

          if (decoded.role === 'admin') {
            dbUser = await prisma.admin.findFirst({
              where: { id: decoded.id, school_id: req.schoolId },
            });
          } else if (decoded.role === 'teacher') {
            dbUser = await prisma.teachers.findFirst({
              where: {
                id: decoded.id,
                school_id: req.schoolId,
                available: true,
              },
              include: { levels: true },
            });
          } else if (decoded.role === 'student') {
            dbUser = await prisma.students.findFirst({
              where: { id: decoded.id, school_id: req.schoolId },
            });
          } else {
            return next(new ApiError(401, 'Invalid Token'));
          }
        }

        if (!dbUser) return next(new ApiError(401, 'Unauthorized'));

        try {
          assertTenantContextForAuthenticatedRequest(
            req,
            decoded.role,
            (dbUser as any)?.school_id ?? null,
          );
        } catch (error) {
          return next(error);
        }

        if (dbUser.password) delete dbUser.password;
        const user = { ...dbUser, role: decoded.role };
        req.user = user;
        syncSentryUser(user);
        next();
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          return next(new ApiError(401, 'Token expired'));
        }
        return next(new ApiError(401, 'Invalid Token'));
      }
    };
  }

  /** Attach req.user when a valid token is present; continue anonymously otherwise. */
  static authenticateOptional(roles: string[] = []) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return next();

      return AuthMiddleware.authenticate(roles)(req, res, (err) => {
        if (err) {
          delete req.user;
        }
        return next();
      });
    };
  }
}

export default AuthMiddleware;
