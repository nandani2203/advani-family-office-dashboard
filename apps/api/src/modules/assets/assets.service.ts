import { Injectable, NotFoundException } from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, resolveOrderBy } from '../../common/dto/pagination.dto';
import { AssetQueryDto, CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

const SORTABLE = ['name', 'type', 'sector', 'createdAt'] as const;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AssetQueryDto): Promise<Paginated<Asset>> {
    const where: Prisma.AssetWhereInput = {
      archivedAt: query.status === 'ARCHIVED' ? { not: null } : null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.sector ? { sector: { equals: query.sector, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { ticker: { contains: query.search, mode: 'insensitive' } },
              { sector: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        orderBy: resolveOrderBy(query, SORTABLE, 'name'),
        skip: query.skip,
        take: query.pageSize,
        include: { _count: { select: { investments: true } } },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  /** Lightweight list for populating select inputs. Archived assets can't be picked for a new position. */
  async options(): Promise<Array<{ id: string; name: string; type: string }>> {
    return this.prisma.asset.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        investments: {
          orderBy: { investedAt: 'desc' },
          select: {
            id: true,
            vehicleName: true,
            status: true,
            investedAmount: true,
            currentValuation: true,
            investedAt: true,
          },
        },
      },
    });

    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  create(dto: CreateAssetDto): Promise<Asset> {
    return this.prisma.asset.create({ data: { ...dto, currency: dto.currency ?? 'USD' } });
  }

  async update(id: string, dto: UpdateAssetDto): Promise<Asset> {
    await this.ensureExists(id);
    return this.prisma.asset.update({ where: { id }, data: dto });
  }

  /**
   * Soft delete — sets `archivedAt` instead of removing the row, so every
   * investment, transaction and distribution that points at this asset keeps
   * its history intact. Hidden from the default list and the options picker;
   * still reachable directly and via the Archived filter, and reversible.
   */
  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    await this.prisma.asset.update({ where: { id }, data: { archivedAt: new Date() } });
    return { id };
  }

  async restore(id: string): Promise<Asset> {
    await this.ensureExists(id);
    return this.prisma.asset.update({ where: { id }, data: { archivedAt: null } });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.asset.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('Asset not found.');
  }
}
