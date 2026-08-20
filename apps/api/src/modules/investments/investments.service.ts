import { Injectable, NotFoundException } from '@nestjs/common';
import { Investment, InvestmentStatus, Prisma, Valuation } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, resolveOrderBy } from '../../common/dto/pagination.dto';
import {
  CreateInvestmentDto,
  CreateValuationDto,
  InvestmentQueryDto,
  UpdateInvestmentDto,
} from './dto/investment.dto';

export interface InvestmentSummary {
  totalValuation: number;
  totalCostBasis: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
  count: number;
  activeCount: number;
}

const SORTABLE = [
  'vehicleName',
  'investedAt',
  'investedAmount',
  'currentValuation',
  'status',
  'createdAt',
] as const;

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: InvestmentQueryDto): Promise<Paginated<Investment>> {
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.investment.findMany({
        where,
        orderBy: resolveOrderBy(query, SORTABLE, 'investedAt'),
        skip: query.skip,
        take: query.pageSize,
        include: { asset: { select: { id: true, name: true, type: true, ticker: true } } },
      }),
      this.prisma.investment.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  /**
   * Totals for whatever the current filters match, not just the visible page —
   * the Investments list shows these above the table, so they must describe
   * the same set of rows the filters produced, not a partial sum of one page.
   */
  async summary(query: InvestmentQueryDto): Promise<InvestmentSummary> {
    const where = this.buildWhere(query);

    const [totals, count, activeCount] = await this.prisma.$transaction([
      this.prisma.investment.aggregate({
        where,
        _sum: { currentValuation: true, costBasis: true },
      }),
      this.prisma.investment.count({ where }),
      this.prisma.investment.count({ where: { ...where, status: InvestmentStatus.ACTIVE } }),
    ]);

    const totalValuation = this.toNumber(totals._sum.currentValuation);
    const totalCostBasis = this.toNumber(totals._sum.costBasis);
    const unrealisedGain = totalValuation - totalCostBasis;

    return {
      totalValuation,
      totalCostBasis,
      unrealisedGain,
      unrealisedGainPct: totalCostBasis > 0 ? (unrealisedGain / totalCostBasis) * 100 : 0,
      count,
      activeCount,
    };
  }

  /** Lightweight list for populating select inputs. */
  async options(): Promise<Array<{ id: string; label: string; assetName: string }>> {
    const rows = await this.prisma.investment.findMany({
      select: { id: true, vehicleName: true, asset: { select: { name: true } } },
      orderBy: { vehicleName: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      label: `${row.vehicleName} — ${row.asset.name}`,
      assetName: row.asset.name,
    }));
  }

  async findOne(id: string): Promise<Investment> {
    const investment = await this.prisma.investment.findUnique({
      where: { id },
      include: {
        asset: true,
        valuations: { orderBy: { asOf: 'desc' }, take: 24 },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 20 },
        distributions: { orderBy: { declaredDate: 'desc' }, take: 20 },
      },
    });

    if (!investment) throw new NotFoundException('Investment not found.');
    return investment;
  }

  async create(dto: CreateInvestmentDto): Promise<Investment> {
    await this.ensureAssetExists(dto.assetId);

    const { investedAt, ...rest } = dto;

    // Seed the valuation history so the very first data point is on record.
    return this.prisma.investment.create({
      data: {
        ...rest,
        investedAt: new Date(investedAt),
        valuations: {
          create: {
            asOf: new Date(investedAt),
            value: dto.currentValuation,
            source: 'Initial mark',
          },
        },
      },
      include: { asset: { select: { id: true, name: true, type: true } } },
    });
  }

  async update(id: string, dto: UpdateInvestmentDto): Promise<Investment> {
    await this.ensureExists(id);
    if (dto.assetId) await this.ensureAssetExists(dto.assetId);

    const { investedAt, ...rest } = dto;

    return this.prisma.investment.update({
      where: { id },
      data: { ...rest, ...(investedAt ? { investedAt: new Date(investedAt) } : {}) },
      include: { asset: { select: { id: true, name: true, type: true } } },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    // Transactions, distributions and valuations cascade — see schema.prisma.
    await this.prisma.investment.delete({ where: { id } });
    return { id };
  }

  /**
   * Recording a valuation also moves the investment's current mark, so the
   * portfolio total and the history never disagree.
   */
  async addValuation(id: string, dto: CreateValuationDto): Promise<Valuation> {
    await this.ensureExists(id);
    const asOf = new Date(dto.asOf);

    const [valuation] = await this.prisma.$transaction([
      this.prisma.valuation.upsert({
        where: { investmentId_asOf: { investmentId: id, asOf } },
        create: { investmentId: id, asOf, value: dto.value, source: dto.source },
        update: { value: dto.value, source: dto.source },
      }),
      this.prisma.investment.update({
        where: { id },
        data: { currentValuation: dto.value },
      }),
    ]);

    return valuation;
  }

  private buildWhere(query: InvestmentQueryDto): Prisma.InvestmentWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.vehicle ? { vehicle: query.vehicle } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.search
        ? {
            OR: [
              { vehicleName: { contains: query.search, mode: 'insensitive' } },
              { asset: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private toNumber(value: Prisma.Decimal | null): number {
    return value ? Number(value) : 0;
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.investment.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('Investment not found.');
  }

  private async ensureAssetExists(assetId: string): Promise<void> {
    const exists = await this.prisma.asset.count({ where: { id: assetId } });
    if (exists === 0) throw new NotFoundException('Asset not found.');
  }
}
