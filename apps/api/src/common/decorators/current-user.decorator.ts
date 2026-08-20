import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  name: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
