import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Distribution, DistributionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, resolveOrderBy } from '../../common/dto/pagination.dto';
import {
  CreateDistributionDto,
  DistributionQueryDto,
  UpdateDistributionDto,
  UpdateDistributionStatusDto,
} from './dto/distribution.dto';

const SORTABLE = ['declaredDate', 'paymentDate', 'grossAmount', 'netAmount', 'status'] as const;

/** A distribution may only move forward, or back one step to correct a mistake. */
const ALLOWED_TRANSITIONS: Record<DistributionStatus, DistributionStatus[]> = {
  [DistributionStatus.DECLARED]: [DistributionStatus.APPROVED],
  [DistributionStatus.APPROVED]: [DistributionStatus.PAID, DistributionStatus.DECLARED],
  [DistributionStatus.PAID]: [DistributionStatus.APPROVED],
};

const INCLUDE_INVESTMENT = {
  investment: {
    select: { id: true, vehicleName: true, asset: { select: { name: true } } },
  },
} satisfies Prisma.DistributionInclude;

@Injectable()
export class DistributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: DistributionQueryDto): Promise<Paginated<Distribution>> {
    const declaredDate: Prisma.DateTimeFilter = {};
    if (query.from) declaredDate.gte = new Date(query.from);
    if (query.to) declaredDate.lte = new Date(query.to);

    const where: Prisma.DistributionWhereInput = {
      ...(query.investmentId ? { investmentId: query.investmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to ? { declaredDate } : {}),
      ...(query.search
        ? {
            OR: [
              { notes: { contains: query.search, mode: 'insensitive' } },
              { investment: { vehicleName: { contains: query.search, mode: 'insensitive' } } },
              {
                investment: { asset: { name: { contains: query.search, mode: 'insensitive' } } },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.distribution.findMany({
        where,
        orderBy: resolveOrderBy(query, SORTABLE, 'declaredDate'),
        skip: query.skip,
        take: query.pageSize,
        include: INCLUDE_INVESTMENT,
      }),
      this.prisma.distribution.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<Distribution> {
    const distribution = await this.prisma.distribution.findUnique({
      where: { id },
      include: INCLUDE_INVESTMENT,
    });

    if (!distribution) throw new NotFoundException('Distribution not found.');
    return distribution;
  }

  async create(dto: CreateDistributionDto): Promise<Distribution> {
    const exists = await this.prisma.investment.count({ where: { id: dto.investmentId } });
    if (exists === 0) throw new NotFoundException('Investment not found.');

    const withholdingTax = dto.withholdingTax ?? 0;
    this.assertWithholdingIsValid(dto.grossAmount, withholdingTax);

    return this.prisma.distribution.create({
      data: {
        investmentId: dto.investmentId,
        declaredDate: new Date(dto.declaredDate),
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        grossAmount: dto.grossAmount,
        withholdingTax,
        // Always derived, never client-supplied — the net is what LPs receive.
        netAmount: dto.grossAmount - withholdingTax,
        currency: dto.currency ?? 'USD',
        status: dto.status ?? DistributionStatus.DECLARED,
        notes: dto.notes,
      },
      include: INCLUDE_INVESTMENT,
    });
  }

  async update(id: string, dto: UpdateDistributionDto): Promise<Distribution> {
    const current = await this.prisma.distribution.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Distribution not found.');

    const grossAmount = dto.grossAmount ?? current.grossAmount.toNumber();
    const withholdingTax = dto.withholdingTax ?? current.withholdingTax.toNumber();
    this.assertWithholdingIsValid(grossAmount, withholdingTax);

    return this.prisma.distribution.update({
      where: { id },
      data: {
        ...(dto.declaredDate ? { declaredDate: new Date(dto.declaredDate) } : {}),
        ...(dto.paymentDate ? { paymentDate: new Date(dto.paymentDate) } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        grossAmount,
        withholdingTax,
        netAmount: grossAmount - withholdingTax,
      },
      include: INCLUDE_INVESTMENT,
    });
  }

  /** The declared → approved → paid workflow, with the legal moves enforced. */
  async updateStatus(id: string, dto: UpdateDistributionStatusDto): Promise<Distribution> {
    const current = await this.prisma.distribution.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Distribution not found.');

    if (current.status === dto.status) return this.findOne(id);

    if (!ALLOWED_TRANSITIONS[current.status].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move a distribution from ${current.status} to ${dto.status}.`,
      );
    }

    const becomingPaid = dto.status === DistributionStatus.PAID;

    return this.prisma.distribution.update({
      where: { id },
      data: {
        status: dto.status,
        ...(becomingPaid
          ? { paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date() }
          : {}),
      },
      include: INCLUDE_INVESTMENT,
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    const current = await this.prisma.distribution.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Distribution not found.');

    if (current.status === DistributionStatus.PAID) {
      throw new BadRequestException('A paid distribution cannot be deleted. Reverse it instead.');
    }

    await this.prisma.distribution.delete({ where: { id } });
    return { id };
  }

  private assertWithholdingIsValid(gross: number, withholding: number): void {
    if (withholding > gross) {
      throw new BadRequestException('Withholding tax cannot exceed the gross amount.');
    }
  }
}
