import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: string;
  resource: string;
}

/** Record this mutation in the audit log. Read by AuditInterceptor. */
export const Audit = (action: string, resource: string) =>
  SetMetadata(AUDIT_KEY, { action, resource } satisfies AuditMetadata);
