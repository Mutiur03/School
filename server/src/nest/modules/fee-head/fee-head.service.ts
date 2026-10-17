import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateFeeHeadDto } from './dto/create-fee-head.dto.js';
import type { UpdateFeeHeadDto } from './dto/update-fee-head.dto.js';

const include = {
  income_head: { select: { id: true, name: true } },
  deposit_head: { select: { id: true, name: true } },
};

@Injectable()
export class FeeHeadService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  findAll(schoolId: number) {
    return this.prisma.fee_heads.findMany({
      where: { school_id: schoolId },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include,
    });
  }

  findOne(schoolId: number, id: number) {
    return this.prisma.fee_heads.findFirstOrThrow({ where: { id, school_id: schoolId }, include });
  }

  async create(schoolId: number, dto: CreateFeeHeadDto) {
    if (dto.income_head_id !== undefined) await this.checkIncomeHead(schoolId, dto.income_head_id);
    await this.checkDepositHead(schoolId, dto.deposit_head_id);
    const income_head_id =
      dto.income_head_id ?? (await this.incomeHeadFor(schoolId, `${dto.name} Fees`));
    return this.prisma.fee_heads.create({
      data: { ...dto, income_head_id, school_id: schoolId },
      include,
    });
  }

  async update(schoolId: number, id: number, dto: UpdateFeeHeadDto) {
    if (dto.income_head_id !== undefined) await this.checkIncomeHead(schoolId, dto.income_head_id);
    await this.checkDepositHead(schoolId, dto.deposit_head_id);
    return this.prisma.fee_heads.update({ where: { id, school_id: schoolId }, data: dto, include });
  }

  async remove(schoolId: number, id: number) {
    await this.prisma.fee_heads.delete({ where: { id, school_id: schoolId } });
  }

  /** Existing income account with this name, else a new one (names are unique per school). */
  private async incomeHeadFor(schoolId: number, name: string) {
    const found = await this.prisma.acc_heads.findFirst({
      where: { school_id: schoolId, name },
      select: { id: true, type: true },
    });
    if (found) {
      if (found.type !== 'income')
        throw new BadRequestException(
          `Account "${name}" already exists and is not an income account`,
        );
      return found.id;
    }
    const created = await this.prisma.acc_heads.create({
      data: { school_id: schoolId, name, type: 'income' },
      select: { id: true },
    });
    return created.id;
  }

  private async checkDepositHead(schoolId: number, id: number | null | undefined) {
    if (id == null) return;
    const found = await this.prisma.acc_heads.count({
      where: { id, school_id: schoolId, is_cash_bank: true, is_active: true },
    });
    if (!found)
      throw new BadRequestException('Deposit account must be an active cash/bank account');
  }

  // FK checks bypass RLS, so this school_id filter is the real tenant gate.
  private async checkIncomeHead(schoolId: number, id: number) {
    const found = await this.prisma.acc_heads.count({
      where: { id, school_id: schoolId, type: 'income' },
    });
    if (!found) throw new BadRequestException('Income head not found');
  }
}
