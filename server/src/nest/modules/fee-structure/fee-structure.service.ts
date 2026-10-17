import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { PRISMA } from '../../common/prisma.module.js';
import type {
  CopyStructureDto,
  SetStructureDto,
  StructureQueryDto,
} from './dto/fee-structure.dto.js';

@Injectable()
export class FeeStructureService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async findAll(schoolId: number, q: StructureQueryDto) {
    const rows = await this.prisma.fee_structures.findMany({
      where: { school_id: schoolId, year: q.year, ...(q.class && { class: q.class }) },
      orderBy: [{ class: 'asc' }, { fee_head: { sort_order: 'asc' } }],
      include: { fee_head: { select: { id: true, name: true, frequency: true } } },
    });
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  async set(schoolId: number, dto: SetStructureDto) {
    const ids = dto.items.map((i) => i.fee_head_id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate fee head');
    // FK checks bypass RLS, so this school_id filter is the real tenant gate.
    const found = await this.prisma.fee_heads.count({
      where: { id: { in: ids }, school_id: schoolId },
    });
    if (found !== ids.length) throw new BadRequestException('Unknown fee head');

    const { year, class: cls } = dto;
    await rlsTransaction(async (tx) => {
      await tx.fee_structures.deleteMany({ where: { school_id: schoolId, year, class: cls } });
      await tx.fee_structures.createMany({
        data: dto.items.map((i) => ({
          school_id: schoolId,
          year,
          class: cls,
          fee_head_id: i.fee_head_id,
          amount: i.amount,
        })),
      });
    });
    return this.findAll(schoolId, { year, class: cls });
  }

  /** Copies every class's fees into `to_year`, leaving classes that already have fees there alone. */
  async copy(schoolId: number, dto: CopyStructureDto) {
    if (dto.from_year === dto.to_year) throw new BadRequestException('Years must differ');
    const [source, existing] = await Promise.all([
      this.prisma.fee_structures.findMany({ where: { school_id: schoolId, year: dto.from_year } }),
      this.prisma.fee_structures.findMany({
        where: { school_id: schoolId, year: dto.to_year },
        distinct: ['class'],
        select: { class: true },
      }),
    ]);
    const skip = new Set(existing.map((e) => e.class));
    const data = source
      .filter((s) => !skip.has(s.class))
      .map((s) => ({
        school_id: schoolId,
        year: dto.to_year,
        class: s.class,
        fee_head_id: s.fee_head_id,
        amount: s.amount,
      }));
    if (data.length) await this.prisma.fee_structures.createMany({ data });
    return { copied: data.length };
  }
}
