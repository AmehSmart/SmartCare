import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module.js';
import { loadAuditConfig } from './config.js';
import { InternalExceptionFilter } from './exception.filter.js';

async function bootstrap(): Promise<void> {
  const config = loadAuditConfig();
  const tls =
    config.AUDIT_MTLS_CA && config.AUDIT_MTLS_CERT && config.AUDIT_MTLS_KEY
      ? {
          ca: Buffer.from(config.AUDIT_MTLS_CA, 'base64'),
          cert: Buffer.from(config.AUDIT_MTLS_CERT, 'base64'),
          key: Buffer.from(config.AUDIT_MTLS_KEY, 'base64'),
          requestCert: true,
          rejectUnauthorized: true,
        }
      : undefined;
  const adapter = new FastifyAdapter({
    logger: { level: config.LOG_LEVEL },
    bodyLimit: 256 * 1024,
    ...(tls ? { https: tls } : {}),
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  await app.register(helmet, { contentSecurityPolicy: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new InternalExceptionFilter());
  app.enableVersioning({ type: VersioningType.URI });
  app.enableShutdownHooks();
  await app.listen(config.AUDIT_PORT, '0.0.0.0');
  Logger.log(`Audit service listening on ${config.AUDIT_PORT}`, 'Bootstrap');
}

void bootstrap();
