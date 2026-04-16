import { admin, students, SuperAdmin, teachers } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      schoolId?: number;
      user?: (
        | admin
        | (students & { role: string })
        | (SuperAdmin & { role: string })
        | (teachers & { role: string })
      ) & { role: string };
    }
  }
}
