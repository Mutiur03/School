import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AccHeadType, PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { PRISMA } from '../../../common/prisma.module.js';
import type { CreateAccHeadDto } from './dto/create-acc-head.dto.js';
import type { UpdateAccHeadDto } from './dto/update-acc-head.dto.js';
import { OpeningBalanceService } from './opening-balance.service.js';

type TreeFields = { type: AccHeadType; parent_id?: number | null; is_cash_bank?: boolean };

@Injectable()
export class AccHeadService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly opening: OpeningBalanceService,
  ) {}

  /** Heads with their opening balance (natural side) and the school's opening date. */
  async findAll(schoolId: number) {
    const [heads, voucher] = await Promise.all([
      this.prisma.acc_heads.findMany({
        where: { school_id: schoolId },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.opening.find(this.prisma, schoolId),
    ]);
    const lines = new Map(voucher?.lines.map((l) => [l.head_id, l]));
    return heads.map((h) => {
      const line = lines.get(h.id);
      return {
        ...h,
        opening_balance: line ? OpeningBalanceService.amountOf(h.type, line) : 0,
        opening_date: voucher ? voucher.date.toISOString().slice(0, 10) : null,
      };
    });
  }

  findOne(schoolId: number, id: number) {
    return this.prisma.acc_heads.findFirstOrThrow({ where: { id, school_id: schoolId } });
  }

  async create(schoolId: number, dto: CreateAccHeadDto) {
    await this.validate(schoolId, dto);
    const { opening_balance, opening_date, ...data } = dto;
    if (!opening_balance)
      return this.prisma.acc_heads.create({ data: { ...data, school_id: schoolId } });
    return rlsTransaction(async (tx) => {
      const head = await tx.acc_heads.create({ data: { ...data, school_id: schoolId } });
      await this.opening.set(tx, schoolId, head, opening_balance, opening_date);
      return head;
    });
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
    const { opening_balance, opening_date, ...data } = dto;
    const where = { id, school_id: schoolId };
    if (opening_balance == null) return this.prisma.acc_heads.update({ where, data });
    return rlsTransaction(async (tx) => {
      const head = await tx.acc_heads.update({ where, data });
      await this.opening.set(tx, schoolId, head, opening_balance, opening_date);
      return head;
    });
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
