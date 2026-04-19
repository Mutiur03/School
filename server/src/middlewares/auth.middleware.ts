import jwt from "jsonwebtoken";
import { ApiError } from "@/utils/ApiError.js";
import { env } from "@/config/env.js";
import { Request, Response, NextFunction } from "express";
import { prisma } from "@/config/prisma.js";
import { assertSuperAdminHostAllowed } from "@/utils/superAdminDomain.js";
import { assertTenantContextForAuthenticatedRequest } from "@/middlewares/access.middleware.js";
interface TokenPayload {
  id: number;
  role: string;
}

class AuthMiddleware {
  static authenticate(roles: string[] = []) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) return next(new ApiError(401, "Unauthorized"));

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

        if (!decoded || typeof decoded !== "object" || !decoded.id) {
          return next(new ApiError(401, "Invalid Token"));
        }

        if (roles.length > 0 && !roles.includes(decoded.role)) {
          return next(new ApiError(403, "Forbidden: Insufficient permissions"));
        }

        let dbUser: any = null;

        if (decoded.role === "super_admin") {
          await assertSuperAdminHostAllowed(req);
          dbUser = await prisma.superAdmin.findUnique({
            where: { id: decoded.id },
          });
        } else {
          if (!req.schoolId) {
            return next(new ApiError(400, "School context missing"));
          }

          if (decoded.role === "admin") {
            dbUser = await prisma.admin.findFirst({
              where: { id: decoded.id, school_id: req.schoolId },
            });
          } else if (decoded.role === "teacher") {
            dbUser = await prisma.teachers.findFirst({
              where: {
                id: decoded.id,
                school_id: req.schoolId,
                available: true,
              },
              include: { levels: true },
            });
          } else if (decoded.role === "student") {
            dbUser = await prisma.students.findFirst({
              where: { id: decoded.id, school_id: req.schoolId },
            });
          } else {
            return next(new ApiError(401, "Invalid Token"));
          }
        }

        if (!dbUser) return next(new ApiError(401, "Unauthorized"));

        assertTenantContextForAuthenticatedRequest(
          req,
          decoded.role,
          (dbUser as any)?.school_id ?? null,
        );

        if (dbUser.password) delete dbUser.password;
        const user = { ...dbUser, role: decoded.role };
        req.user = user;
        next();
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          return next(new ApiError(401, "Token expired"));
        }
        return next(new ApiError(401, "Invalid Token"));
      }
    };
  }
}

export default AuthMiddleware;
