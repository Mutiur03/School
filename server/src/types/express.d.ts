import { admin, students, SuperAdmin, teachers } from '@/generated/prisma/client.js';

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
