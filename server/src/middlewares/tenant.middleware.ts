import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import { SchoolService } from "../modules/school/school.service.js";

// Extend the Express Request type to include schoolId
declare global {
  namespace Express {
    interface Request {
      schoolId?: number;
    }
  }
}

// Simple in-memory cache to avoid excessive DB lookups
const domainCache = new Map<string, { id: number; expire: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const tenantMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const hostname = req.hostname;
  const schoolIdHeader = req.headers["x-school-id"];

  // 1. Check header first (explicit override or for development)
  if (schoolIdHeader) {
    const parsedId = parseInt(schoolIdHeader as string, 10);
    if (!isNaN(parsedId)) {
      req.schoolId = parsedId;
      return next();
    }
  }

  // 2. Resolve from hostname
  const cached = domainCache.get(hostname);
  if (cached && cached.expire > Date.now()) {
    req.schoolId = cached.id;
    return next();
  }

  try {
    const school = await SchoolService.getSchoolByDomain(hostname);
    if (school) {
      req.schoolId = school.id;
      domainCache.set(hostname, { id: school.id, expire: Date.now() + CACHE_TTL });
    }
  } catch (error) {
    console.error("Error resolving school by domain:", error);
  }

  next();
};

export const requireSchool = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.schoolId) {
    throw new ApiError(400, "X-School-Id header is required for this request");
  }
  next();
};
