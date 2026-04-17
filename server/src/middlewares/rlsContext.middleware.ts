import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import {
  patchRlsContext,
  runWithRlsContext,
} from "@/config/rlsContextStore.js";

type TokenPayload = {
  role?: string;
};

const getTokenRole = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token) return undefined;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return decoded?.role;
  } catch {
    return undefined;
  }
};

export const initRlsContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const role = getTokenRole(req);

  runWithRlsContext(
    {
      schoolId: req.schoolId,
      isSuperAdmin: role === "super_admin",
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
    isSuperAdmin: req.user?.role === "super_admin" || undefined,
  });
  next();
};
