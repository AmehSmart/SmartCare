import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OfflineSyncSchema } from '@kofa/contracts';
import type { AuditReceipt } from '@kofa/contracts';
import { canonicalJson } from '@kofa/core';
import nacl from 'tweetnacl';
import type { z } from 'zod';
import { AuditClient } from '../audit/audit.client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ClinicalService } from '../clinical/clinical.service.js';
import { projectResources } from '../clinical/fhir.js';
import { ContextService } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';
import { PolicyService } from '../policy/policy.service.js';

type OfflineSync = z.infer<typeof OfflineSyncSchema>;

@Injectable()
export class OfflineService {
  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
    private readonly policy: PolicyService,
    private readonly clinical: ClinicalService,
    private readonly audit: AuditClient,
  ) {}

  async register(
    principal: RequestPrincipal,
    input: { name: string; signingPublicKey: string; encryptionPublicKey: string },
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['DOCTOR', 'NURSE', 'LOCUM_DOCTOR']);
    assertPublicKey(input.signingPublicKey);
    assertPublicKey(input.encryptionPublicKey);
    const device = await this.database.registeredDevice.create({
      data: { userId: actor.userId, ...input },
    });
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        actor.role!,
        'REGISTER_OFFLINE_DEVICE',
        'GRANT',
        undefined,
        { deviceId: device.id, status: 'PENDING' },
        `device-register:${device.id}`,
        { purposeOfUse: 'SECURITY' },
      ),
    );
    return { id: device.id, status: device.status };
  }

  async issueCache(
    principal: RequestPrincipal,
    deviceId: string,
    patientIds: string[],
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['DOCTOR', 'NURSE', 'LOCUM_DOCTOR']);
    const device = await this.database.registeredDevice.findFirst({
      where: { id: deviceId, userId: actor.userId, status: 'ACTIVE' },
    });
    if (!device) throw new NotFoundException('Active registered device not found');
    const uniqueIds = [...new Set(patientIds)].slice(0, 20);
    const decisions = await Promise.all(
      uniqueIds.map(async (patientId) => ({
        patientId,
        decision: await this.policy.decide(actor, patientId, 'READ_CHART'),
      })),
    );
    if (decisions.some((item) => !item.decision.allowed))
      throw new ForbiddenException('Requested cache contains a patient outside current scope');
    const expiresAt = new Date(
      Math.min(Date.now() + 4 * 60 * 60 * 1000, Date.now() + 8 * 60 * 60 * 1000),
    );
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        actor.role!,
        'ISSUE_OFFLINE_CACHE',
        'GRANT',
        undefined,
        { deviceId, patientCount: uniqueIds.length, expiresAt: expiresAt.toISOString() },
        `cache-issue:${deviceId}:${Date.now()}`,
        { purposeOfUse: 'OPERATIONS' },
      ),
    );
    const payload = await Promise.all(
      decisions.map(async ({ patientId, decision }) => {
        const [patient, resources] = await Promise.all([
          this.database.patient.findUniqueOrThrow({
            where: { id: patientId },
            select: { id: true, displayName: true, birthDate: true, currentWardId: true },
          }),
          this.database.fhirResource.findMany({ where: { patientId } }),
        ]);
        return { patient, resources: projectResources(resources, decision.fields) };
      }),
    );
    const encrypted = encryptForDevice(
      canonicalJson({
        version: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        records: payload,
      }),
      device.encryptionPublicKey,
    );
    const serialized = Buffer.from(canonicalJson(encrypted)).toString('base64url');
    const manifest = await this.database.cacheManifest.create({
      data: {
        deviceId,
        assignmentId: actor.assignmentId!,
        encryptedPayload: serialized,
        payloadHash: createHash('sha256').update(serialized).digest('hex'),
        scopePatientIds: uniqueIds,
        expiresAt,
      },
    });
    return {
      manifestId: manifest.id,
      encryptedPayload: serialized,
      payloadHash: manifest.payloadHash,
      expiresAt,
    };
  }

  async sync(principal: RequestPrincipal, input: OfflineSync): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const device = await this.database.registeredDevice.findFirst({
      where: { id: input.deviceId, userId: actor.userId, status: 'ACTIVE' },
    });
    if (!device) throw new NotFoundException('Active registered device not found');
    const events = [...input.events].sort((left, right) =>
      Number(BigInt(left.sequence) - BigInt(right.sequence)),
    );
    let expected = device.lastSequence + 1n;
    for (const event of events) {
      if (BigInt(event.sequence) !== expected)
        throw new ConflictException(`Offline event sequence gap; expected ${expected}`);
      const manifest = await this.database.cacheManifest.findFirst({
        where: { id: event.manifestId, deviceId: device.id },
      });
      if (!manifest)
        throw new ForbiddenException('Offline event references an unknown cache manifest');
      const occurredAt = new Date(event.occurredAt);
      if (occurredAt < manifest.issuedAt || occurredAt > manifest.expiresAt)
        throw new ForbiddenException('Offline access occurred outside cache validity');
      const scope = manifest.scopePatientIds as string[];
      if (!scope.includes(event.patientRef))
        throw new ForbiddenException('Offline event patient was outside cached scope');
      const { signature, ...signed } = event;
      const valid = nacl.sign.detached.verify(
        Buffer.from(canonicalJson(signed)),
        Buffer.from(signature, 'base64url'),
        Buffer.from(device.signingPublicKey, 'base64url'),
      );
      if (!valid) throw new ForbiddenException('Offline event signature is invalid');
      expected += 1n;
    }
    const receipts: Array<{ event: OfflineSync['events'][number]; receipt: AuditReceipt }> = [];
    for (const event of events) {
      const receipt = await this.audit.append(
        this.clinical.auditInput(
          actor,
          this.clinical.actorRole(actor),
          event.action,
          'GRANT',
          event.patientRef,
          {
            deviceId: device.id,
            manifestId: event.manifestId,
            offline: true,
            deviceSequence: event.sequence,
            syncedAt: new Date().toISOString(),
          },
          event.idempotencyKey,
        ),
      );
      receipts.push({ event, receipt });
    }
    await this.database.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ last_sequence: bigint }>>`
        SELECT last_sequence FROM registered_devices WHERE id = ${device.id}::uuid FOR UPDATE
      `;
      if (locked[0]?.last_sequence !== device.lastSequence)
        throw new ConflictException('Device sequence changed during synchronization');
      for (const { event, receipt } of receipts) {
        await transaction.offlineEvent.upsert({
          where: { idempotencyKey: event.idempotencyKey },
          create: {
            deviceId: device.id,
            idempotencyKey: event.idempotencyKey,
            sequence: BigInt(event.sequence),
            occurredAt: new Date(event.occurredAt),
            payload: event,
            signature: event.signature,
            auditEventId: receipt.id,
          },
          update: { auditEventId: receipt.id },
        });
      }
      await transaction.registeredDevice.update({
        where: { id: device.id },
        data: { lastSequence: expected - 1n },
      });
    });
    return {
      accepted: receipts.length,
      lastSequence: (expected - 1n).toString(),
      receipts: receipts.map((item) => item.receipt),
    };
  }
}

function assertPublicKey(value: string): void {
  if (Buffer.from(value, 'base64url').byteLength !== 32)
    throw new Error('Device public keys must be 32-byte base64url values');
}

function encryptForDevice(
  plaintext: string,
  publicKeyValue: string,
): Record<string, string | number> {
  const recipientKey = Buffer.from(publicKeyValue, 'base64url');
  const ephemeral = nacl.box.keyPair();
  const nonce = randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(Buffer.from(plaintext), nonce, recipientKey, ephemeral.secretKey);
  return {
    version: 1,
    ephemeralPublicKey: Buffer.from(ephemeral.publicKey).toString('base64url'),
    nonce: nonce.toString('base64url'),
    ciphertext: Buffer.from(ciphertext).toString('base64url'),
  };
}
