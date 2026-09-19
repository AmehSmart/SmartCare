import { Controller, Get, Param, Patch } from '@nestjs/common';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { NotificationService } from './notification.service.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';

@Controller('v1/notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.notifications.list(principal);
  }

  @Patch(':id/read')
  async read(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<{ read: true }> {
    await this.notifications.markRead(principal, id);
    return { read: true };
  }
}
