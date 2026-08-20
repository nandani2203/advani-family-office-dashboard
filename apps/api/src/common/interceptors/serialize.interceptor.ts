import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { toPlainValue } from '../serialization';

/**
 * Normalises every response body: Prisma `Decimal` becomes a number and `Date`
 * becomes an ISO string, so the frontend can do arithmetic and formatting
 * without a decimal library. See `common/serialization.ts` for why.
 */
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toPlainValue(data)));
  }
}
