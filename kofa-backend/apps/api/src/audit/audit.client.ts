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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
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
      if (!response.ok) throw new Error(`Audit service returned ${response.status}`);
      return parse(await response.json());
    } catch (error) {
      throw new ServiceUnavailableException('Required audit evidence could not be committed', {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
