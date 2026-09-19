import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditDatabase } from './database.service.js';
import { HealthController } from './health.controller.js';
import { InternalAuthGuard } from './internal-auth.guard.js';

@Module({
  controllers: [AuditController, HealthController],
  providers: [AuditDatabase, AuditService, InternalAuthGuard],
})
export class AppModule {}
