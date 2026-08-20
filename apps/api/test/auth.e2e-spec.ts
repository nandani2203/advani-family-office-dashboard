import { Role } from '@prisma/client';
import { Harness, createHarness, purgeUsers } from './harness';

/**
 * The full sign-in journey against a real database: request a code, exchange it
 * for a session, use the session, rotate it, and prove that RBAC actually stops
 * a VIEWER from writing.
 */
describe('Auth (e2e)', () => {
  let harness: Harness;

  const EMAILS = {
    editor: 'e2e-editor@advanifamilyoffice.com',
    viewer: 'e2e-viewer@advanifamilyoffice.com',
    admin: 'e2e-admin@advanifamilyoffice.com',
    fresh: 'e2e-fresh@advanifamilyoffice.com',
  };

  beforeAll(async () => {
    harness = await createHarness();
    await purgeUsers(harness.prisma, Object.values(EMAILS));
  });

  afterAll(async () => {
    await purgeUsers(harness.prisma, Object.values(EMAILS));
    await harness.close();
  });

  describe('unauthenticated surface', () => {
    it('reports health without a token', async () => {
      const response = await harness.http().get('/api/health').expect(200);

      expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
      expect(typeof response.body.uptime).toBe('number');
    });

    it('advertises open signup so the login screen can adapt', async () => {
      const response = await harness.http().get('/api/auth/config').expect(200);

      expect(response.body).toEqual({ openSignup: true });
    });

    it('refuses a protected route with no token', async () => {
      const response = await harness.http().get('/api/dashboard/summary').expect(401);

      expect(response.body).toMatchObject({ statusCode: 401, path: '/api/dashboard/summary' });
      expect(response.body.timestamp).toBeDefined();
    });

    it('refuses a protected route with a forged token', async () => {
      await harness
        .http()
        .get('/api/investments')
        .set({ Authorization: 'Bearer not.a.real.token' })
        .expect(401);
    });
  });

  describe('OTP issue and verify', () => {
    it('returns the code in the response while EXPOSE_OTP is on', async () => {
      const response = await harness
        .http()
        .post('/api/auth/request-otp')
        .send({ email: EMAILS.fresh })
        .expect(200);

      expect(response.body.devCode).toMatch(/^\d{6}$/);
      expect(response.body.email).toBe(EMAILS.fresh);
      expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects a badly formed email with a field-level message', async () => {
      const response = await harness
        .http()
        .post('/api/auth/request-otp')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(response.body.errors).toContain('Enter a valid email address.');
    });

    it('rejects unknown properties in the body', async () => {
      await harness
        .http()
        .post('/api/auth/request-otp')
        .send({ email: EMAILS.fresh, role: 'ADMIN' })
        .expect(400);
    });

    it('rejects a code that was never issued', async () => {
      await harness
        .http()
        .post('/api/auth/verify-otp')
        .send({ email: 'e2e-nobody@advanifamilyoffice.com', code: '000000' })
        .expect(401);
    });

    it('rejects a wrong code, then accepts the right one', async () => {
      const challenge = await harness
        .http()
        .post('/api/auth/request-otp')
        .send({ email: EMAILS.fresh })
        .expect(200);

      const wrong = challenge.body.devCode === '000000' ? '111111' : '000000';

      await harness
        .http()
        .post('/api/auth/verify-otp')
        .send({ email: EMAILS.fresh, code: wrong })
        .expect(401);

      const session = await harness
        .http()
        .post('/api/auth/verify-otp')
        .send({ email: EMAILS.fresh, code: challenge.body.devCode })
        .expect(200);

      expect(session.body.accessToken).toBeTruthy();
      expect(session.body.user.email).toBe(EMAILS.fresh);
    });

    it('will not accept the same code twice', async () => {
      const challenge = await harness
        .http()
        .post('/api/auth/request-otp')
        .send({ email: EMAILS.fresh })
        .expect(200);

      const code = challenge.body.devCode as string;

      await harness
        .http()
        .post('/api/auth/verify-otp')
        .send({ email: EMAILS.fresh, code })
        .expect(200);

      await harness
        .http()
        .post('/api/auth/verify-otp')
        .send({ email: EMAILS.fresh, code })
        .expect(401);
    });

    it('creates the account on first sign-in under open signup', async () => {
      const user = await harness.prisma.user.findUnique({ where: { email: EMAILS.fresh } });

      expect(user).not.toBeNull();
      expect(user?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('session', () => {
    it('returns the signed-in user from /auth/me', async () => {
      const session = await harness.signIn(EMAILS.editor, Role.EDITOR);

      const response = await harness.http().get('/api/auth/me').set(session.auth).expect(200);

      expect(response.body).toMatchObject({ email: EMAILS.editor, role: Role.EDITOR });
    });

    it('rotates a refresh token and invalidates the old one', async () => {
      const session = await harness.signIn(EMAILS.editor, Role.EDITOR);

      const rotated = await harness
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      expect(rotated.body.refreshToken).not.toBe(session.refreshToken);

      // Reuse of the rotated token is treated as a leak.
      await harness
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });

    it('drops every session for the user when reuse is detected', async () => {
      const session = await harness.signIn(EMAILS.editor, Role.EDITOR);

      const rotated = await harness
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      await harness
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      // The token issued by the legitimate rotation is gone too.
      await harness
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);
    });

    it('revokes the session on logout', async () => {
      const session = await harness.signIn(EMAILS.editor, Role.EDITOR);

      await harness
        .http()
        .post('/api/auth/logout')
        .set(session.auth)
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      await harness
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });
  });

  describe('RBAC', () => {
    const newAsset = {
      name: 'E2E Test Asset',
      type: 'PRIVATE_EQUITY',
      sector: 'Testing',
    };

    it('lets a VIEWER read', async () => {
      const viewer = await harness.signIn(EMAILS.viewer, Role.VIEWER);

      await harness.http().get('/api/investments').set(viewer.auth).expect(200);
      await harness.http().get('/api/dashboard/summary').set(viewer.auth).expect(200);
    });

    it('rejects a VIEWER on every kind of write', async () => {
      const viewer = await harness.signIn(EMAILS.viewer, Role.VIEWER);

      const post = await harness
        .http()
        .post('/api/assets')
        .set(viewer.auth)
        .send(newAsset)
        .expect(403);

      expect(post.body.message).toMatch(/requires one of the following roles/i);

      await harness
        .http()
        .patch('/api/assets/11111111-1111-4111-8111-111111111111')
        .set(viewer.auth)
        .send({ sector: 'Nope' })
        .expect(403);

      await harness
        .http()
        .delete('/api/assets/11111111-1111-4111-8111-111111111111')
        .set(viewer.auth)
        .expect(403);
    });

    it('lets an EDITOR write business data', async () => {
      const editor = await harness.signIn(EMAILS.editor, Role.EDITOR);

      const created = await harness
        .http()
        .post('/api/assets')
        .set(editor.auth)
        .send(newAsset)
        .expect(201);

      expect(created.body).toMatchObject({ name: newAsset.name, currency: 'USD' });

      // Deleting an asset is deliberately ADMIN-only.
      await harness
        .http()
        .delete(`/api/assets/${created.body.id}`)
        .set(editor.auth)
        .expect(403);

      const admin = await harness.signIn(EMAILS.admin, Role.ADMIN);
      await harness.http().delete(`/api/assets/${created.body.id}`).set(admin.auth).expect(200);
    });

    it('keeps user administration to ADMIN', async () => {
      const editor = await harness.signIn(EMAILS.editor, Role.EDITOR);
      const admin = await harness.signIn(EMAILS.admin, Role.ADMIN);

      // Reading the staff list is fine for any authenticated user…
      await harness.http().get('/api/users').set(editor.auth).expect(200);
      // …but changing roles and reading the audit log are not.
      await harness
        .http()
        .patch(`/api/users/${editor.user.id}/role`)
        .set(editor.auth)
        .send({ role: Role.ADMIN })
        .expect(403);
      await harness.http().get('/api/users/audit-logs').set(editor.auth).expect(403);

      await harness.http().get('/api/users/audit-logs').set(admin.auth).expect(200);
    });

    it('writes an audit row for a mutation', async () => {
      const editor = await harness.signIn(EMAILS.editor, Role.EDITOR);

      const created = await harness
        .http()
        .post('/api/assets')
        .set(editor.auth)
        .send({ ...newAsset, name: 'E2E Audited Asset' })
        .expect(201);

      // The interceptor writes without blocking the response, so give it a beat.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const log = await harness.prisma.auditLog.findFirst({
        where: { resource: 'asset', resourceId: created.body.id },
      });

      expect(log).toMatchObject({ action: 'create', actorEmail: EMAILS.editor });

      const admin = await harness.signIn(EMAILS.admin, Role.ADMIN);
      await harness.http().delete(`/api/assets/${created.body.id}`).set(admin.auth).expect(200);
      await harness.prisma.auditLog.deleteMany({ where: { resourceId: created.body.id } });
    });
  });
});
