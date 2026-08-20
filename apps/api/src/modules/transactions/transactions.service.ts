import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Transaction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, resolveOrderBy } from '../../common/dto/pagination.dto';
import {
  CreateTransactionDto,
  DIRECTION_BY_TYPE,
  TransactionQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';

const SORTABLE = ['occurredAt', 'amount', 'type', 'status', 'createdAt'] as const;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TransactionQueryDto): Promise<Paginated<Transaction>> {
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: resolveOrderBy(query, SORTABLE, 'occurredAt'),
        skip: query.skip,
        take: query.pageSize,
        include: {
          investment: {
            select: { id: true, vehicleName: true, asset: { select: { name: true } } },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { investment: { include: { asset: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaction not found.');
    return transaction;
  }

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    await this.ensureInvestmentExists(dto.investmentId);
    const { occurredAt, direction, ...rest } = dto;

    return this.prisma.transaction.create({
      data: {
        ...rest,
        direction: direction ?? DIRECTION_BY_TYPE[dto.type],
        occurredAt: new Date(occurredAt),
      },
      include: {
        investment: { select: { id: true, vehicleName: true, asset: { select: { name: true } } } },
      },
    });
  }

  async update(id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    await this.ensureExists(id);
    if (dto.investmentId) await this.ensureInvestmentExists(dto.investmentId);

    const { occurredAt, direction, type, ...rest } = dto;

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...rest,
        ...(type ? { type } : {}),
        // Changing the type without an explicit direction re-derives it, so the
        // two can never drift apart.
        ...(direction ? { direction } : type ? { direction: DIRECTION_BY_TYPE[type] } : {}),
        ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
      },
      include: {
        investment: { select: { id: true, vehicleName: true, asset: { select: { name: true } } } },
      },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    await this.prisma.transaction.delete({ where: { id } });
    return { id };
  }

  private buildWhere(query: TransactionQueryDto): Prisma.TransactionWhereInput {
    const occurredAt: Prisma.DateTimeFilter = {};
    if (query.from) occurredAt.gte = new Date(query.from);
    if (query.to) occurredAt.lte = new Date(query.to);

    return {
      ...(query.investmentId ? { investmentId: query.investmentId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to ? { occurredAt } : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
              { investment: { vehicleName: { contains: query.search, mode: 'insensitive' } } },
              {
                investment: {
                  asset: { name: { contains: query.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.transaction.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('Transaction not found.');
  }

  private async ensureInvestmentExists(investmentId: string): Promise<void> {
    const exists = await this.prisma.investment.count({ where: { id: investmentId } });
    if (exists === 0) throw new NotFoundException('Investment not found.');
  }
}
