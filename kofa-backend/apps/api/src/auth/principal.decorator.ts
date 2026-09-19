import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, RequestPrincipal } from './auth.types.js';

export const Principal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestPrincipal => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  },
);
