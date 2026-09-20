import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../../../generated/clinical/client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ContextService } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';

@Injectable()
export class NotificationService {
  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
  ) {}

  async notifyPatient(
    patientId: string,
    type: string,
    title: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    const now = new Date();
    const recipients = await this.database.userProfile.findMany({
      where: {
        OR: [
          { patientId },
          {
            caregiverLinks: {
              some: {
                patientId,
                startsAt: { lte: now },
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (recipients.length) {
      await this.database.notification.createMany({
        data: recipients.map((recipient) => ({
          recipientId: recipient.id,
          patientId,
          type,
          title,
          metadata,
        })),
      });
    }
  }

  // Notify staff currently on duty in a ward - used when a patient is admitted
  // or transferred there, so ward clinicians see the new arrival to review.
  async notifyWardStaff(
    wardId: string,
    patientId: string,
    type: string,
    title: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    const now = new Date();
    const assignments = await this.database.assignment.findMany({
      where: {
        wardId,
        active: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { userId: true },
    });
    const recipientIds = [...new Set(assignments.map((assignment) => assignment.userId))];
    if (recipientIds.length) {
      await this.database.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          recipientId,
          patientId,
          type,
          title,
          metadata,
        })),
      });
    }
  }

  async list(principal: RequestPrincipal): Promise<unknown> {
    const actor = await this.context.actor(principal);
    return {
      items: await this.database.notification.findMany({
        where: { recipientId: actor.userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    };
  }

  async markRead(principal: RequestPrincipal, id: string): Promise<void> {
    const actor = await this.context.actor(principal);
    const notification = await this.database.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.recipientId !== actor.userId) {
      throw new ForbiddenException('Notification belongs to another account');
    }
    await this.database.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
