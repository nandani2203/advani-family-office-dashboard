import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';

const AUTH_CONFIG = {
  openSignup: true,
  exposeOtp: true,
  otpTtlMinutes: 10,
  otpMaxAttempts: 5,
  otpResendSeconds: 30,
};

const JWT_CONFIG = {
  secret: 'a'.repeat(40),
  refreshSecret: 'b'.repeat(40),
  accessTtl: '15m',
  refreshTtlDays: 30,
};

const ACTIVE_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ops@advanifamilyoffice.com',
  name: 'Ops',
  role: Role.EDITOR,
  status: UserStatus.ACTIVE,
  lastLoginAt: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; count: jest.Mock };
    otpCode: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(ACTIVE_USER),
        create: jest.fn().mockResolvedValue(ACTIVE_USER),
        update: jest.fn().mockResolvedValue(ACTIVE_USER),
        count: jest.fn().mockResolvedValue(3),
      },
      otpCode: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const config = {
      getOrThrow: jest.fn((key: string) => (key === 'auth' ? AUTH_CONFIG : JWT_CONFIG)),
      get: jest.fn((key: string) => (key === 'auth' ? AUTH_CONFIG : JWT_CONFIG)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma as unknown as PrismaService },
        { provide: ConfigService, useValue: config },
        { provide: JwtService, useValue: new JwtService({}) },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('requestOtp', () => {
    it('stores only a hash of the code, never the code itself', async () => {
      const challenge = await service.requestOtp(ACTIVE_USER.email);

      const { data } = prisma.otpCode.create.mock.calls[0][0];
      expect(data.codeHash).not.toBe(challenge.devCode);
      expect(data.codeHash).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(challenge.devCode as string, data.codeHash)).resolves.toBe(true);
    });

    it('issues a six-digit code and returns it while EXPOSE_OTP is on', async () => {
      const challenge = await service.requestOtp(ACTIVE_USER.email);

      expect(challenge.devCode).toMatch(/^\d{6}$/);
      expect(challenge.message).toContain(challenge.devCode as string);
      expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('invalidates any outstanding code so only the newest one works', async () => {
      await service.requestOtp(ACTIVE_USER.email);

      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: ACTIVE_USER.email, consumedAt: null },
          data: { consumedAt: expect.any(Date) },
        }),
      );
    });

    it('throttles a resend that arrives inside the cooldown window', async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: 'otp-1',
        createdAt: new Date(Date.now() - 5_000),
      });

      await expect(service.requestOtp(ACTIVE_USER.email)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });

    it('allows a resend once the cooldown has elapsed', async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: 'otp-1',
        createdAt: new Date(Date.now() - 60_000),
      });

      await expect(service.requestOtp(ACTIVE_USER.email)).resolves.toBeDefined();
    });

    it('refuses a suspended account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...ACTIVE_USER,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.requestOtp(ACTIVE_USER.email)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('verifyOtp', () => {
    const withStoredCode = async (code: string, overrides: Record<string, unknown> = {}) => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: 'otp-1',
        email: ACTIVE_USER.email,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
        ...overrides,
      });
    };

    it('returns a token pair and the user on the right code', async () => {
      await withStoredCode('123456');

      const session = await service.verifyOtp(ACTIVE_USER.email, '123456');

      expect(session.accessToken).toBeTruthy();
      expect(session.refreshToken).toBeTruthy();
      expect(session.user.email).toBe(ACTIVE_USER.email);
    });

    it('burns the code so it cannot be replayed', async () => {
      await withStoredCode('123456');

      await service.verifyOtp(ACTIVE_USER.email, '123456');

      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('counts a wrong code as an attempt without consuming it', async () => {
      await withStoredCode('123456');

      await expect(service.verifyOtp(ACTIVE_USER.email, '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('burns the code once the attempt cap is reached', async () => {
      await withStoredCode('123456', { attempts: AUTH_CONFIG.otpMaxAttempts });

      await expect(service.verifyOtp(ACTIVE_USER.email, '123456')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('rejects a code when there is no live challenge', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp(ACTIVE_USER.email, '123456')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('makes the very first account to sign in an administrator', async () => {
      await withStoredCode('123456');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);

      await service.verifyOtp('founder@advanifamilyoffice.com', '123456');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.ADMIN }),
        }),
      );
    });

    it('creates later open-signup accounts as editors', async () => {
      await withStoredCode('123456');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(4);

      await service.verifyOtp('newcomer@advanifamilyoffice.com', '123456');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.EDITOR }),
        }),
      );
    });

    it('stores a hash of the refresh token, not the token', async () => {
      await withStoredCode('123456');

      const session = await service.verifyOtp(ACTIVE_USER.email, '123456');
      const { data } = prisma.refreshToken.create.mock.calls[0][0];

      expect(data.tokenHash).not.toBe(session.refreshToken);
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('refresh', () => {
    const issueRefreshToken = async (): Promise<string> => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: 'otp-1',
        email: ACTIVE_USER.email,
        codeHash: await bcrypt.hash('123456', 10),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
      });
      const session = await service.verifyOtp(ACTIVE_USER.email, '123456');
      return session.refreshToken;
    };

    it('rotates the presented token and issues a new pair', async () => {
      const refreshToken = await issueRefreshToken();
      const { data } = prisma.refreshToken.create.mock.calls[0][0];

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: ACTIVE_USER.id,
        tokenHash: data.tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
        user: ACTIVE_USER,
      });

      const session = await service.refresh(refreshToken);

      expect(session.accessToken).toBeTruthy();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('kills every session when an already-rotated token comes back', async () => {
      const refreshToken = await issueRefreshToken();

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: ACTIVE_USER.id,
        tokenHash: 'whatever',
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(Date.now() - 1_000),
        user: ACTIVE_USER,
      });

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: ACTIVE_USER.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects a token that was never issued here', async () => {
      const refreshToken = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a garbage token before touching the database', async () => {
      await expect(service.refresh('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an expired stored token', async () => {
      const refreshToken = await issueRefreshToken();

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: ACTIVE_USER.id,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1_000),
        revokedAt: null,
        user: ACTIVE_USER,
      });

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the presented session', async () => {
      await service.logout('some-token', ACTIVE_USER.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
        }),
      );
    });

    it('revokes every session for the user when no token is presented', async () => {
      await service.logout(undefined, ACTIVE_USER.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: ACTIVE_USER.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
