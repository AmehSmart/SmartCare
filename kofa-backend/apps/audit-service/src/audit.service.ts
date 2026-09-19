import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAppendSchema, type AuditAppend, type AuditReceipt } from '@kofa/contracts';
import {
  calculateChainHash,
  canonicalJson,
  GENESIS_HASH,
  keyPairFromSeed,
  verifyChain,
} from '@kofa/core';
import nacl from 'tweetnacl';
import type { Prisma } from '../../../generated/audit/client.js';
import { AuditDatabase } from './database.service.js';
import { loadAuditConfig } from './config.js';

type LockedChainState = { last_sequence: bigint; last_hash: string };

@Injectable()
export class AuditService {
  private readonly checkpointKeys = keyPairFromSeed(
    Buffer.from(loadAuditConfig().AUDIT_CHECKPOINT_SIGNING_KEY, 'base64'),
  );

  constructor(private readonly database: AuditDatabase) {}

  async append(raw: unknown): Promise<AuditReceipt> {
    const input = AuditAppendSchema.parse(raw);
    const event = await this.database.$transaction(
      async (transaction) => {
        const duplicate = await transaction.auditEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (duplicate) return duplicate;

        await transaction.$executeRaw`
          INSERT INTO chain_state (id, last_sequence, last_hash, updated_at)
          VALUES (1, 0, ${GENESIS_HASH}, NOW())
          ON CONFLICT (id) DO NOTHING
        `;
        const states = await transaction.$queryRaw<LockedChainState[]>`
          SELECT last_sequence, last_hash FROM chain_state WHERE id = 1 FOR UPDATE
        `;
        const state = states[0];
        if (!state) throw new Error('Unable to acquire the audit chain head');
        const duplicateAfterLock = await transaction.auditEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (duplicateAfterLock) return duplicateAfterLock;
        const sequence = state.last_sequence + 1n;
        const body = chainBody(input, sequence, state.last_hash);
        const hash = calculateChainHash(body, state.last_hash);
        const created = await transaction.auditEvent.create({
          data: {
            sequence,
            occurredAt: new Date(input.occurredAt),
            actorId: input.actorId,
            actorRole: input.actorRole,
            facilityId: input.facilityId,
            patientRef: input.patientRef,
            action: input.action,
            resourceType: input.resourceType,
            decision: input.decision,
            purposeOfUse: input.purposeOfUse,
            reasonCode: input.reasonCode,
            reasonText: input.reasonText,
            context: input.context,
            idempotencyKey: input.idempotencyKey,
            previousHash: state.last_hash,
            hash,
          },
        });
        await transaction.chainState.update({
          where: { id: 1 },
          data: { lastSequence: sequence, lastHash: hash },
        });
        return created;
      },
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 },
    );
    await this.applyAbuseRules(event.id);
    return {
      id: event.id,
      sequence: event.sequence.toString(),
      recordedAt: event.recordedAt.toISOString(),
      hash: event.hash,
    };
  }

  async verify(requestedBy: string): Promise<Record<string, unknown>> {
    const run = await this.database.verificationRun.create({ data: { requestedBy } });
    const entries = await this.database.auditEvent.findMany({ orderBy: { sequence: 'asc' } });
    const result = verifyChain(
      entries.map((event) => ({
        ...chainBody(fromStored(event), event.sequence, event.previousHash),
        previousHash: event.previousHash,
        hash: event.hash,
      })),
    );
    const checkpoints = await this.database.chainCheckpoint.findMany({
      orderBy: { sequence: 'asc' },
    });
    const checkpointFailure = checkpoints.find((checkpoint) => {
      const referenced = entries.find((event) => event.sequence === checkpoint.sequence);
      return (
        !checkpoint.signature ||
        referenced?.hash !== checkpoint.hash ||
        !nacl.sign.detached.verify(
          Buffer.from(
            checkpointPayload(checkpoint.sequence, checkpoint.hash, checkpoint.eventCount),
          ),
          Buffer.from(checkpoint.signature, 'base64url'),
          this.checkpointKeys.publicKey,
        )
      );
    });
    const valid = result.valid && !checkpointFailure;
    const broken =
      result.firstBrokenIndex === undefined ? undefined : entries[result.firstBrokenIndex];
    await this.database.verificationRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        valid,
        checkedCount: BigInt(result.checkedCount),
        firstBrokenSeq: broken?.sequence,
        expectedHash: result.expectedHash,
        actualHash: result.actualHash,
      },
    });
    let checkpoint: unknown;
    const latest = entries.at(-1);
    if (valid && latest) checkpoint = await this.createCheckpoint(latest.sequence, latest.hash);
    return {
      runId: run.id,
      valid,
      checkedCount: result.checkedCount,
      firstBrokenSequence: broken?.sequence.toString(),
      expectedHash: result.expectedHash,
      actualHash: result.actualHash,
      checkpointFailureSequence: checkpointFailure?.sequence.toString(),
      checkpoint,
      checkpointPublicKey: Buffer.from(this.checkpointKeys.publicKey).toString('base64url'),
    };
  }

  async latestCheckpoint(): Promise<unknown> {
    const checkpoint = await this.database.chainCheckpoint.findFirst({
      orderBy: { sequence: 'desc' },
    });
    return {
      checkpoint: checkpoint ? serializeBigInts(checkpoint) : null,
      algorithm: 'Ed25519',
      publicKey: Buffer.from(this.checkpointKeys.publicKey).toString('base64url'),
    };
  }

  async listEvents(
    limit: number,
    facilityId: string,
    cursor?: bigint,
  ): Promise<Record<string, unknown>> {
    const events = await this.database.auditEvent.findMany({
      take: Math.min(Math.max(limit, 1), 100),
      where: {
        facilityId,
        ...(cursor ? { sequence: { lt: cursor } } : {}),
      },
      orderBy: { sequence: 'desc' },
      include: { flags: true },
    });
    return {
      items: events.map(serializeBigInts),
      nextCursor: events.at(-1)?.sequence.toString(),
    };
  }

  async listFlags(facilityId: string): Promise<unknown[]> {
    const flags = await this.database.abuseFlag.findMany({
      where: { status: 'OPEN', event: { facilityId } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: { event: true },
      take: 100,
    });
    return flags.map(serializeBigInts);
  }

  async patientEvents(facilityId: string, patientRef: string): Promise<unknown[]> {
    const events = await this.database.auditEvent.findMany({
      where: { facilityId, patientRef },
      select: {
        id: true,
        occurredAt: true,
        actorId: true,
        actorRole: true,
        action: true,
        decision: true,
        purposeOfUse: true,
        reasonCode: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
    return events.map(serializeBigInts);
  }

  async reviewFlag(
    id: string,
    facilityId: string,
    reviewer: string,
    status: 'REVIEWED' | 'DISMISSED' | 'ESCALATED',
    disposition?: string,
  ): Promise<unknown> {
    try {
      const allowed = await this.database.abuseFlag.findFirst({
        where: { id, event: { facilityId } },
        select: { id: true },
      });
      if (!allowed) throw new NotFoundException('Audit flag not found');
      return serializeBigInts(
        await this.database.abuseFlag.update({
          where: { id },
          data: { status, reviewedBy: reviewer, reviewedAt: new Date(), disposition },
        }),
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException('Audit flag not found');
    }
  }

  private async applyAbuseRules(eventId: string): Promise<void> {
    const event = await this.database.auditEvent.findUniqueOrThrow({ where: { id: eventId } });
    const flags: Array<{
      ruleCode: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      evidence: Prisma.InputJsonValue;
    }> = [];
    const context = event.context as Record<string, unknown>;
    if (context.wardMismatch === true)
      flags.push({ ruleCode: 'WARD_MISMATCH', severity: 'HIGH', evidence: { eventId } });
    if (context.offShift === true)
      flags.push({ ruleCode: 'OFF_SHIFT_ACCESS', severity: 'HIGH', evidence: { eventId } });
    if (event.action === 'SENSITIVE_REVEAL')
      flags.push({ ruleCode: 'SENSITIVE_REVEAL', severity: 'MEDIUM', evidence: { eventId } });
    if (event.decision === 'EMERGENCY') {
      flags.push({
        ruleCode: 'BREAK_GLASS',
        severity: 'HIGH',
        evidence: { reasonCode: event.reasonCode ?? 'UNKNOWN' },
      });
      const since = new Date(event.occurredAt.getTime() - 86_400_000);
      const count = await this.database.auditEvent.count({
        where: { actorId: event.actorId, decision: 'EMERGENCY', occurredAt: { gte: since } },
      });
      if (count >= 3)
        flags.push({
          ruleCode: 'REPEAT_BREAK_GLASS',
          severity: 'CRITICAL',
          evidence: { count, windowHours: 24 },
        });
    }
    if (event.actorRole === 'RECORDS_CLERK' && event.decision === 'GRANT') {
      const since = new Date(event.occurredAt.getTime() - 600_000);
      const recent = await this.database.auditEvent.findMany({
        where: {
          actorId: event.actorId,
          decision: 'GRANT',
          occurredAt: { gte: since },
          patientRef: { not: null },
        },
        select: { patientRef: true },
      });
      const count = new Set(recent.map((item) => item.patientRef)).size;
      if (count >= 5)
        flags.push({
          ruleCode: 'CLERK_PATIENT_BURST',
          severity: 'CRITICAL',
          evidence: { distinctPatients: count, windowMinutes: 10 },
        });
    }
    if (flags.length) {
      await this.database.abuseFlag.createMany({
        data: flags.map((flag) => ({ ...flag, auditEventId: eventId })),
        skipDuplicates: true,
      });
    }
  }

  private async createCheckpoint(sequence: bigint, hash: string): Promise<unknown> {
    const signature = Buffer.from(
      nacl.sign.detached(
        Buffer.from(checkpointPayload(sequence, hash, sequence)),
        this.checkpointKeys.secretKey,
      ),
    ).toString('base64url');
    return serializeBigInts(
      await this.database.chainCheckpoint.upsert({
        where: { sequence },
        create: { sequence, hash, eventCount: sequence, signature },
        update: { hash, eventCount: sequence, signature },
      }),
    );
  }
}

function checkpointPayload(sequence: bigint, hash: string, eventCount: bigint): string {
  return canonicalJson({
    sequence: sequence.toString(),
    hash,
    eventCount: eventCount.toString(),
  });
}

function chainBody(
  input: AuditAppend,
  sequence: bigint,
  previousHash: string,
): Record<string, unknown> {
  return {
    sequence: sequence.toString(),
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    actorRole: input.actorRole,
    facilityId: input.facilityId,
    patientRef: input.patientRef,
    action: input.action,
    resourceType: input.resourceType,
    decision: input.decision,
    purposeOfUse: input.purposeOfUse,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    context: input.context,
    idempotencyKey: input.idempotencyKey,
    previousHash,
  };
}

function fromStored(event: {
  occurredAt: Date;
  actorId: string;
  actorRole: string;
  facilityId: string | null;
  patientRef: string | null;
  action: string;
  resourceType: string | null;
  decision: string;
  purposeOfUse: string;
  reasonCode: string | null;
  reasonText: string | null;
  context: unknown;
  idempotencyKey: string;
}): AuditAppend {
  return AuditAppendSchema.parse({
    occurredAt: event.occurredAt.toISOString(),
    actorId: event.actorId,
    actorRole: event.actorRole,
    facilityId: event.facilityId ?? undefined,
    patientRef: event.patientRef ?? undefined,
    action: event.action,
    resourceType: event.resourceType ?? undefined,
    decision: event.decision,
    purposeOfUse: event.purposeOfUse,
    reasonCode: event.reasonCode ?? undefined,
    reasonText: event.reasonText ?? undefined,
    context: event.context,
    idempotencyKey: event.idempotencyKey,
  });
}

function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item,
    ),
  ) as T;
}
