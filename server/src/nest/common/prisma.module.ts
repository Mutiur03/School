import { Global, Module } from '@nestjs/common';
import { prisma } from '@/config/prisma.js';

/** Inject with `@Inject(PRISMA) private readonly prisma: PrismaClient`. Wraps the RLS-extended singleton. */
export const PRISMA = Symbol('PRISMA');

@Global()
@Module({ providers: [{ provide: PRISMA, useValue: prisma }], exports: [PRISMA] })
export class PrismaModule {}
