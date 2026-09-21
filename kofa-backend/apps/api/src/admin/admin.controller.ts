import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { RoleSchema } from '@kofa/contracts';
import { z } from 'zod';
import { Role } from '@kofa/contracts';
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

const InvitationCreateSchema = z.object({
  expiresAt: z.coerce.date().optional(),
});
const PatientCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(1).max(80),
  birthDate: z.coerce.date().optional(),
  departmentId: z.uuid().optional(),
  wardId: z.uuid().optional(),
  status: z.enum(['ACTIVE', 'DISCHARGED', 'INACTIVE']).default('ACTIVE'),
  assignedStaffId: z.uuid().optional(),
});
const StaffCreateSchema = z.object({
  email: z.string().email(),
  staffId: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(160),
  pin: z.string().regex(/^\d{6}$/),
  role: RoleSchema.exclude(['PATIENT', 'CAREGIVER', 'ADMIN', 'AUDIT_OFFICER']),
  department: z.string().trim().min(1).max(160),
  ward: z.string().trim().max(160).optional(),
  shift: z.string().trim().min(1).max(160),
});

@Controller('v1/admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) { }

  @Get('invitations')
  listInvitations(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.admin.listInvitations(principal);
  }

  @Post('invitations')
  createInvitation(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(InvitationCreateSchema)) body: z.infer<typeof InvitationCreateSchema>,
  ): Promise<unknown> {
    return this.admin.createInvitation(principal, body);
  }

  @Patch('invitations/:id/revoke')
  revokeInvitation(
    @Principal() principal: RequestPrincipal,
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<unknown> {
    return this.admin.revokeInvitation(principal, id);
  }

  @Get('roster')
  roster(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.admin.roster(principal);
  }

  @Get('patients')
  patients(
    @Principal() principal: RequestPrincipal,
    @Query('query') query?: string,
  ): Promise<unknown> {
    return this.admin.patients(principal, query);
  }

  @Post('patients')
  createPatient(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(PatientCreateSchema)) body: z.infer<typeof PatientCreateSchema>,
  ): Promise<unknown> {
    return this.admin.createPatient(principal, body);
  }

  @Post('staff')
  createStaff(
    @Principal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(StaffCreateSchema)) body: z.infer<typeof StaffCreateSchema>,
  ): Promise<unknown> {
    return this.admin.createStaff(principal, body);
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

  @Get('departments')
  departments(@Principal() principal: RequestPrincipal): Promise<unknown> {
    return this.admin.departments(principal);
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
