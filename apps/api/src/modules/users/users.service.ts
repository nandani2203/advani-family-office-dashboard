import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog, Prisma, Role, UserPermission, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, resolveOrderBy } from '../../common/dto/pagination.dto';
import {
  AuditLogQueryDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateUserPermissionsDto,
  UserQueryDto,
} from './dto/user.dto';

const SORTABLE = ['email', 'name', 'role', 'status', 'lastLoginAt', 'createdAt'] as const;
const AUDIT_SORTABLE = ['createdAt', 'action', 'resource'] as const;

const SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUserRecord = Prisma.UserGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserQueryDto): Promise<Paginated<PublicUserRecord>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: resolveOrderBy(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.pageSize,
        select: SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  /** Lightweight list used to populate the filing-assignee picker. */
  options(): Promise<Array<{ id: string; name: string | null; email: string }>> {
    return this.prisma.user.findMany({
      where: { status: { not: UserStatus.SUSPENDED } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
  }

  async findOne(id: string): Promise<PublicUserRecord> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SELECT });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  create(dto: CreateUserDto): Promise<PublicUserRecord> {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role ?? Role.VIEWER,
        // An account created here has not signed in yet, so it starts INVITED
        // and flips to ACTIVE on the first successful OTP verification.
        status: dto.status ?? UserStatus.INVITED,
      },
      select: SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<PublicUserRecord> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('User not found.');

    if (dto.role && dto.role !== current.role && current.role === Role.ADMIN) {
      await this.assertNotLastAdmin(id, 'demote');
    }

    if (dto.status === UserStatus.SUSPENDED) {
      if (id === actorId) {
        throw new BadRequestException('You cannot suspend your own account.');
      }
      if (current.role === Role.ADMIN) await this.assertNotLastAdmin(id, 'suspend');
    }

    const user = await this.prisma.user.update({ where: { id }, data: dto, select: SELECT });

    // A suspended or demoted account must not keep working off an old session.
    if (dto.status === UserStatus.SUSPENDED || (dto.role && dto.role !== current.role)) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return user;
  }

  async remove(id: string, actorId: string): Promise<{ id: string }> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('User not found.');

    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    if (current.role === Role.ADMIN) await this.assertNotLastAdmin(id, 'delete');

    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  async getPermissions(id: string): Promise<UserPermission[]> {
    const exists = await this.prisma.user.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('User not found.');

    return this.prisma.userPermission.findMany({
      where: { userId: id },
      orderBy: { resource: 'asc' },
    });
  }

  /**
   * `level: null` removes the override, dropping that resource back to
   * whatever the user's base role already grants.
   */
  async setPermissions(id: string, dto: UpdateUserPermissionsDto): Promise<UserPermission[]> {
    const exists = await this.prisma.user.count({ where: { id } });
    if (exists === 0) throw new NotFoundException('User not found.');

    await this.prisma.$transaction(
      dto.grants.map((grant) =>
        grant.level === null
          ? this.prisma.userPermission.deleteMany({
              where: { userId: id, resource: grant.resource },
            })
          : this.prisma.userPermission.upsert({
              where: { userId_resource: { userId: id, resource: grant.resource } },
              create: { userId: id, resource: grant.resource, level: grant.level },
              update: { level: grant.level },
            }),
      ),
    );

    return this.getPermissions(id);
  }

  async auditLogs(query: AuditLogQueryDto): Promise<Paginated<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.search
        ? {
            OR: [
              { actorEmail: { contains: query.search, mode: 'insensitive' } },
              { resource: { contains: query.search, mode: 'insensitive' } },
              { action: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: resolveOrderBy(query, AUDIT_SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  /**
   * Locking every administrator out of the workspace is unrecoverable through
   * the UI, so the last one standing cannot be removed.
   */
  private async assertNotLastAdmin(id: string, action: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE, id: { not: id } },
    });

    if (remaining === 0) {
      throw new BadRequestException(
        `You cannot ${action} the last active administrator — promote another user first.`,
      );
    }
  }
}
