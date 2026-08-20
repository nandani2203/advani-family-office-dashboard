import { Prisma } from '@prisma/client';

/**
 * Converts a Prisma result into something JSON can represent faithfully.
 *
 * Prisma returns `Decimal` objects, which `JSON.stringify` renders as
 * `{"s":1,"e":6,"d":[...]}` — unusable to a frontend and unreadable in an audit
 * row. Amounts here top out in the billions, well inside the safe-integer range
 * once scaled to cents, so a plain number is lossless for this domain.
 *
 * Shared by the response interceptor and the audit interceptor so both write the
 * same shape, regardless of the order the two happen to run in.
 */
export function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber();
  }

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map((item) => toPlainValue(item));

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;

    // Leave class instances such as Buffer or Stream alone.
    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null) return value;

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      result[key] = toPlainValue(item);
    }
    return result;
  }

  return value;
}
