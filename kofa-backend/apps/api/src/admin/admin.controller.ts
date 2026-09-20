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

const PatientAssignmentSchema = z.object({
  userId: z.uuid(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

@Controller('v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('roster')
  roster(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.admin.roster(principal);
  }

  @Get('patients')
  patients(
    @Principal() principal: RequestPrincipal,
    @Param() _params: Record<string, never>,
  ): Promise<unknown> {
    return this.admin.patients(principal);
  }

  @Get('patients/:id')
  patient(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<unknown> {
    return this.admin.patient(principal, id);
  }

  @Get('patients/:id/assignments')
  patientAssignments(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<unknown> {
    return this.admin.patientAssignments(principal, id);
  }

  @Post('patients/:id/assignments')
  assignPatient(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) patientId: string,
    @Body(new ZodValidationPipe(PatientAssignmentSchema)) body: z.infer<typeof PatientAssignmentSchema>,
  ): Promise<unknown> {
    return this.admin.assignPatient(principal, patientId, body);
  }

  @Delete('patient-assignments/:id')
  removePatientAssignment(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<{ removed: true }> {
    return this.admin.removePatientAssignment(principal, id);
  }

  @Patch('patients/:id/status')
  status(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
    @Body(new ZodValidationPipe(z.object({ status: z.enum(['ACTIVE', 'DISCHARGED', 'INACTIVE']) })))
    body: { status: 'ACTIVE' | 'DISCHARGED' | 'INACTIVE' },
  ): Promise<unknown> {
    return this.admin.setPatientStatus(principal, id, body.status);
  }

  @Get('assignment-staff')
  assignmentStaff(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.admin.assignmentStaff(principal);
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
