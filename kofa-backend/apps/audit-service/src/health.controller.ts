import { Controller, Get } from '@nestjs/common';
import { AuditDatabase } from './database.service.js';

@Controller()
export class HealthController {
  constructor(private readonly database: AuditDatabase) {}

  @Get('health/live')
  live(): Record<string, string> {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async ready(): Promise<Record<string, string>> {
    await this.database.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
