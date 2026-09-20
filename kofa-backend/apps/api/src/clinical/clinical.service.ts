import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuditAppend, Role } from '@kofa/contracts';
import { AuditClient } from '../audit/audit.client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ContextService, type ActiveActor } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';
import { PolicyService } from '../policy/policy.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { buildEmergencySummary, projectResources } from './fhir.js';
import { resourcePatientReference, SupportedFhirResourceSchema } from './fhir.js';
import type { Prisma } from '../../../../generated/clinical/client.js';

@Injectable()
export class ClinicalService {
  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
    private readonly policy: PolicyService,
    private readonly audit: AuditClient,
    private readonly notifications: NotificationService,
  ) {}

  // Admit or transfer a patient to a ward and notify the ward's on-duty staff.
  async transferPatient(
    principal: RequestPrincipal,
    patientId: string,
    wardId: string,
    idempotencyKey: string,
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, [
      'DOCTOR',
      'NURSE',
      'RECORDS_CLERK',
      'ADMIN',
    ]);
    const role = this.actorRole(actor);
    const [patient, ward] = await Promise.all([
      this.database.patient.findUniqueOrThrow({ where: { id: patientId } }),
      this.database.ward.findUniqueOrThrow({ where: { id: wardId } }),
    ]);
    const sameFacility =
      Boolean(actor.facilityId) &&
      actor.facilityId === patient.facilityId &&
      actor.facilityId === ward.facilityId;
    await this.audit.append(
      this.auditInput(
        actor,
        role,
        'TRANSFER_PATIENT',
        sameFacility ? 'GRANT' : 'DENY',
        patientId,
        { wardId, wardName: ward.name },
        idempotencyKey,
      ),
    );
    if (!sameFacility) {
      throw new ForbiddenException('Patient or ward is outside your facility');
    }
    await this.database.patient.update({
      where: { id: patientId },
      data: { currentWardId: wardId },
    });
    await this.notifications.notifyWardStaff(
      wardId,
      patientId,
      'PATIENT_TRANSFER',
      `${patient.displayName} admitted to ${ward.name}`,
      { ward: ward.name },
    );
    return { transferred: true, wardId, ward: ward.name };
  }

  async search(principal: RequestPrincipal, query: string, limit: number): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const role = this.actorRole(actor);
    const where = this.patientScope(actor, query);
    const patients = where
      ? await this.database.patient.findMany({
          where,
          take: limit,
          orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            fhirId: true,
            displayName: true,
            birthDate: true,
            currentWard: { select: { id: true, name: true, code: true } },
          },
        })
      : [];
    await this.audit.append(
      this.auditInput(
        actor,
        role,
        'SEARCH_PATIENTS',
        'GRANT',
        undefined,
        { resultCount: patients.length },
        randomUUID(),
      ),
    );
    return { items: patients };
  }

  async readChart(
    principal: RequestPrincipal,
    patientId: string,
    idempotencyKey: string = randomUUID(),
  ): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const role = this.actorRole(actor);
    const decision = await this.policy.decide(actor, patientId, 'READ_CHART');
    await this.audit.append(
      this.auditInput(
        actor,
        role,
        'READ_CHART',
        decision.allowed ? 'GRANT' : 'DENY',
        patientId,
        {
          policyReason: decision.reason,
          wardMismatch: decision.reason === 'OUTSIDE_SCOPE' && role === 'NURSE',
          offShift: decision.reason === 'NO_ACTIVE_ASSIGNMENT',
        },
        idempotencyKey,
      ),
    );
    if (!decision.allowed) {
      throw new ForbiddenException({
        code: 'OUTSIDE_AUTHORIZED_SCOPE',
        message: 'Patient is outside the active duty scope',
        emergencyEligible: role === 'DOCTOR' || role === 'NURSE',
      });
    }
    const [patient, storedResources, orderTypes] = await Promise.all([
      this.database.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          id: true,
          fhirId: true,
          displayName: true,
          birthDate: true,
          currentWard: { select: { id: true, name: true, code: true } },
        },
      }),
      this.database.fhirResource.findMany({
        where: { patientId },
        orderBy: [{ resourceType: 'asc' }, { updatedAt: 'desc' }],
      }),
      role === 'LAB_PHARMACY' ? this.activeOrderTypes(actor.userId, patientId) : undefined,
    ]);
    const resources = orderTypes
      ? storedResources.filter((resource) => orderTypes.includes(resource.resourceType))
      : storedResources;
    return {
      patient,
      resources: projectResources(resources, decision.fields),
      policy: { fields: decision.fields },
    };
  }

  async emergencySummary(
    patientId: string,
    expiresAt: Date,
  ): Promise<ReturnType<typeof buildEmergencySummary>> {
    const [patient, resources] = await Promise.all([
      this.database.patient.findUniqueOrThrow({
        where: { id: patientId },
        include: { facility: true },
      }),
      this.database.fhirResource.findMany({ where: { patientId } }),
    ]);
    return buildEmergencySummary({
      patient,
      resources,
      facilityName: patient.facility.name,
      issuedAt: new Date(),
      expiresAt,
    });
  }

  async writeResource(
    principal: RequestPrincipal,
    patientId: string,
    rawResource: unknown,
    idempotencyKey: string,
  ): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const role = this.actorRole(actor);
    const resource = SupportedFhirResourceSchema.parse(rawResource);
    const patient = await this.database.patient.findUniqueOrThrow({ where: { id: patientId } });
    if (resourcePatientReference(resource) !== `Patient/${patient.fhirId}`) {
      throw new ForbiddenException(
        'FHIR resource patient reference does not match the route patient',
      );
    }
    const decision = await this.policy.decide(actor, patientId, 'WRITE_CLINICAL');
    const orderTypes =
      role === 'LAB_PHARMACY' ? await this.activeOrderTypes(actor.userId, patientId) : undefined;
    const roleAllowsType =
      writeTypes(role).includes(resource.resourceType) &&
      (!orderTypes || orderTypes.includes(resource.resourceType));
    const allowed = decision.allowed && roleAllowsType;
    await this.audit.append(
      this.auditInput(
        actor,
        role,
        'WRITE_FHIR_RESOURCE',
        allowed ? 'GRANT' : 'DENY',
        patientId,
        { resourceType: resource.resourceType, policyReason: decision.reason },
        idempotencyKey,
        { resourceType: resource.resourceType },
      ),
    );
    if (!allowed)
      throw new ForbiddenException('Role or duty scope does not permit this clinical write');
    const latest = await this.database.fhirResource.findFirst({
      where: { resourceType: resource.resourceType, fhirId: resource.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return this.database.fhirResource.create({
      data: {
        patientId,
        resourceType: resource.resourceType,
        fhirId: resource.id,
        version: (latest?.version ?? 0) + 1,
        sourceLabel: 'HOSPITAL_VERIFIED',
        resource: resource as Prisma.InputJsonValue,
      },
    });
  }

  async revealSensitive(
    principal: RequestPrincipal,
    patientId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const role = this.actorRole(actor);
    const decision = await this.policy.decide(actor, patientId, 'REVEAL_SENSITIVE');
    await this.audit.append(
      this.auditInput(
        actor,
        role,
        'SENSITIVE_REVEAL',
        decision.allowed ? 'GRANT' : 'DENY',
        patientId,
        { policyReason: decision.reason },
        idempotencyKey,
        { reasonCode: 'CLINICAL_NEED', reasonText: reason },
      ),
    );
    if (!decision.allowed)
      throw new ForbiddenException('Sensitive fields cannot be revealed in this context');
    const resources = await this.database.fhirResource.findMany({
      where: { patientId, resourceType: { in: ['Condition', 'Observation'] } },
    });
    return { resources: projectResources(resources, ['sensitiveFlags']) };
  }

  async createOrderLink(
    principal: RequestPrincipal,
    patientId: string,
    input: { assigneeUserId: string; resourceTypes: string[]; endsAt: Date },
    idempotencyKey: string,
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['DOCTOR']);
    const decision = await this.policy.decide(actor, patientId, 'WRITE_CLINICAL');
    if (!decision.allowed)
      throw new ForbiddenException('Doctor is not attached to this patient case');
    const now = new Date();
    const assignee = await this.database.userProfile.findFirst({
      where: {
        id: input.assigneeUserId,
        facilityId: actor.facilityId,
        assignments: {
          some: {
            role: 'LAB_PHARMACY',
            active: true,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
        },
      },
    });
    if (!assignee) {
      throw new ForbiddenException('Assignee is not active lab/pharmacy staff at this facility');
    }
    const allowedTypes = ['Observation', 'DiagnosticReport', 'MedicationRequest'];
    if (input.endsAt <= now || input.resourceTypes.some((type) => !allowedTypes.includes(type))) {
      throw new ForbiddenException('Order link contains an invalid resource type or expiry');
    }
    const orderLinkId = randomUUID();
    await this.audit.append(
      this.auditInput(
        actor,
        'DOCTOR',
        'CREATE_ORDER_LINK',
        'GRANT',
        patientId,
        {
          orderLinkId,
          assigneeUserId: input.assigneeUserId,
          resourceTypes: input.resourceTypes.join(','),
        },
        idempotencyKey,
      ),
    );
    return this.database.orderLink.create({
      data: { id: orderLinkId, patientId, createdByUserId: actor.userId, ...input },
    });
  }

  async accessLog(principal: RequestPrincipal, patientId: string): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const caregiver = await this.context.isCaregiver(actor.userId, patientId);
    if (actor.patientId !== patientId && !caregiver) {
      throw new ForbiddenException('Only the patient or linked caregiver can view this access log');
    }
    const patient = await this.database.patient.findUniqueOrThrow({ where: { id: patientId } });
    const raw = await this.audit.patientEvents(patient.facilityId, patientId);
    const events = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    const actorIds = events
      .map((event) => event.actorId)
      .filter((value): value is string => typeof value === 'string');
    const users = await this.database.userProfile.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    return {
      items: events.map(({ actorId, ...event }) => ({
        ...event,
        actor:
          typeof actorId === 'string' ? (names.get(actorId) ?? 'Hospital staff') : 'Hospital staff',
      })),
    };
  }

  auditInput(
    actor: ActiveActor,
    role: Role,
    action: string,
    decision: AuditAppend['decision'],
    patientRef: string | undefined,
    context: AuditAppend['context'],
    idempotencyKey: string,
    extra: Partial<AuditAppend> = {},
  ): AuditAppend {
    return {
      occurredAt: new Date().toISOString(),
      actorId: actor.userId,
      actorRole: role,
      ...(actor.facilityId ? { facilityId: actor.facilityId } : {}),
      ...(patientRef ? { patientRef } : {}),
      action,
      decision,
      purposeOfUse: 'TREATMENT',
      context,
      idempotencyKey,
      ...extra,
    };
  }

  actorRole(actor: ActiveActor): Role {
    if (actor.role) return actor.role;
    if (actor.patientId) return 'PATIENT';
    return 'CAREGIVER';
  }

  private patientScope(actor: ActiveActor, query: string): Record<string, unknown> | undefined {
    const text = query ? { displayName: { contains: query, mode: 'insensitive' as const } } : {};
    if (actor.patientId) return { id: actor.patientId, ...text };
    if (!actor.role) {
      return {
        caregiverLinks: {
          some: {
            caregiverId: actor.userId,
            startsAt: { lte: new Date() },
            OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
          },
        },
        ...text,
      };
    }
    if (!actor.facilityId || !actor.assignmentActive) return undefined;
    const base = { facilityId: actor.facilityId, active: true, ...text };
    switch (actor.role) {
      case 'NURSE':
        return actor.wardId ? { ...base, currentWardId: actor.wardId } : undefined;
      case 'DOCTOR':
        return {
          ...base,
          caseAttachments: {
            some: {
              userId: actor.userId,
              startsAt: { lte: new Date() },
              OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
            },
          },
        };
      case 'LOCUM_DOCTOR':
        return actor.wardId ? { ...base, currentWardId: actor.wardId } : undefined;
      case 'RECORDS_CLERK':
        return base;
      case 'LAB_PHARMACY':
        return {
          ...base,
          orderLinks: {
            some: {
              assigneeUserId: actor.userId,
              startsAt: { lte: new Date() },
              endsAt: { gt: new Date() },
            },
          },
        };
      default:
        return undefined;
    }
  }

  private async activeOrderTypes(userId: string, patientId: string): Promise<string[]> {
    const now = new Date();
    const links = await this.database.orderLink.findMany({
      where: {
        assigneeUserId: userId,
        patientId,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { resourceTypes: true },
    });
    return [...new Set(links.flatMap((link) => link.resourceTypes))];
  }
}

function writeTypes(role: Role): readonly string[] {
  switch (role) {
    case 'DOCTOR':
      return [
        'Condition',
        'Observation',
        'MedicationRequest',
        'AllergyIntolerance',
        'Procedure',
        'Encounter',
        'DiagnosticReport',
        'CarePlan',
      ];
    case 'NURSE':
      return ['Observation', 'Encounter'];
    case 'LOCUM_DOCTOR':
      return [
        'Condition',
        'Observation',
        'MedicationRequest',
        'AllergyIntolerance',
        'Encounter',
        'CarePlan',
      ];
    case 'LAB_PHARMACY':
      return ['Observation', 'DiagnosticReport', 'MedicationRequest'];
    default:
      return [];
  }
}
