import { Request, Response, NextFunction } from "express";
import { ApiError } from "@/utils/ApiError.js";
import { assertSuperAdminHostAllowed } from "@/utils/superAdminDomain.js";

export const requireSchoolContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.schoolId) {
    return next(new ApiError(400, "School context missing"));
  }

  return next();
};

export const requireSuperAdminHostMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    await assertSuperAdminHostAllowed(req);
    return next();
  } catch {
    return next(
      new ApiError(403, "Access denied: Invalid host for super admin"),
    );
  }
};

export const requireSchoolContextOrSuperAdminHostMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (req.schoolId) {
    return next();
  }

  try {
    await assertSuperAdminHostAllowed(req);
    return next();
  } catch {
    return next(new ApiError(400, "School context missing"));
  }
};

export const assertTenantContextForAuthenticatedRequest = (
  req: Request,
  role?: string,
  userSchoolId?: number | null,
) => {
  if (role === "super_admin") {
    return;
  }

  if (!req.schoolId) {
    throw new ApiError(400, "School context missing");
  }

  if (
    typeof userSchoolId === "number" &&
    Number.isInteger(userSchoolId) &&
    userSchoolId !== req.schoolId
  ) {
    throw new ApiError(403, "Forbidden: Tenant context mismatch");
  }
};
