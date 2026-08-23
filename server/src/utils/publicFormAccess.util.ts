import type { Request } from 'express';
import { ApiError } from '@/utils/ApiError.js';

export const isAdminRequest = (req: Request): boolean => req.user?.role === 'admin';

/** Public applicants may edit only while registration/admission is still pending. */
export const assertPendingFormEditAllowed = (
  req: Request,
  currentStatus: string | null | undefined,
) => {
  if (isAdminRequest(req)) return;
  if (currentStatus === 'pending') return;
  throw new ApiError(403, 'This form can no longer be edited');
};

/** Public applicants may only self-confirm (pending → approved). Admins may set any status. */
export const assertFormStatusChangeAllowed = (
  req: Request,
  currentStatus: string | null | undefined,
  newStatus: string,
) => {
  if (isAdminRequest(req)) return;
  if (newStatus === 'approved' && currentStatus === 'pending') return;
  throw new ApiError(403, 'Unauthorized status change');
};
