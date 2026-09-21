import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Role } from '@kofa/contracts';
import { ClinicalDatabase } from '../database.service.js';
import type { RequestPrincipal } from '../auth/auth.types.js';

export type ActiveActor = {
  userId: string;
  facilityId?: string;
  patientId?: string;
  role?: Role;
  wardId?: string;
  assignmentId?: string;
  assignmentActive: boolean;
  sessionId: string;
};

@Injectable()
export class ContextService {
  constructor(@Inject(ClinicalDatabase) private readonly database: ClinicalDatabase) { }

  async actor(principal: RequestPrincipal): Promise<ActiveActor> {
    const user = await this.database.userProfile.findUnique({
      where: { authSubject: principal.subject },
    });
    if (!user?.active) throw new UnauthorizedException('Kofa account is inactive or missing');
    const now = new Date();
    const duty = await this.database.dutyContext.findUnique({
      where: { sessionId: principal.sessionId },
      include: { assignment: true },
    });
    if (!duty || duty.expiresAt <= now || duty.userId !== user.id) {
      return {
        userId: user.id,
        ...(user.facilityId ? { facilityId: user.facilityId } : {}),
        ...(user.patientId ? { patientId: user.patientId, role: 'PATIENT' as const } : {}),
        assignmentActive: false,
        sessionId: principal.sessionId,
      };
    }
    const assignmentActive =
      duty.assignment.active && duty.assignment.startsAt <= now && duty.assignment.endsAt > now;
    return {
      userId: user.id,
      ...(user.facilityId ? { facilityId: user.facilityId } : {}),
      ...(user.patientId ? { patientId: user.patientId } : {}),
      role: duty.assignment.role,
      ...(duty.assignment.wardId ? { wardId: duty.assignment.wardId } : {}),
      assignmentId: duty.assignment.id,
      assignmentActive,
      sessionId: principal.sessionId,
    };
  }

  async assignments(principal: RequestPrincipal): Promise<unknown[]> {
    const user = await this.database.userProfile.findUnique({
      where: { authSubject: principal.subject },
    });
    if (!user?.active) throw new UnauthorizedException('Kofa account is inactive or missing');
    const now = new Date();
    return this.database.assignment.findMany({
      where: { userId: user.id, active: true, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { ward: { select: { id: true, name: true, code: true } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async select(principal: RequestPrincipal, assignmentId: string): Promise<unknown> {
    const user = await this.database.userProfile.findUnique({
      where: { authSubject: principal.subject },
    });
    if (!user?.active) throw new UnauthorizedException('Kofa account is inactive or missing');
    const now = new Date();
    const assignment = await this.database.assignment.findFirst({
      where: {
        id: assignmentId,
        userId: user.id,
        active: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: { ward: true },
    });
    if (!assignment) throw new ForbiddenException('Assignment is not active for this account');
    const expiresAt = new Date(
      Math.min(
        assignment.endsAt.getTime(),
        principal.tokenExpiresAt.getTime(),
        now.getTime() + 8 * 60 * 60 * 1000,
      ),
    );
    const selected = await this.database.dutyContext.upsert({
      where: { sessionId: principal.sessionId },
      create: { sessionId: principal.sessionId, userId: user.id, assignmentId, expiresAt },
      update: { userId: user.id, assignmentId, selectedAt: now, expiresAt },
    });
    return { id: selected.id, role: assignment.role, ward: assignment.ward, expiresAt };
  }

  async requireRole(principal: RequestPrincipal, roles: readonly Role[]): Promise<ActiveActor> {
    const actor = await this.actor(principal);
    if (!actor.role || !actor.assignmentActive || !roles.includes(actor.role)) {
      throw new ForbiddenException('Active duty context does not permit this operation');
    }
    return actor;
  }

  async requirePatient(
    patientId: string,
  ): Promise<{ id: string; facilityId: string; currentWardId: string | null }> {
    const patient = await this.database.patient.findUnique({
      where: { id: patientId },
      select: { id: true, facilityId: true, currentWardId: true },
    });
    if (!patient?.id) throw new NotFoundException('Patient not found');
    return patient;
  }

  async isCaregiver(userId: string, patientId: string): Promise<boolean> {
    const now = new Date();
    return Boolean(
      await this.database.caregiverLink.findFirst({
        where: {
          caregiverId: userId,
          patientId,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: { id: true },
      }),
    );
  }
}
