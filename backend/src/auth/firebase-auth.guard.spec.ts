import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';

function contextWith(headers: Record<string, string>) {
  const req: Record<string, unknown> = { headers };
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('FirebaseAuthGuard', () => {
  const guard = new FirebaseAuthGuard();
  afterEach(() => delete process.env.AUTH_DISABLED);

  it('rejects requests without bearer token', async () => {
    const { ctx } = contextWith({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('injects a fake user when AUTH_DISABLED=true', async () => {
    process.env.AUTH_DISABLED = 'true';
    const { ctx, req } = contextWith({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ uid: 'local-dev-user', email: 'dev@local' });
  });
});
