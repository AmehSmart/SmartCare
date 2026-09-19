import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/http-exception.filter.js';
import { loadApiConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig();
  const adapter = new FastifyAdapter({
    trustProxy: config.TRUST_PROXY === 'true',
    bodyLimit: 1024 * 1024,
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.body.pin', 'req.body.totp', 'req.body.token'],
    },
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS.split(',').map((item) => item.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Kofa API')
    .setDescription(
      'Role, ward and duty-scoped patient record access with audited emergency access.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });

  await app.listen(config.API_PORT, '0.0.0.0');
  Logger.log(`Kofa API listening on ${config.API_PORT}`, 'Bootstrap');
}

void bootstrap();
