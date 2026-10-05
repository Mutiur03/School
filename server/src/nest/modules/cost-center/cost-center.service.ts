import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateCostCenterDto } from './dto/create-cost-center.dto.js';
import type { UpdateCostCenterDto } from './dto/update-cost-center.dto.js';

@Injectable()
export class CostCenterService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  findAll(schoolId: number) {
    return this.prisma.acc_cost_centers.findMany({
      where: { school_id: schoolId },
      orderBy: { name: 'asc' },
    });
  }

  findOne(schoolId: number, id: number) {
    return this.prisma.acc_cost_centers.findFirstOrThrow({ where: { id, school_id: schoolId } });
  }

  create(schoolId: number, dto: CreateCostCenterDto) {
    return this.prisma.acc_cost_centers.create({ data: { ...dto, school_id: schoolId } });
  }

  update(schoolId: number, id: number, dto: UpdateCostCenterDto) {
    return this.prisma.acc_cost_centers.update({ where: { id, school_id: schoolId }, data: dto });
  }

  async remove(schoolId: number, id: number) {
    await this.prisma.acc_cost_centers.delete({ where: { id, school_id: schoolId } });
  }
}
