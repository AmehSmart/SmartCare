import { Injectable } from '@nestjs/common';
import { decidePolicy, type AccessAction, type PolicyDecision } from '@kofa/core';
import { ClinicalDatabase } from '../database.service.js';
import { ContextService, type ActiveActor } from '../context/context.service.js';

@Injectable()
export class PolicyService {
  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
  ) {}

  async decide(
    actor: ActiveActor,
    patientId: string,
    action: AccessAction,
    emergencyAuthorized = false,
  ): Promise<PolicyDecision> {
    const patient = await this.context.requirePatient(patientId);
    const now = new Date();
    const [caseAttachment, caregiver, orderLink] = await Promise.all([
      this.database.caseAttachment.findFirst({
        where: {
          userId: actor.userId,
          patientId,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: { id: true },
      }),
      this.context.isCaregiver(actor.userId, patientId),
      this.database.orderLink.findFirst({
        where: {
          assigneeUserId: actor.userId,
          patientId,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { id: true },
      }),
    ]);
    return decidePolicy({
      role: actor.role ?? (caregiver ? 'CAREGIVER' : 'PATIENT'),
      action,
      sameFacility: Boolean(actor.facilityId && actor.facilityId === patient.facilityId),
      assignmentActive: actor.assignmentActive,
      sameWard: Boolean(actor.wardId && actor.wardId === patient.currentWardId),
      attachedToCase: Boolean(caseAttachment),
      orderLinked: Boolean(orderLink),
      isSelf: actor.patientId === patientId,
      isDependent: caregiver,
      emergencyAuthorized,
    });
  }
}
