import { Logger } from '@nestjs/common';

const logger = new Logger('Env');

/**
 * Fail fast on missing configuration rather than surfacing it as a confusing
 * runtime error on the first database call.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }

  const isProd = config.NODE_ENV === 'production';
  const weakSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (key) => !config[key] || String(config[key]).length < 32,
  );

  if (weakSecrets.length > 0) {
    const message = `${weakSecrets.join(', ')} should be set to at least 32 characters.`;
    if (isProd) throw new Error(message);
    logger.warn(`${message} Using development defaults.`);
  }

  return config;
}
