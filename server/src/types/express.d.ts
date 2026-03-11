import { admin, students, teachers } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: (
        | admin
        | (students & { role: string })
        | (teachers & { role: string })
      ) & { role: string };
    }
  }
}
