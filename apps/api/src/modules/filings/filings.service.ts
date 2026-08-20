import { Injectable, NotFoundException } from '@nestjs/common';
import { Filing, FilingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, resolveOrderBy } from '../../common/dto/pagination.dto';
import { CreateFilingDto, FilingQueryDto, UpdateFilingDto } from './dto/filing.dto';

const SORTABLE = ['dueDate', 'vehicleName', 'type', 'status', 'createdAt'] as const;

/** How far ahead "due soon" looks, in days. */
export const DUE_SOON_WINDOW_DAYS = 30;

const INCLUDE_ASSIGNEE = {
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.FilingInclude;

@Injectable()
export class FilingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FilingQueryDto): Promise<Paginated<Filing>> {
    const where: Prisma.FilingWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.dueSoon
        ? {
            status: { not: FilingStatus.CLOSED },
            dueDate: { lte: this.dueSoonCutoff() },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { vehicleName: { contains: query.search, mode: 'insensitive' } },
              { jurisdiction: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.filing.findMany({
        where,
        // Deadlines read best soonest-first, so this list defaults to ascending.
        orderBy: resolveOrderBy(query, SORTABLE, 'dueDate', 'asc'),
        skip: query.skip,
        take: query.pageSize,
        include: INCLUDE_ASSIGNEE,
      }),
      this.prisma.filing.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<Filing> {
    const filing = await this.prisma.filing.findUnique({
      where: { id },
      include: INCLUDE_ASSIGNEE,
    });

    if (!filing) throw new NotFoundException('Filing not found.');
    return filing;
  }

  async create(dto: CreateFilingDto): Promise<Filing> {
    if (dto.assigneeId) await this.ensureUserExists(dto.assigneeId);
    const status = dto.status ?? FilingStatus.OPEN;

    return this.prisma.filing.create({
      data: {
        ...dto,
        status,
        dueDate: new Date(dto.dueDate),
        ...this.submissionStamp(status),
      },
      include: INCLUDE_ASSIGNEE,
    });
  }

  async update(id: string, dto: UpdateFilingDto): Promise<Filing> {
    const current = await this.prisma.filing.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Filing not found.');
    if (dto.assigneeId) await this.ensureUserExists(dto.assigneeId);

    const { dueDate, status, ...rest } = dto;

    return this.prisma.filing.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(status ? { status, ...this.submissionStamp(status, current.submittedAt) } : {}),
      },
      include: INCLUDE_ASSIGNEE,
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    await this.prisma.filing.delete({ where: { id } });
    return { id };
  }

  /**
   * Reaching SUBMITTED or CLOSED stamps the submission time once; moving back
   * to an open state clears it so the record never claims a filing that is
   * still outstanding was submitted.
   */
  private submissionStamp(
    status?: FilingStatus,
    existing?: Date | null,
  ): { submittedAt?: Date | null } {
    if (!status) return {};
    const isSubmitted = status === FilingStatus.SUBMITTED || status === FilingStatus.CLOSED;
    if (!isSubmitted) return { submittedAt: null };
    // Closing an already-submitted filing must not rewrite the original date.
    return { submittedAt: existing ?? new Date() };
  }

  private dueSoonCutoff(): Date {
    return new Date(Date.now() + DUE_SOON_WINDOW_DAYS * 86_400_000);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.filing.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('Filing not found.');
  }

  private async ensureUserExists(id: string): Promise<void> {
    const exists = await this.prisma.user.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('Assignee not found.');
  }
}
