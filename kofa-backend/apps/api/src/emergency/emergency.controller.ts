import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { BreakGlassRequestSchema } from '@kofa/contracts';
import type { z } from 'zod';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { EmergencyService } from './emergency.service.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';

@Controller('v1')
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Post('patients/:id/breakglass')
  breakGlass(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) patientId: string,
    @Body(new ZodValidationPipe(BreakGlassRequestSchema))
    body: z.infer<typeof BreakGlassRequestSchema>,
  ): Promise<unknown> {
    return this.emergency.breakGlass(principal, patientId, body);
  }

  @Delete('emergency-sessions/:id')
  async end(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<{ ended: true }> {
    await this.emergency.end(principal, id);
    return { ended: true };
  }
}
