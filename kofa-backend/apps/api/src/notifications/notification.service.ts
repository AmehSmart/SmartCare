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
