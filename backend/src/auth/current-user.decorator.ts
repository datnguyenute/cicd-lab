import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest, AuthUser } from './firebase-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user!,
);
