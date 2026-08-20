import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionLevel, PermissionResource, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/** A method with no more specific mapping needs at least WRITE. */
const METHOD_LEVEL: Record<string, PermissionLevel> = {
  DELETE: PermissionLevel.FULL,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      method: string;
    }>();
    const { user } = request;

    if (user && required.includes(user.role)) return true;

    // Fast path failed. Fall back to a per-resource grant, if this
    // controller declares one and the user actually has an override.
    const resource = this.reflector.getAllAndOverride<PermissionResource | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (user && resource) {
      const requiredLevel = METHOD_LEVEL[request.method] ?? PermissionLevel.WRITE;
      const grant = await this.prisma.userPermission.findUnique({
        where: { userId_resource: { userId: user.id, resource } },
      });

      if (grant && (grant.level === PermissionLevel.FULL || grant.level === requiredLevel)) {
        return true;
      }
    }

    throw new ForbiddenException(
      `This action requires one of the following roles: ${required.join(', ')}.`,
    );
  }
}
