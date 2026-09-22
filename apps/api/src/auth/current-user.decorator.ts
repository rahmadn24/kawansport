import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestUser;
  },
);
