import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { jwtVerify } from 'jose';
import { loadApiConfig } from '../config.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { PUBLIC_ROUTE } from './public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly secret = new TextEncoder().encode(loadApiConfig().AUTH_JWT_SECRET);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    try {
      const { payload } = await jwtVerify(authorization.slice(7), this.secret, {
        issuer: 'kofa-api',
        audience: 'kofa-client',
        algorithms: ['HS256'],
      });
      if (!payload.sub || !payload.exp || !payload.jti) throw new Error('Claims missing');
      (request as AuthenticatedRequest).principal = {
        subject: payload.sub,
        sessionId: payload.jti,
        tokenExpiresAt: new Date(payload.exp * 1000),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}
