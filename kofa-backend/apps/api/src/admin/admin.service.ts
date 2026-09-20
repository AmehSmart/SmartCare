import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@kofa/contracts';
import { AuditClient } from '../audit/audit.client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ClinicalService } from '../clinical/clinical.service.js';
import { ContextService } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';
import { TotpService } from '../security/totp.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
    private readonly clinical: ClinicalService,
    private readonly audit: AuditClient,
    private readonly totp: TotpService,
  ) {}

  async roster(principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const users = await this.database.userProfile.findMany({
      where: { facilityId: actor.facilityId },
      select: {
        id: true,
        displayName: true,
        email: true,
        active: true,
        assignments: {
          orderBy: { startsAt: 'desc' },
          include: {
            ward: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            shift: { select: { id: true, name: true, code: true } },
          },
        },
        caseAttachments: {
          where: { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
          include: { patient: { select: { id: true, displayName: true, status: true } } },
        },
      },
      orderBy: { displayName: 'asc' },
    });
    return {
      items: users.map((user) => {
        const assignment = user.assignments.find((item) => item.active && item.endsAt > new Date());
        return {
          id: user.id,
          name: user.displayName,
          email: user.email,
          active: user.active,
          role: assignment?.role ?? null,
          ward: assignment?.ward ?? null,
          department: assignment?.department ?? null,
          shift: assignment?.shift ?? null,
          assignedPatients: user.caseAttachments.map((attachment) => ({
            assignmentId: attachment.id,
            startsAt: attachment.startsAt,
            endsAt: attachment.endsAt,
            patient: attachment.patient,
          })),
        };
      }),
    };
  }

  async patients(principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const items = await this.database.patient.findMany({
      where: { facilityId: actor.facilityId },
      include: {
        currentWard: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        caseAttachments: {
          where: { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        },
      },
      orderBy: { displayName: 'asc' },
    });
    return { items: items.map((patient) => this.patientView(patient)) };
  }

  async patient(principal: RequestPrincipal, patientId: string): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const patient = await this.database.patient.findFirst({
      where: { id: patientId, facilityId: actor.facilityId },
      include: {
        currentWard: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        caseAttachments: { include: { user: { select: { id: true, displayName: true, email: true } } } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found in this facility');
    return this.patientView(patient);
  }

  async patientAssignments(principal: RequestPrincipal, patientId: string): Promise<unknown> {
    await this.patient(principal, patientId);
    const items = await this.database.caseAttachment.findMany({
      where: { patientId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { startsAt: 'desc' },
    });
    return { items };
  }

  async assignPatient(
    principal: RequestPrincipal,
    patientId: string,
    input: { userId: string; startsAt?: Date; endsAt?: Date },
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const [patient, staff] = await Promise.all([
      this.database.patient.findFirst({ where: { id: patientId, facilityId: actor.facilityId } }),
      this.database.userProfile.findFirst({ where: { id: input.userId, facilityId: actor.facilityId, active: true } }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found in this facility');
    if (!staff) throw new NotFoundException('Staff member not found in this facility');
    const now = new Date();
    const startsAt = input.startsAt ?? now;
    const endsAt = input.endsAt;
    if (endsAt && endsAt <= startsAt) throw new BadRequestException('endsAt must be after startsAt');
    const activeAssignment = await this.database.assignment.findFirst({
      where: { userId: staff.id, active: true, startsAt: { lte: now }, endsAt: { gt: now }, role: { in: ['DOCTOR', 'LOCUM_DOCTOR', 'NURSE'] } },
    });
    if (!activeAssignment) throw new BadRequestException('Staff member has no active eligible clinical assignment');
    const duplicate = await this.database.caseAttachment.findFirst({
      where: { userId: staff.id, patientId, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    });
    if (duplicate) throw new ConflictException('Staff member is already assigned to this patient');
    const attachment = await this.database.caseAttachment.create({ data: { userId: staff.id, patientId, startsAt, ...(endsAt ? { endsAt } : {}) } });
    await this.audit.append(this.clinical.auditInput(actor, 'ADMIN', 'ASSIGN_PATIENT', 'GRANT', patientId, { targetUserId: staff.id, assignmentId: attachment.id }, `patient-assign:${attachment.id}`, { purposeOfUse: 'OPERATIONS' }));
    return attachment;
  }

  async removePatientAssignment(principal: RequestPrincipal, id: string): Promise<{ removed: true }> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const attachment = await this.database.caseAttachment.findFirst({ where: { id, patient: { facilityId: actor.facilityId } } });
    if (!attachment) throw new NotFoundException('Patient assignment not found');
    await this.database.caseAttachment.update({ where: { id }, data: { endsAt: new Date() } });
    await this.audit.append(this.clinical.auditInput(actor, 'ADMIN', 'UNASSIGN_PATIENT', 'GRANT', attachment.patientId, { assignmentId: id }, `patient-unassign:${id}:${Date.now()}`, { purposeOfUse: 'OPERATIONS' }));
    return { removed: true };
  }

  async setPatientStatus(principal: RequestPrincipal, patientId: string, status: 'ACTIVE' | 'DISCHARGED' | 'INACTIVE'): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const patient = await this.database.patient.findFirst({ where: { id: patientId, facilityId: actor.facilityId } });
    if (!patient) throw new NotFoundException('Patient not found in this facility');
    const updated = await this.database.patient.update({ where: { id: patientId }, data: { status, active: status === 'ACTIVE', dischargedAt: status === 'DISCHARGED' ? new Date() : null } });
    await this.audit.append(this.clinical.auditInput(actor, 'ADMIN', 'SET_PATIENT_STATUS', 'GRANT', patientId, { status }, `patient-status:${patientId}:${status}:${Date.now()}`, { purposeOfUse: 'OPERATIONS' }));
    return updated;
  }

  async assignmentStaff(principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const now = new Date();
    const items = await this.database.userProfile.findMany({
      where: { facilityId: actor.facilityId, active: true, assignments: { some: { active: true, startsAt: { lte: now }, endsAt: { gt: now }, role: { in: ['DOCTOR', 'LOCUM_DOCTOR', 'NURSE'] } } } },
      select: { id: true, displayName: true, email: true, assignments: { where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } }, include: { ward: true, department: true, shift: true } } },
    });
    return { items };
  }

  private patientView(patient: any): Record<string, unknown> {
    return {
      id: patient.id, fhirId: patient.fhirId, displayName: patient.displayName, birthDate: patient.birthDate,
      status: patient.status, active: patient.active, admittedAt: patient.admittedAt, dischargedAt: patient.dischargedAt,
      currentWard: patient.currentWard, department: patient.department,
      assignments: patient.caseAttachments.map((attachment: any) => ({ id: attachment.id, startsAt: attachment.startsAt, endsAt: attachment.endsAt, staff: attachment.user })),
    };
  }

  async assign(
    principal: RequestPrincipal,
    input: { userId: string; role: Role; wardId?: string; startsAt: Date; endsAt: Date },
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    if (input.endsAt <= input.startsAt) {
      throw new BadRequestException('Assignment endsAt must be after startsAt');
    }
    const target = await this.database.userProfile.findFirst({
      where: { id: input.userId, facilityId: actor.facilityId },
    });
    if (!target) throw new NotFoundException('User not found in this facility');
    if (input.wardId) {
      const ward = await this.database.ward.findFirst({
        where: { id: input.wardId, facilityId: actor.facilityId, active: true },
      });
      if (!ward) throw new NotFoundException('Ward not found in this facility');
    }
    const assignment = await this.database.assignment.create({ data: input });
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        'ADMIN',
        'CREATE_ASSIGNMENT',
        'GRANT',
        undefined,
        { targetUserId: input.userId, assignmentId: assignment.id, role: input.role },
        `assignment-create:${assignment.id}`,
        { purposeOfUse: 'OPERATIONS' },
      ),
    );
    return assignment;
  }

  async disableAssignment(principal: RequestPrincipal, id: string): Promise<void> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const assignment = await this.database.assignment.findFirst({
      where: { id, user: { facilityId: actor.facilityId } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.database.assignment.update({
      where: { id },
      data: { active: false, endsAt: new Date() },
    });
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        'ADMIN',
        'DISABLE_ASSIGNMENT',
        'GRANT',
        undefined,
        { assignmentId: id },
        `assignment-disable:${id}`,
        { purposeOfUse: 'OPERATIONS' },
      ),
    );
  }

  async beginTotp(principal: RequestPrincipal, userId: string): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const target = await this.database.userProfile.findFirst({
      where: { id: userId, facilityId: actor.facilityId },
    });
    if (!target) throw new NotFoundException('User not found in this facility');
    const enrollment = await this.totp.beginEnrollment(userId);
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        'ADMIN',
        'BEGIN_TOTP_ENROLLMENT',
        'GRANT',
        undefined,
        { targetUserId: userId },
        `totp-begin:${userId}:${Date.now()}`,
        { purposeOfUse: 'SECURITY' },
      ),
    );
    return enrollment;
  }

  async confirmOwnTotp(principal: RequestPrincipal, code: string): Promise<void> {
    const actor = await this.context.actor(principal);
    await this.totp.confirmEnrollment(actor.userId, code);
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        this.clinical.actorRole(actor),
        'CONFIRM_TOTP_ENROLLMENT',
        'GRANT',
        undefined,
        {},
        `totp-confirm:${actor.userId}:${Date.now()}`,
        { purposeOfUse: 'SECURITY' },
      ),
    );
  }

  async setDeviceStatus(
    principal: RequestPrincipal,
    deviceId: string,
    status: 'ACTIVE' | 'REVOKED',
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const device = await this.database.registeredDevice.findFirst({
      where: { id: deviceId, user: { facilityId: actor.facilityId } },
    });
    if (!device) throw new NotFoundException('Device not found in this facility');
    const updated = await this.database.registeredDevice.update({
      where: { id: deviceId },
      data: { status, ...(status === 'REVOKED' ? { revokedAt: new Date() } : { revokedAt: null }) },
    });
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        'ADMIN',
        'SET_DEVICE_STATUS',
        'GRANT',
        undefined,
        { deviceId, status },
        `device-status:${deviceId}:${status}:${Date.now()}`,
        { purposeOfUse: 'SECURITY' },
      ),
    );
    return { id: updated.id, status: updated.status };
  }
}
