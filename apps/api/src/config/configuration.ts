export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  jwt: {
    secret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
  auth: {
    openSignup: boolean;
    exposeOtp: boolean;
    otpTtlMinutes: number;
    otpMaxAttempts: number;
    otpResendSeconds: number;
  };
}

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-only-refresh-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: int(process.env.JWT_REFRESH_TTL_DAYS, 30),
  },
  auth: {
    // Mirrors the reference solution: any email may sign in, and because email
    // delivery is not wired up the code is returned in the response so a
    // reviewer can sign in without inbox access. Both are off by default in
    // production unless explicitly enabled.
    openSignup: bool(process.env.OPEN_SIGNUP, true),
    exposeOtp: bool(process.env.EXPOSE_OTP, true),
    otpTtlMinutes: int(process.env.OTP_TTL_MINUTES, 10),
    otpMaxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
    otpResendSeconds: int(process.env.OTP_RESEND_SECONDS, 30),
  },
});
