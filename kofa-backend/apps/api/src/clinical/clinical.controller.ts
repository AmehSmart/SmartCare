import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { PatientQuerySchema } from '@kofa/contracts';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ClinicalService } from './clinical.service.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';

@Controller('v1/patients')
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Get()
  search(
    @Principal() principal: RequestPrincipal,
    @Query('query') query?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    const parsed = PatientQuerySchema.parse({ query, limit });
    return this.clinical.search(principal, parsed.query, parsed.limit);
  }

  @Get(':id')
  read(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<unknown> {
    return this.clinical.readChart(principal, id, idempotencyKey);
  }

  @Get(':id/access-log')
  accessLog(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) patientId: string,
  ): Promise<unknown> {
    return this.clinical.accessLog(principal, patientId);
  }

  @Post(':id/resources')
  write(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) patientId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    if (!idempotencyKey || idempotencyKey.length < 16)
      throw new BadRequestException('x-idempotency-key is required');
    const input = z.object({ resource: z.unknown() }).parse(body);
    return this.clinical.writeResource(principal, patientId, input.resource, idempotencyKey);
  }

  @Post(':id/sensitive-reveal')
  reveal(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) patientId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    if (!idempotencyKey || idempotencyKey.length < 16)
      throw new BadRequestException('x-idempotency-key is required');
    const input = z.object({ reason: z.string().trim().min(3).max(500) }).parse(body);
    return this.clinical.revealSensitive(principal, patientId, input.reason, idempotencyKey);
  }

  @Post(':id/order-links')
  orderLink(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) patientId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    if (!idempotencyKey || idempotencyKey.length < 16) {
      throw new BadRequestException('x-idempotency-key is required');
    }
    const input = z
      .object({
        assigneeUserId: z.uuid(),
        resourceTypes: z
          .array(z.enum(['Observation', 'DiagnosticReport', 'MedicationRequest']))
          .min(1),
        endsAt: z.coerce.date(),
      })
      .parse(body);
    return this.clinical.createOrderLink(principal, patientId, input, idempotencyKey);
  }
}
