import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RoleSchema } from '@kofa/contracts';
import { z } from 'zod';
import { Principal } from '../auth/principal.decorator.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UuidValidationPipe } from '../common/uuid-validation.pipe.js';
import { AdminService } from './admin.service.js';

const AssignmentSchema = z.object({
  userId: z.uuid(),
  role: RoleSchema.exclude(['PATIENT', 'CAREGIVER']),
  wardId: z.uuid().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

@Controller('v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('roster')
  roster(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.admin.roster(principal);
  }

  @Post('assignments')
  assign(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(AssignmentSchema)) body: z.infer<typeof AssignmentSchema>,
  ): Promise<unknown> {
    return this.admin.assign(principal, body);
  }

  @Delete('assignments/:id')
  async disable(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<{ disabled: true }> {
    await this.admin.disableAssignment(principal, id);
    return { disabled: true };
  }

  @Post('users/:id/totp-enrollment')
  beginTotp(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<unknown> {
    return this.admin.beginTotp(principal, id);
  }

  @Post('totp-enrollment/confirm')
  async confirmTotp(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(z.object({ code: z.string().regex(/^\d{6}$/) })))
    body: { code: string },
  ): Promise<{ enrolled: true }> {
    await this.admin.confirmOwnTotp(principal, body.code);
    return { enrolled: true };
  }

  @Patch('devices/:id')
  deviceStatus(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
    @Body(new ZodValidationPipe(z.object({ status: z.enum(['ACTIVE', 'REVOKED']) })))
    body: { status: 'ACTIVE' | 'REVOKED' },
  ): Promise<unknown> {
    return this.admin.setDeviceStatus(principal, id, body.status);
  }
}
