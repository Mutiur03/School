import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../../common/prisma.module.js';
import type { CreateFeeWaiverDto, WaiverQueryDto } from './dto/create-fee-waiver.dto.js';
import type { UpdateFeeWaiverDto } from './dto/update-fee-waiver.dto.js';

const include = {
  student: { select: { id: true, name: true, login_id: true } },
  fee_head: { select: { id: true, name: true } },
};

const present = <T extends { value: unknown }>(row: T) => ({ ...row, value: Number(row.value) });

@Injectable()
export class FeeWaiverService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async findAll(schoolId: number, q: WaiverQueryDto) {
    const rows = await this.prisma.fee_waivers.findMany({
      where: {
        school_id: schoolId,
        ...(q.year && { year: q.year }),
        ...(q.student_id && { student_id: q.student_id }),
      },
      orderBy: { id: 'desc' },
      include,
    });
    return rows.map(present);
  }

  async create(schoolId: number, dto: CreateFeeWaiverDto) {
    this.checkValue(dto.percent, dto.value);
    // FK checks bypass RLS, so these school_id filters are the real tenant gate.
    const [student, head] = await Promise.all([
      this.prisma.students.count({ where: { id: dto.student_id, school_id: schoolId } }),
      dto.fee_head_id
        ? this.prisma.fee_heads.count({ where: { id: dto.fee_head_id, school_id: schoolId } })
        : 1,
    ]);
    if (!student) throw new BadRequestException('Student not found');
    if (!head) throw new BadRequestException('Fee head not found');
    return present(
      await this.prisma.fee_waivers.create({ data: { ...dto, school_id: schoolId }, include }),
    );
  }

  async update(schoolId: number, id: number, dto: UpdateFeeWaiverDto) {
    const current = await this.prisma.fee_waivers.findFirstOrThrow({
      where: { id, school_id: schoolId },
    });
    this.checkValue(dto.percent ?? current.percent, dto.value ?? Number(current.value));
    if (dto.fee_head_id) {
      const head = await this.prisma.fee_heads.count({
        where: { id: dto.fee_head_id, school_id: schoolId },
      });
      if (!head) throw new BadRequestException('Fee head not found');
    }
    return present(
      await this.prisma.fee_waivers.update({
        where: { id, school_id: schoolId },
        data: dto,
        include,
      }),
    );
  }

  async remove(schoolId: number, id: number) {
    await this.prisma.fee_waivers.delete({ where: { id, school_id: schoolId } });
  }

  private checkValue(percent: boolean | undefined, value: number) {
    if (percent && value > 100) throw new BadRequestException('Percentage cannot exceed 100');
  }
}
