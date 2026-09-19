import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BreakGlassRequestSchema } from '@kofa/contracts';
import type { z } from 'zod';
import { AuditClient } from '../audit/audit.client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ClinicalService } from '../clinical/clinical.service.js';
import { ContextService } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';
import { PolicyService } from '../policy/policy.service.js';
import { TotpService } from '../security/totp.service.js';
import { NotificationService } from '../notifications/notification.service.js';

type BreakGlassRequest = z.infer<typeof BreakGlassRequestSchema>;

@Injectable()
export class EmergencyService {
  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
    private readonly policy: PolicyService,
    private readonly totp: TotpService,
    private readonly audit: AuditClient,
    private readonly clinical: ClinicalService,
    private readonly notifications: NotificationService,
  ) {}

  async breakGlass(
    principal: RequestPrincipal,
    patientId: string,
    input: BreakGlassRequest,
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['DOCTOR', 'NURSE']);
    const patient = await this.context.requirePatient(patientId);
    if (!actor.facilityId || actor.facilityId !== patient.facilityId) {
      throw new ForbiddenException(
        'Break-glass is limited to patients registered at the active facility',
      );
    }
    await this.totp.verify(actor.userId, input.totp);
    const decision = await this.policy.decide(actor, patientId, 'READ_EMERGENCY_SUMMARY', true);
    if (!decision.allowed)
      throw new ForbiddenException('Emergency access is not permitted for this duty context');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // This awaited append is deliberately before both session creation and clinical data loading.
    const receipt = await this.audit.append(
      this.clinical.auditInput(
        actor,
        actor.role!,
        'BREAK_GLASS',
        'EMERGENCY',
        patientId,
        { projection: 'emergency-summary', expiresAt: expiresAt.toISOString() },
        input.idempotencyKey,
        {
          purposeOfUse: 'BTG',
          reasonCode: input.reasonCode,
          ...(input.reasonText ? { reasonText: input.reasonText } : {}),
        },
      ),
    );
    const session = await this.database.emergencySession.create({
      data: {
        userId: actor.userId,
        patientId,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        auditEventId: receipt.id,
        expiresAt,
      },
    });
    await this.notifications.notifyPatient(
      patientId,
      'BREAK_GLASS_ACCESS',
      'Emergency access used',
      {
        actorRole: actor.role!,
        occurredAt: new Date().toISOString(),
        reasonCode: input.reasonCode,
      },
    );
    const summary = await this.clinical.emergencySummary(patientId, expiresAt);
    return {
      emergencySessionId: session.id,
      summary,
      banner: {
        actorId: actor.userId,
        reasonCode: input.reasonCode,
        ...(input.reasonText ? { reasonText: input.reasonText } : {}),
        expiresAt: expiresAt.toISOString(),
        auditReceipt: receipt,
      },
    };
  }

  async end(principal: RequestPrincipal, sessionId: string): Promise<void> {
    const actor = await this.context.actor(principal);
    const session = await this.database.emergencySession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== actor.userId)
      throw new NotFoundException('Emergency session not found');
    if (!session.endedAt)
      await this.database.emergencySession.update({
        where: { id: sessionId },
        data: { endedAt: new Date() },
      });
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        this.clinical.actorRole(actor),
        'END_BREAK_GLASS',
        'GRANT',
        session.patientId,
        { sessionId },
        `end-emergency:${sessionId}`,
      ),
    );
  }
}
