import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from './audit.service.js';
import { InternalAuthGuard } from './internal-auth.guard.js';

@Controller('internal/v1/audit')
@UseGuards(InternalAuthGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) { }

  @Post('events')
  append(@Body() body: unknown): Promise<unknown> {
    return this.audit.append(body);
  }

  @Post('verify')
  verify(@Headers('x-kofa-actor') actor = 'system'): Promise<unknown> {
    return this.audit.verify(actor);
  }

  @Get('checkpoints/latest')
  checkpoint(): Promise<unknown> {
    return this.audit.latestCheckpoint();
  }

  @Get('events')
  list(
    @Query('facilityId') facilityId: string,
    @Query('limit') rawLimit?: string,
    @Query('cursor') rawCursor?: string,
  ): Promise<unknown> {
    const parsedFacilityId = z.string().uuid().parse(facilityId);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(rawLimit);
    const cursor = rawCursor ? z.coerce.bigint().positive().parse(rawCursor) : undefined;
    return this.audit.listEvents(limit, parsedFacilityId, cursor);
  }

  @Get('flags')
  flags(@Query('facilityId') facilityId: string): Promise<unknown> {
    return this.audit.listFlags(z.string().uuid().parse(facilityId));
  }

  @Get('patient-events/:patientRef')
  patientEvents(
    @Param('patientRef') patientRef: string,
    @Query('facilityId') facilityId: string,
  ): Promise<unknown> {
    return this.audit.patientEvents(
      z.string().uuid().parse(facilityId),
      z.string().uuid().parse(patientRef),
    );
  }

  @Patch('flags/:id')
  review(
    @Param('id') id: string,
    @Query('facilityId') facilityId: string,
    @Headers('x-kofa-actor') actor: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const input = z
      .object({
        status: z.enum(['REVIEWED', 'DISMISSED', 'ESCALATED']),
        disposition: z.string().max(1000).optional(),
      })
      .parse(body);
    return this.audit.reviewFlag(
      id,
      z.string().uuid().parse(facilityId),
      actor,
      input.status,
      input.disposition,
    );
  }
}
