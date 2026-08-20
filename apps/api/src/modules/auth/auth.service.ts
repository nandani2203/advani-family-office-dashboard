import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/configuration';

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  lastLoginAt: Date | null;
}

export interface OtpChallenge {
  email: string;
  expiresAt: Date;
  resendInSeconds: number;
  /** Only populated when EXPOSE_OTP is on — the demo has no email delivery. */
  devCode?: string;
  message?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get authConfig(): AppConfig['auth'] {
    return this.config.getOrThrow<AppConfig['auth']>('auth');
  }

  private get jwtConfig(): AppConfig['jwt'] {
    return this.config.getOrThrow<AppConfig['jwt']>('jwt');
  }

  getPublicConfig(): { openSignup: boolean } {
    return { openSignup: this.authConfig.openSignup };
  }

  // ------------------------------------------------------------------- step 1

  async requestOtp(email: string): Promise<OtpChallenge> {
    const { openSignup, otpTtlMinutes, otpResendSeconds, exposeOtp } = this.authConfig;

    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (!existing && !openSignup) {
      // Do not leak whether the address is registered.
      throw new BadRequestException('If that address is registered, a code has been sent.');
    }

    if (existing?.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('This account has been suspended.');
    }

    // Throttle resends per address, independent of the global rate limiter.
    const recent = await this.prisma.otpCode.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (elapsed < otpResendSeconds) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(otpResendSeconds - elapsed)}s before requesting another code.`,
        );
      }
    }

    // Invalidate outstanding codes so only the newest one works.
    await this.prisma.otpCode.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + otpTtlMinutes * 60_000);

    await this.prisma.otpCode.create({
      data: { email, codeHash: await bcrypt.hash(code, 10), expiresAt },
    });

    if (!exposeOtp) {
      // Where a provider is configured this is the hand-off point.
      this.logger.log(`OTP issued for ${email} (delivery not configured)`);
    }

    return {
      email,
      expiresAt,
      resendInSeconds: otpResendSeconds,
      ...(exposeOtp
        ? {
            devCode: code,
            message:
              'Email is disabled on this test dashboard, so your code is shown here: ' +
              `${code} — already filled in below, just click Verify.`,
          }
        : {}),
    };
  }

  // ------------------------------------------------------------------- step 2

  async verifyOtp(email: string, code: string): Promise<SessionResponse> {
    const { otpMaxAttempts, openSignup } = this.authConfig;

    const challenge = await this.prisma.otpCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException('That code has expired. Request a new one.');
    }

    if (challenge.attempts >= otpMaxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new UnauthorizedException('Too many incorrect attempts. Request a new code.');
    }

    if (!(await bcrypt.compare(code, challenge.codeHash))) {
      await this.prisma.otpCode.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('That code is not correct.');
    }

    await this.prisma.otpCode.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (!openSignup) throw new UnauthorizedException('This account does not exist.');
      user = await this.createUserOnFirstSignIn(email);
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('This account has been suspended.');
    }

    user = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), status: UserStatus.ACTIVE },
    });

    return this.issueSession(user);
  }

  /**
   * The very first account to sign in owns the workspace, so it becomes ADMIN.
   * Everyone after that starts as EDITOR under open signup.
   */
  private async createUserOnFirstSignIn(email: string): Promise<User> {
    const userCount = await this.prisma.user.count();
    return this.prisma.user.create({
      data: {
        email,
        name: this.nameFromEmail(email),
        role: userCount === 0 ? Role.ADMIN : Role.EDITOR,
      },
    });
  }

  private nameFromEmail(email: string): string {
    return email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  // ------------------------------------------------------------------ sessions

  private async issueSession(user: User): Promise<SessionResponse> {
    const { secret, accessTtl, refreshSecret, refreshTtlDays } = this.jwtConfig;

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      { secret, expiresIn: accessTtl },
    );

    // High-entropy jti keeps the stored hash unguessable even if the signing
    // secret ever leaks.
    const jti = randomBytes(32).toString('hex');
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti },
      { secret: refreshSecret, expiresIn: `${refreshTtlDays}d` },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlDays * 86_400_000),
      },
    });

    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  async refresh(refreshToken: string): Promise<SessionResponse> {
    const { refreshSecret } = this.jwtConfig;

    try {
      await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    // A token that was already rotated coming back means it leaked. Drop every
    // session for that user rather than trusting either party.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    if (stored.user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('This account has been suspended.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(stored.user);
  }

  async logout(refreshToken?: string, userId?: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('This account no longer exists.');
    return this.toPublicUser(user);
  }

  /** Refresh tokens are already high-entropy, so a fast digest is enough. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
