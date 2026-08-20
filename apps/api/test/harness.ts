import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { configureApp } from '../src/setup';

export interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  /** `harness.http().get('/api/...')` — the global prefix is already applied. */
  http: () => ReturnType<typeof request>;
  signIn: (email: string, role?: Role) => Promise<Session>;
  close: () => Promise<void>;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: Role };
  /** Authorization header, ready to spread into `.set(...)`. */
  auth: { Authorization: string };
}

export async function createHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const http = () => request(app.getHttpServer());

  /**
   * Signs in through the real OTP flow, then forces the role if the test needs
   * one that open signup would not hand out. The token is minted after the role
   * change so its claim matches the database.
   */
  const signIn = async (email: string, role?: Role): Promise<Session> => {
    const challenge = await http().post('/api/auth/request-otp').send({ email }).expect(200);
    const code = challenge.body.devCode as string;

    let session = await http()
      .post('/api/auth/verify-otp')
      .send({ email, code })
      .expect(200);

    if (role && session.body.user.role !== role) {
      await prisma.user.update({
        where: { id: session.body.user.id },
        data: { role, status: UserStatus.ACTIVE },
      });

      const nextChallenge = await http().post('/api/auth/request-otp').send({ email }).expect(200);
      session = await http()
        .post('/api/auth/verify-otp')
        .send({ email, code: nextChallenge.body.devCode })
        .expect(200);
    }

    return {
      accessToken: session.body.accessToken,
      refreshToken: session.body.refreshToken,
      user: session.body.user,
      auth: { Authorization: `Bearer ${session.body.accessToken}` },
    };
  };

  return {
    app,
    prisma,
    http,
    signIn,
    close: async () => {
      await app.close();
    },
  };
}

/** Removes every trace of the accounts a spec created. */
export async function purgeUsers(prisma: PrismaService, emails: string[]): Promise<void> {
  await prisma.otpCode.deleteMany({ where: { email: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

export const body = (response: Response): Record<string, unknown> =>
  response.body as Record<string, unknown>;
