import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { ClinicalDatabase } from './database.service.js';
import { Public } from './auth/public.decorator.js';

collectDefaultMetrics({ prefix: 'kofa_api_' });

@Controller()
export class HealthController {
  constructor(private readonly database: ClinicalDatabase) {}

  @Public()
  @Get('health/live')
  live(): Record<string, string> {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  async ready(): Promise<Record<string, string>> {
    await this.database.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }

  @Public()
  @Get('metrics')
  @Header('content-type', register.contentType)
  metrics(): Promise<string> {
    return register.metrics();
  }
}
