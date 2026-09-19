import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ContextService } from '../context/context.service.js';
import { AuditClient } from './audit.client.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';

@Controller('v1/audit')
export class AuditProxyController {
  constructor(
    private readonly context: ContextService,
    private readonly audit: AuditClient,
  ) {}

  @Get('events')
  async events(
    @Principal() principal: RequestPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['AUDIT_OFFICER']);
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (cursor) params.set('cursor', cursor);
    return this.audit.listEvents(`?${params.toString()}`, actor.facilityId!);
  }

  @Get('flags')
  async flags(@Principal() principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['AUDIT_OFFICER']);
    return this.audit.listFlags(actor.facilityId!);
  }

  @Post('verify')
  async verify(@Principal() principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['AUDIT_OFFICER']);
    return this.audit.verify(actor.userId);
  }

  @Get('checkpoints/latest')
  async checkpoint(@Principal() principal: RequestPrincipal): Promise<unknown> {
    await this.context.requireRole(principal, ['AUDIT_OFFICER']);
    return this.audit.latestCheckpoint();
  }

  @Patch('flags/:id')
  async review(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['AUDIT_OFFICER']);
    const input = z
      .object({
        status: z.enum(['REVIEWED', 'DISMISSED', 'ESCALATED']),
        disposition: z.string().max(1000).optional(),
      })
      .safeParse(body);
    if (!input.success) throw new BadRequestException('Invalid flag review');
    return this.audit.reviewFlag(id, actor.facilityId!, actor.userId, input.data);
  }
}
