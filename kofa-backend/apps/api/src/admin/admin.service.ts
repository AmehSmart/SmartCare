import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@kofa/contracts';
import { AuditClient } from '../audit/audit.client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { generateAdminInvitationCode, hashInvitationCode } from '../auth/auth.service.js';
import { ClinicalService } from '../clinical/clinical.service.js';
import { ContextService } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';
import { TotpService } from '../security/totp.service.js';
import { StaffService } from '../staff/staff.service.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject(ClinicalDatabase) private readonly database: ClinicalDatabase,
    @Inject(ContextService) private readonly context: ContextService,
    @Inject(ClinicalService) private readonly clinical: ClinicalService,
    @Inject(AuditClient) private readonly audit: AuditClient,
    @Inject(TotpService) private readonly totp: TotpService,
    @Inject(StaffService) private readonly staff: StaffService,
  ) { }

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

  async patients(principal: RequestPrincipal, query?: string): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const normalizedQuery = query?.trim();
    const items = await this.database.patient.findMany({
      where: {
        facilityId: actor.facilityId,
        ...(normalizedQuery ? { OR: [{ displayName: { contains: normalizedQuery, mode: 'insensitive' } }, { fhirId: { contains: normalizedQuery, mode: 'insensitive' } }] } : {}),
      },
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

  async createPatient(
    principal: RequestPrincipal,
    input: {
      firstName: string;
      middleName?: string;
      lastName: string;
      birthDate?: Date;
      departmentId?: string;
      wardId?: string;
      status: 'ACTIVE' | 'DISCHARGED' | 'INACTIVE';
      assignedStaffId?: string;
    },
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    if (!actor.facilityId) throw new BadRequestException('Administrator is not linked to a facility');
    const displayName = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(' ').trim();
    const now = new Date();
    const duplicate = await this.database.patient.findFirst({
      where: {
        facilityId: actor.facilityId,
        displayName: { equals: displayName, mode: 'insensitive' },
        ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      },
      select: { id: true, displayName: true, fhirId: true, birthDate: true },
    });
    if (duplicate) throw new ConflictException({ message: 'Possible existing patient found', patient: duplicate });

    if (input.departmentId) {
      const department = await this.database.department.findFirst({ where: { id: input.departmentId, facilityId: actor.facilityId, active: true } });
      if (!department) throw new NotFoundException('Department not found in this facility');
    }
    if (input.wardId) {
      const ward = await this.database.ward.findFirst({ where: { id: input.wardId, facilityId: actor.facilityId, active: true } });
      if (!ward) throw new NotFoundException('Ward not found in this facility');
    }

    const created = await this.database.$transaction(async (transaction) => {
      const patient = await transaction.patient.create({
        data: {
          fhirId: await this.nextMrn(transaction),
          facilityId: actor.facilityId as string,
          displayName,
          ...(input.birthDate ? { birthDate: input.birthDate } : {}),
          ...(input.departmentId ? { departmentId: input.departmentId } : {}),
          ...(input.wardId ? { currentWardId: input.wardId } : {}),
          status: input.status,
          active: input.status === 'ACTIVE',
          ...(input.status === 'DISCHARGED' ? { dischargedAt: now } : {}),
        },
      });
      if (input.assignedStaffId) {
        const staff = await transaction.userProfile.findFirst({
          where: { id: input.assignedStaffId, facilityId: actor.facilityId, active: true, assignments: { some: { active: true, startsAt: { lte: now }, endsAt: { gt: now }, role: { in: ['DOCTOR', 'LOCUM_DOCTOR', 'NURSE'] } } } },
          select: { id: true },
        });
        if (!staff) throw new BadRequestException('Selected staff member has no active eligible clinical assignment');
        await transaction.caseAttachment.create({ data: { patientId: patient.id, userId: staff.id, startsAt: now } });
      }
      return patient;
    });
    await this.audit.append(this.clinical.auditInput(actor, 'ADMIN', 'CREATE_PATIENT', 'GRANT', created.id, { mrn: created.fhirId }, `patient-create:${created.id}`, { purposeOfUse: 'OPERATIONS' }));
    return this.patient(principal, created.id);
  }

  async createStaff(
    principal: RequestPrincipal,
    input: { email: string; staffId: string; name: string; pin: string; role: Exclude<Role, 'PATIENT' | 'CAREGIVER' | 'ADMIN' | 'AUDIT_OFFICER'>; department: string; ward?: string; shift: string },
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    if (!actor.facilityId) throw new BadRequestException('Administrator is not linked to a facility');
    const created = await this.staff.createStaff(input, actor.facilityId);
    const staffId = input.staffId.trim().toUpperCase();
    await this.audit.append(this.clinical.auditInput(actor, 'ADMIN', 'CREATE_STAFF', 'GRANT', created.user.id, { staffId, role: input.role, assignmentId: created.assignment.id }, `staff-create:${created.user.id}`, { purposeOfUse: 'OPERATIONS' }));
    return { id: created.user.id, name: created.user.displayName, email: created.user.email, staffId, role: created.assignment.role, department: created.department, shift: created.shift };
  }

  private async nextMrn(transaction: any): Promise<string> {
    for (; ;) {
      const candidate = `MRN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const exists = await transaction.patient.findUnique({ where: { fhirId: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
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

  async departments(principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const items = await this.database.department.findMany({
      where: { facilityId: actor.facilityId, active: true },
      include: { wards: { where: { active: true }, select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
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

  async listInvitations(principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const items = await this.database.adminInvitation.findMany({
      where: { createdBy: { facilityId: actor.facilityId } },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        usedBy: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        revokedAt: item.revokedAt,
        usedAt: item.usedAt,
        usedBy: item.usedBy,
        createdBy: item.createdBy,
        status: this.invitationStatus(item),
      })),
    };
  }

  async createInvitation(
    principal: RequestPrincipal,
    input: { expiresAt?: Date } = {},
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Invitation expiry must be in the future');
    }
    const code = generateAdminInvitationCode();
    const invitation = await this.database.adminInvitation.create({
      data: {
        codeHash: hashInvitationCode(code),
        createdById: actor.userId,
        expiresAt,
      },
    });
    return { id: invitation.id, code, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt };
  }

  async revokeInvitation(principal: RequestPrincipal, invitationId: string): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['ADMIN']);
    const invitation = await this.database.adminInvitation.findFirst({
      where: { id: invitationId, createdBy: { facilityId: actor.facilityId } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.usedAt || invitation.revokedAt) {
      throw new ConflictException('Invitation has already been used or revoked');
    }
    const updated = await this.database.adminInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
    return { id: updated.id, revokedAt: updated.revokedAt, status: 'REVOKED' };
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

  private invitationStatus(invitation: {
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
  }): 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED' {
    if (invitation.revokedAt) return 'REVOKED';
    if (invitation.usedAt) return 'USED';
    if (invitation.expiresAt <= new Date()) return 'EXPIRED';
    return 'ACTIVE';
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
