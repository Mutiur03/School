import jwt from "jsonwebtoken";
import { ApiError } from "@/utils/ApiError.js";
import { env } from "@/config/env.js";
import { Request, Response, NextFunction } from "express";
import { prisma } from "@/config/prisma.js";
import { assertSuperAdminHostAllowed } from "@/utils/superAdminDomain.js";
interface TokenPayload {
  id: number;
  role: string;
}

const roleFetchers: Record<string, (id: number) => Promise<any>> = {
  admin: (id: number) => prisma.admin.findUnique({ where: { id } }),
  teacher: (id: number) =>
    prisma.teachers.findFirst({
      where: { id, available: true },
      include: { levels: true },
    }),
  student: (id: number) => prisma.students.findUnique({ where: { id } }),
  super_admin: (id: number) => prisma.superAdmin.findUnique({ where: { id } }),
};

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

        const fetchRoleUser = roleFetchers[decoded.role];
        if (!fetchRoleUser) {
          return next(new ApiError(401, "Invalid Token"));
        }

        const dbUser = await fetchRoleUser(decoded.id);

        if (!dbUser) return next(new ApiError(401, "Unauthorized"));

        if (
          decoded.role === "super_admin" &&
          !(await assertSuperAdminHostAllowed(req))
        ) {
          return next(new ApiError(403, "Forbidden: Insufficient permissions"));
        }

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
