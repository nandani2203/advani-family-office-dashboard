import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads `.env.test` then `.env` without pulling in a dependency Jest would need
 * on the runner. Values already in the environment win, so CI can override
 * anything a local file happens to set.
 */
function loadEnvFile(name: string): void {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;

    // Strip one layer of matching quotes, which .env files conventionally use.
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/s, '$2');

    process.env[key] = value;
  }
}

/**
 * The e2e suite talks to a real Postgres — that is the point of it. Fail here
 * with an actionable message rather than letting every spec time out on a
 * connection error.
 */
export default function globalSetup(): void {
  loadEnvFile('.env.test');
  loadEnvFile('.env');

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'The e2e suite needs a Postgres database.\n' +
        '  1. Set DATABASE_URL (a scratch database — the suite writes to it).\n' +
        '  2. Apply the schema:  npx prisma migrate deploy\n' +
        '  3. Re-run:            npm run test:e2e',
    );
  }

  // Demo-mode auth is what the suite exercises: any email may sign in and the
  // OTP comes back in the response, so no mailbox is involved. The resend
  // cooldown is disabled because the suite signs in repeatedly.
  process.env.OPEN_SIGNUP = 'true';
  process.env.EXPOSE_OTP = 'true';
  process.env.OTP_RESEND_SECONDS = '0';
  process.env.JWT_SECRET ??= 'e2e-access-secret-that-is-long-enough-to-pass';
  process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-that-is-long-enough-too';
  process.env.NODE_ENV = 'test';
}
