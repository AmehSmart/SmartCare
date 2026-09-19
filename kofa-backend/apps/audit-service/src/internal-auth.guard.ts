import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { loadAuditConfig } from './config.js';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly expected = Buffer.from(loadAuditConfig().AUDIT_SERVICE_TOKEN);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const value = request.headers.authorization;
    if (!value?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing service credential');
    const actual = Buffer.from(value.slice(7));
    if (actual.byteLength !== this.expected.byteLength || !timingSafeEqual(actual, this.expected)) {
      throw new UnauthorizedException('Invalid service credential');
    }
    return true;
  }
}
