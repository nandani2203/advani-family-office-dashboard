import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { toPlainValue } from '../serialization';

/**
 * Writes an audit row for any handler decorated with `@Audit(...)`. Logging is
 * best-effort: an audit failure must never fail the request the user made.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditMetadata | undefined>(AUDIT_KEY, context.getHandler());

    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    const ip = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? request.ip;

    return next.handle().pipe(
      tap((result) => {
        const record = result as { id?: string } | null;
        void this.prisma.auditLog
          .create({
            data: {
              actorId: user?.id ?? null,
              actorEmail: user?.email ?? null,
              action: metadata.action,
              resource: metadata.resource,
              resourceId: record?.id ?? (request.params?.id as string | undefined) ?? null,
              // Decimals would otherwise land in the audit row as
              // {"s":1,"e":7,"d":[...]}, which nobody can read.
              after: result ? (toPlainValue(result) as Prisma.InputJsonValue) : undefined,
              ip: ip ?? null,
            },
          })
          .catch((error: unknown) => {
            this.logger.warn(`Failed to write audit log: ${String(error)}`);
          });
      }),
    );
  }
}
