import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
const AdminRegistrationSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(128), invitationCode: z.string().min(12).max(128) });

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginSchema)) body: z.infer<typeof LoginSchema>,
  ): Promise<unknown> {
    return this.auth.login(body.email.toLowerCase(), body.password);
  }

  @Public()
  @Post('register-admin')
  registerAdmin(@Body(new ZodValidationPipe(AdminRegistrationSchema)) body: z.infer<typeof AdminRegistrationSchema>): Promise<unknown> {
    return this.auth.registerAdmin(body.email.toLowerCase(), body.password, body.invitationCode);
  }
}
