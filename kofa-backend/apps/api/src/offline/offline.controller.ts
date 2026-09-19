import { Body, Controller, Param, Post } from '@nestjs/common';
import { OfflineSyncSchema } from '@kofa/contracts';
import { z } from 'zod';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OfflineService } from './offline.service.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';

const RegisterDeviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  signingPublicKey: z.string().min(40).max(100),
  encryptionPublicKey: z.string().min(40).max(100),
});
const CacheRequestSchema = z.object({ patientIds: z.array(z.uuid()).min(1).max(20) });

@Controller('v1/offline')
export class OfflineController {
  constructor(private readonly offline: OfflineService) {}

  @Post('devices')
  register(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) body: z.infer<typeof RegisterDeviceSchema>,
  ): Promise<unknown> {
    return this.offline.register(principal, body);
  }

  @Post('devices/:id/cache')
  cache(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
    @Body(new ZodValidationPipe(CacheRequestSchema)) body: z.infer<typeof CacheRequestSchema>,
  ): Promise<unknown> {
    return this.offline.issueCache(principal, id, body.patientIds);
  }

  @Post('sync')
  sync(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(OfflineSyncSchema)) body: z.infer<typeof OfflineSyncSchema>,
  ): Promise<unknown> {
    return this.offline.sync(principal, body);
  }
}
