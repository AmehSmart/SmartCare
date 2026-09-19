import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    return this.database.userProfile.findMany({
      where: { facilityId: actor.facilityId },
      select: {
        id: true,
        displayName: true,
        email: true,
        active: true,
        assignments: {
          orderBy: { startsAt: 'desc' },
          include: { ward: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { displayName: 'asc' },
    });
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
