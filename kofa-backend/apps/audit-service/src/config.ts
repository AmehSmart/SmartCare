import { z } from 'zod';

const AuditConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AUDIT_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  AUDIT_DATABASE_URL: z.string().url(),
  AUDIT_SERVICE_TOKEN: z.string().min(32),
  AUDIT_CHECKPOINT_SIGNING_KEY: z.string().min(1),
  AUDIT_MTLS_CA: z.string().min(1).optional(),
  AUDIT_MTLS_CERT: z.string().min(1).optional(),
  AUDIT_MTLS_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type AuditConfig = z.infer<typeof AuditConfigSchema>;

export function loadAuditConfig(environment: NodeJS.ProcessEnv = process.env): AuditConfig {
  const config = AuditConfigSchema.parse(environment);
  if (Buffer.from(config.AUDIT_CHECKPOINT_SIGNING_KEY, 'base64').byteLength !== 32) {
    throw new Error('AUDIT_CHECKPOINT_SIGNING_KEY must be a base64-encoded 32-byte seed');
  }
  if (
    config.NODE_ENV === 'production' &&
    (!config.AUDIT_MTLS_CA || !config.AUDIT_MTLS_CERT || !config.AUDIT_MTLS_KEY)
  ) {
    throw new Error('Production requires audit-service mTLS CA, certificate, and private key');
  }
  return config;
}
