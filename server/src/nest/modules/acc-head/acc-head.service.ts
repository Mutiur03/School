import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AccHeadType, PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateAccHeadDto } from './dto/create-acc-head.dto.js';
import type { UpdateAccHeadDto } from './dto/update-acc-head.dto.js';

type TreeFields = { type: AccHeadType; parent_id?: number | null; is_cash_bank?: boolean };

@Injectable()
export class AccHeadService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  findAll(schoolId: number) {
    return this.prisma.acc_heads.findMany({
      where: { school_id: schoolId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  findOne(schoolId: number, id: number) {
    return this.prisma.acc_heads.findFirstOrThrow({ where: { id, school_id: schoolId } });
  }

  async create(schoolId: number, dto: CreateAccHeadDto) {
    await this.validate(schoolId, dto);
    return this.prisma.acc_heads.create({ data: { ...dto, school_id: schoolId } });
  }

  async update(schoolId: number, id: number, dto: UpdateAccHeadDto) {
    if (dto.type !== undefined || dto.parent_id !== undefined || dto.is_cash_bank !== undefined) {
      const current = await this.findOne(schoolId, id);
      await this.validate(
        schoolId,
        {
          type: dto.type ?? current.type,
          parent_id: dto.parent_id !== undefined ? dto.parent_id : current.parent_id,
          is_cash_bank: dto.is_cash_bank ?? current.is_cash_bank,
        },
        id,
      );
    }
    return this.prisma.acc_heads.update({ where: { id, school_id: schoolId }, data: dto });
  }

  async remove(schoolId: number, id: number) {
    await this.prisma.acc_heads.delete({ where: { id, school_id: schoolId } });
  }

  // ponytail: only blocks self-parenting, not deeper cycles (A→B→A); add an ancestor walk if heads nest deeply.
  private async validate(schoolId: number, head: TreeFields, selfId?: number) {
    if (head.is_cash_bank && head.type !== 'asset') {
      throw new BadRequestException('Only asset heads can be cash/bank accounts');
    }
    if (head.parent_id == null) return;
    if (head.parent_id === selfId) {
      throw new BadRequestException('A head cannot be its own parent');
    }
    const parent = await this.prisma.acc_heads.findFirst({
      where: { id: head.parent_id, school_id: schoolId },
    });
    if (!parent) throw new BadRequestException('Parent head not found');
    if (parent.type !== head.type) {
      throw new BadRequestException('Parent head must have the same type');
    }
  }
}
