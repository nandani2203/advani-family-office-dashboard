import { SetMetadata } from '@nestjs/common';
import { PermissionResource } from '@prisma/client';

export const PERMISSION_KEY = 'permission';

/**
 * Marks a controller's resource for the fine-grained grant fallback. Placed at
 * the class level so every route in that controller is covered uniformly.
 * Consulted by RolesGuard only when the base @Roles(...) check fails.
 */
export const Permission = (resource: PermissionResource) =>
  SetMetadata(PERMISSION_KEY, resource);
