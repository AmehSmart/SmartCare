import { Body, Controller, Get, Post } from '@nestjs/common';
import { DutyContextSelectionSchema } from '@kofa/contracts';
import { AuditClient } from '../audit/audit.client.js';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ContextService } from './context.service.js';

@Controller('v1/session')
export class ContextController {
  constructor(
    private readonly context: ContextService,
    private readonly audit: AuditClient,
  ) {}

  @Get('assignments')
  assignments(@Principal() principal: RequestPrincipal): Promise<unknown[]> {
    return this.context.assignments(principal);
  }

  @Post('context')
  async select(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(DutyContextSelectionSchema)) body: { assignmentId: string },
  ): Promise<unknown> {
    const selected = await this.context.select(principal, body.assignmentId);
    const actor = await this.context.actor(principal);
    await this.audit.append({
      occurredAt: new Date().toISOString(),
      actorId: actor.userId,
      actorRole: actor.role ?? 'PATIENT',
      ...(actor.facilityId ? { facilityId: actor.facilityId } : {}),
      action: 'SELECT_DUTY_CONTEXT',
      decision: 'GRANT',
      purposeOfUse: 'OPERATIONS',
      context: { assignmentId: body.assignmentId },
      idempotencyKey: `context:${principal.sessionId}:${body.assignmentId}`,
    });
    return selected;
  }
}
