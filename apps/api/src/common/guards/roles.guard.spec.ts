import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionLevel, PermissionResource, Role } from '@prisma/client';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { RolesGuard } from './roles.guard';

/**
 * The RBAC contract, asserted directly against the guard: VIEWER reads but never
 * writes, EDITOR writes business data but never touches user administration,
 * ADMIN does everything — and a per-resource grant can narrowly widen a role's
 * access, but only where the controller opted in via @Permission(...).
 */
describe('RolesGuard', () => {
  const contextFor = (user: AuthenticatedUser | undefined, method = 'POST'): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user, method }) }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  const userWith = (role: Role): AuthenticatedUser => ({
    id: '11111111-1111-4111-8111-111111111111',
    email: `${role.toLowerCase()}@advanifamilyoffice.com`,
    role,
    name: role,
  });

  const guardFor = (
    required: Role[] | undefined,
    options: {
      resource?: PermissionResource;
      grant?: { resource: PermissionResource; level: PermissionLevel } | null;
    } = {},
  ): RolesGuard => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ROLES_KEY ? required : options.resource,
      ),
    };
    // Mirrors Prisma's real composite-key semantics: a lookup for one resource
    // can never return a grant row stored under a different resource.
    const prisma = {
      userPermission: {
        findUnique: jest.fn(
          ({ where }: { where: { userId_resource: { resource: PermissionResource } } }) => {
            const grant = options.grant;
            return Promise.resolve(
              grant && grant.resource === where.userId_resource.resource ? grant : null,
            );
          },
        ),
      },
    };
    return new RolesGuard(
      reflector as unknown as Reflector,
      prisma as unknown as import('../prisma/prisma.service').PrismaService,
    );
  };

  it('lets any authenticated role through an endpoint with no @Roles metadata', async () => {
    const guard = guardFor(undefined);

    for (const role of [Role.VIEWER, Role.EDITOR, Role.ADMIN]) {
      await expect(guard.canActivate(contextFor(userWith(role)))).resolves.toBe(true);
    }
  });

  describe('write endpoints (@Roles(ADMIN, EDITOR))', () => {
    const required = [Role.ADMIN, Role.EDITOR];

    it('rejects a VIEWER', async () => {
      await expect(guardFor(required).canActivate(contextFor(userWith(Role.VIEWER)))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('admits an EDITOR', async () => {
      await expect(guardFor(required).canActivate(contextFor(userWith(Role.EDITOR)))).resolves.toBe(
        true,
      );
    });

    it('admits an ADMIN', async () => {
      await expect(guardFor(required).canActivate(contextFor(userWith(Role.ADMIN)))).resolves.toBe(
        true,
      );
    });
  });

  describe('administrative endpoints (@Roles(ADMIN))', () => {
    const required = [Role.ADMIN];

    it.each([Role.VIEWER, Role.EDITOR])('rejects a %s', async (role) => {
      await expect(guardFor(required).canActivate(contextFor(userWith(role)))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('admits an ADMIN', async () => {
      await expect(guardFor(required).canActivate(contextFor(userWith(Role.ADMIN)))).resolves.toBe(
        true,
      );
    });

    it('a FULL grant does not bypass it — user administration is never delegable', async () => {
      const guard = guardFor(required, {
        // No @Permission(...) metadata on this endpoint at all — resource stays
        // undefined, so the grant fallback never triggers regardless of level.
        resource: undefined,
        grant: { resource: PermissionResource.INVESTMENTS, level: PermissionLevel.FULL },
      });

      await expect(guard.canActivate(contextFor(userWith(Role.VIEWER)))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('per-resource permission grants', () => {
    const writeRequired = [Role.ADMIN, Role.EDITOR];
    const deleteRequired = [Role.ADMIN];

    it('a WRITE grant lets a VIEWER through a write endpoint for that resource', async () => {
      const guard = guardFor(writeRequired, {
        resource: PermissionResource.INVESTMENTS,
        grant: { resource: PermissionResource.INVESTMENTS, level: PermissionLevel.WRITE },
      });

      await expect(
        guard.canActivate(contextFor(userWith(Role.VIEWER), 'PATCH')),
      ).resolves.toBe(true);
    });

    it('a WRITE grant is not enough for a delete endpoint (needs FULL)', async () => {
      const guard = guardFor(deleteRequired, {
        resource: PermissionResource.INVESTMENTS,
        grant: { resource: PermissionResource.INVESTMENTS, level: PermissionLevel.WRITE },
      });

      await expect(
        guard.canActivate(contextFor(userWith(Role.VIEWER), 'DELETE')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('a FULL grant covers both write and delete endpoints', async () => {
      const grant = { resource: PermissionResource.INVESTMENTS, level: PermissionLevel.FULL };

      const writeGuard = guardFor(writeRequired, { resource: PermissionResource.INVESTMENTS, grant });
      await expect(
        writeGuard.canActivate(contextFor(userWith(Role.VIEWER), 'PATCH')),
      ).resolves.toBe(true);

      const deleteGuard = guardFor(deleteRequired, { resource: PermissionResource.INVESTMENTS, grant });
      await expect(
        deleteGuard.canActivate(contextFor(userWith(Role.VIEWER), 'DELETE')),
      ).resolves.toBe(true);
    });

    it('no grant at all still rejects, same as before this feature existed', async () => {
      const guard = guardFor(writeRequired, {
        resource: PermissionResource.INVESTMENTS,
        grant: null,
      });

      await expect(
        guard.canActivate(contextFor(userWith(Role.VIEWER), 'PATCH')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('a grant on a different resource does not leak across resources', async () => {
      const guard = guardFor(writeRequired, {
        resource: PermissionResource.INVESTMENTS,
        grant: { resource: PermissionResource.ASSETS, level: PermissionLevel.FULL },
      });

      await expect(
        guard.canActivate(contextFor(userWith(Role.VIEWER), 'PATCH')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('names the roles that would have worked, so the client can explain itself', async () => {
    await expect(
      guardFor([Role.ADMIN]).canActivate(contextFor(userWith(Role.VIEWER))),
    ).rejects.toThrow(/ADMIN/);
  });

  it('rejects a request with no user attached, even if a role is required', async () => {
    await expect(guardFor([Role.VIEWER]).canActivate(contextFor(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
