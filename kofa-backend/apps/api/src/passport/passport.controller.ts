import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConsentGrantRequestSchema } from '@kofa/contracts';
import { z } from 'zod';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public } from '../auth/public.decorator.js';
import { PassportService } from './passport.service.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';

const UsePassportSchema = z.object({
  token: z.string().min(1).max(20_000),
  pin: z.string().min(6).max(64),
});

@Controller('v1/passport')
export class PassportController {
  constructor(private readonly passports: PassportService) {}

  @Public()
  @Get('keys/current')
  key(): unknown {
    return this.passports.publicKey();
  }

  @Post('grants')
  grant(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(ConsentGrantRequestSchema))
    body: z.infer<typeof ConsentGrantRequestSchema>,
  ): Promise<unknown> {
    return this.passports.grant(principal, body);
  }

  @Get('grants')
  list(
    @Principal() principal: RequestPrincipal,
    @Query('patientId') patientId: string,
  ): Promise<unknown> {
    return this.passports.list(principal, z.string().uuid().parse(patientId));
  }

  @Post('use')
  use(
    @Principal() principal: RequestPrincipal,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(UsePassportSchema)) body: z.infer<typeof UsePassportSchema>,
  ): Promise<unknown> {
    if (!idempotencyKey || idempotencyKey.length < 16)
      throw new BadRequestException('x-idempotency-key is required');
    return this.passports.use(principal, body.token, body.pin, idempotencyKey);
  }

  @Delete('grants/:id')
  async revoke(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<{ revoked: true }> {
    await this.passports.revoke(principal, id);
    return { revoked: true };
  }
}
