import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import { RoleSchema } from '@kofa/contracts';
import { StaffService } from '../staff/staff.service.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});
const StaffRegistrationSchema = z.object({
  email: z.string().email(),
  staffId: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  department: z.string().min(1).max(160),
  ward: z.string().min(1).max(160).optional(),
  role: RoleSchema.exclude(['PATIENT', 'CAREGIVER', 'ADMIN', 'AUDIT_OFFICER']).default('NURSE'),
  shift: z.string().min(1).max(160).default('Day Shift'),
  pin: z.string().regex(/^\d{6}$/),
});
const AdminRegistrationSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(128), invitationCode: z.string().min(12).max(128) });

@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(StaffService) private readonly staff: StaffService,
  ) { }

  @Public()
  @Get('staff-options')
  staffOptions(): Promise<unknown> {
    return this.staff.registrationOptions();
  }

  @Public()
  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginSchema)) body: z.infer<typeof LoginSchema>,
  ): Promise<unknown> {
    return this.auth.login(body.email.toLowerCase(), body.password);
  }

  @Public()
  @Post('register-staff')
  registerStaff(@Body(new ZodValidationPipe(StaffRegistrationSchema)) body: z.infer<typeof StaffRegistrationSchema>): Promise<unknown> {
    return this.auth.registerStaff(body.email, body.staffId, body.name, body.pin, body.department, body.ward, body.role, body.shift);
  }

  @Public()
  @Post('bootstrap-admin-invitation')
  bootstrapAdminInvitation(): Promise<unknown> {
    return this.auth.createFirstAdminInvitation();
  }

  @Public()
  @Post('register-admin')
  registerAdmin(@Body(new ZodValidationPipe(AdminRegistrationSchema)) body: z.infer<typeof AdminRegistrationSchema>): Promise<unknown> {
    return this.auth.registerAdmin(body.email.toLowerCase(), body.password, body.invitationCode);
  }
}
