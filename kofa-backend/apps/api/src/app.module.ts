import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { AuditClient } from './audit/audit.client.js';
import { AuditProxyController } from './audit/audit.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { ClinicalController } from './clinical/clinical.controller.js';
import { ClinicalService } from './clinical/clinical.service.js';
import { ContextController } from './context/context.controller.js';
import { ContextService } from './context/context.service.js';
import { ClinicalDatabase } from './database.service.js';
import { EmergencyController } from './emergency/emergency.controller.js';
import { EmergencyService } from './emergency/emergency.service.js';
import { HealthController } from './health.controller.js';
import { OfflineController } from './offline/offline.controller.js';
import { OfflineService } from './offline/offline.service.js';
import { NotificationController } from './notifications/notification.controller.js';
import { NotificationService } from './notifications/notification.service.js';
import { PassportController } from './passport/passport.controller.js';
import { PassportService } from './passport/passport.service.js';
import { PolicyService } from './policy/policy.service.js';
import { TotpService } from './security/totp.service.js';

@Module({
  controllers: [
    HealthController,
    AuthController,
    ContextController,
    ClinicalController,
    EmergencyController,
    PassportController,
    AuditProxyController,
    AdminController,
    OfflineController,
    NotificationController,
  ],
  providers: [
    ClinicalDatabase,
    AuditClient,
    ContextService,
    PolicyService,
    ClinicalService,
    TotpService,
    EmergencyService,
    PassportService,
    AdminService,
    OfflineService,
    NotificationService,
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
