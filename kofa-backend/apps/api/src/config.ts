import { z } from 'zod';

const ApiConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CLINICAL_DATABASE_URL: z.string().url(),
  AUTH_JWT_SECRET: z.string().min(32),
  AUDIT_SERVICE_URL: z.string().url(),
  AUDIT_SERVICE_TOKEN: z.string().min(32),
  AUDIT_MTLS_CA: z.string().min(1).optional(),
  AUDIT_MTLS_CERT: z.string().min(1).optional(),
  AUDIT_MTLS_KEY: z.string().min(1).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(1),
  TOTP_ENCRYPTION_KEY: z.string().min(1),
  PASSPORT_SIGNING_PRIVATE_KEY: z.string().min(1),
  PASSPORT_SIGNING_KEY_ID: z.string().min(1),
  ALLOWED_ORIGINS: z.string().min(1),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

let cached: ApiConfig | undefined;
export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  if (environment === process.env && cached) return cached;
  const config = ApiConfigSchema.parse(environment);
  for (const name of [
    'FIELD_ENCRYPTION_KEY',
    'TOTP_ENCRYPTION_KEY',
    'PASSPORT_SIGNING_PRIVATE_KEY',
  ] as const) {
    const bytes = Buffer.from(config[name], 'base64');
    if (bytes.byteLength !== 32) throw new Error(`${name} must be a base64-encoded 32-byte key`);
  }
  if (config.NODE_ENV === 'production' && config.AUDIT_SERVICE_URL.startsWith('http://')) {
    throw new Error('AUDIT_SERVICE_URL must use HTTPS in production');
  }
  if (
    config.NODE_ENV === 'production' &&
    (!config.AUDIT_MTLS_CA || !config.AUDIT_MTLS_CERT || !config.AUDIT_MTLS_KEY)
  ) {
    throw new Error('Production requires audit-service mTLS CA, certificate, and private key');
  }
  if (environment === process.env) cached = config;
  return config;
}
