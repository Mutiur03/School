import { BadRequestException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Tenant school id resolved by the tenant middleware from the verified host. */
export const SchoolId = createParamDecorator((_: unknown, ctx: ExecutionContext): number => {
  const { schoolId } = ctx.switchToHttp().getRequest<Request>();
  if (!Number.isInteger(schoolId) || (schoolId as number) <= 0) {
    throw new BadRequestException('School context missing');
  }
  return schoolId as number;
});
