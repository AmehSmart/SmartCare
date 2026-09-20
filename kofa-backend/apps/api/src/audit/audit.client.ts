import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AuditAppendSchema,
  AuditReceiptSchema,
  type AuditAppend,
  type AuditReceipt,
} from '@kofa/contracts';
import { loadApiConfig } from '../config.js';
import { Agent, fetch } from 'undici';

@Injectable()
export class AuditClient {
  private readonly config = loadApiConfig();
  private readonly dispatcher =
    this.config.AUDIT_MTLS_CA && this.config.AUDIT_MTLS_CERT && this.config.AUDIT_MTLS_KEY
      ? new Agent({
          connect: {
            ca: Buffer.from(this.config.AUDIT_MTLS_CA, 'base64').toString('utf8'),
            cert: Buffer.from(this.config.AUDIT_MTLS_CERT, 'base64').toString('utf8'),
            key: Buffer.from(this.config.AUDIT_MTLS_KEY, 'base64').toString('utf8'),
            rejectUnauthorized: true,
          },
        })
      : undefined;

  append(input: AuditAppend, signal?: AbortSignal): Promise<AuditReceipt> {
    return this.request(
      '/internal/v1/audit/events',
      { method: 'POST', body: AuditAppendSchema.parse(input), signal },
      (value) => AuditReceiptSchema.parse(value),
    );
  }

  verify(actorId: string): Promise<unknown> {
    return this.request('/internal/v1/audit/verify', { method: 'POST', actorId }, (value) => value);
  }

  latestCheckpoint(): Promise<unknown> {
    return this.request(
      '/internal/v1/audit/checkpoints/latest',
      { method: 'GET' },
      (value) => value,
    );
  }

  listEvents(query: string, facilityId: string): Promise<unknown> {
    const separator = query.includes('?') ? '&' : '?';
    return this.request(
      `/internal/v1/audit/events${query}${separator}facilityId=${encodeURIComponent(facilityId)}`,
      { method: 'GET' },
      (value) => value,
    );
  }

  listFlags(facilityId: string): Promise<unknown> {
    return this.request(
      `/internal/v1/audit/flags?facilityId=${encodeURIComponent(facilityId)}`,
      { method: 'GET' },
      (value) => value,
    );
  }

  patientEvents(facilityId: string, patientRef: string): Promise<unknown> {
    return this.request(
      `/internal/v1/audit/patient-events/${encodeURIComponent(patientRef)}?facilityId=${encodeURIComponent(facilityId)}`,
      { method: 'GET' },
      (value) => value,
    );
  }

  reviewFlag(id: string, facilityId: string, actorId: string, body: unknown): Promise<unknown> {
    return this.request(
      `/internal/v1/audit/flags/${encodeURIComponent(id)}?facilityId=${encodeURIComponent(facilityId)}`,
      { method: 'PATCH', actorId, body },
      (value) => value,
    );
  }

  private async request<T>(
    path: string,
    options: { method: string; body?: unknown; actorId?: string; signal?: AbortSignal },
    parse: (value: unknown) => T,
  ): Promise<T> {
    // The audit service can be cold (serverless/free tier) and take a while to
    // wake. Retry transient failures (network, timeout, 5xx) with backoff so the
    // first request does not fail with 503. Appends carry an idempotency key, so
    // retries never double-write. Client errors (4xx) are not retried.
    const attemptTimeouts = [12_000, 20_000, 25_000];
    let lastError: unknown;
    for (let attempt = 0; attempt < attemptTimeouts.length; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), attemptTimeouts[attempt]);
      const signal = options.signal
        ? AbortSignal.any([options.signal, controller.signal])
        : controller.signal;
      try {
        const response = await fetch(new URL(path, this.config.AUDIT_SERVICE_URL), {
          method: options.method,
          headers: {
            authorization: `Bearer ${this.config.AUDIT_SERVICE_TOKEN}`,
            'content-type': 'application/json',
            ...(options.actorId ? { 'x-kofa-actor': options.actorId } : {}),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal,
          ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
        });
        if (response.ok) return parse(await response.json());
        if (response.status >= 400 && response.status < 500) {
          // Real client error (auth/validation) - do not retry.
          throw new ServiceUnavailableException('Required audit evidence could not be committed', {
            cause: new Error(`Audit service returned ${response.status}`),
          });
        }
        lastError = new Error(`Audit service returned ${response.status}`);
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < attemptTimeouts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      }
    }
    throw new ServiceUnavailableException('Required audit evidence could not be committed', {
      cause: lastError,
    });
  }
}
