import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsentGrantRequestSchema, PassportEnvelopeSchema } from '@kofa/contracts';
import { createPassport, keyPairFromSeed, verifyPassport } from '@kofa/passport-browser';
import type { z } from 'zod';
import { AuditClient } from '../audit/audit.client.js';
import type { RequestPrincipal } from '../auth/auth.types.js';
import { ClinicalService } from '../clinical/clinical.service.js';
import { loadApiConfig } from '../config.js';
import { ContextService } from '../context/context.service.js';
import { ClinicalDatabase } from '../database.service.js';
import { NotificationService } from '../notifications/notification.service.js';

type GrantRequest = z.infer<typeof ConsentGrantRequestSchema>;

@Injectable()
export class PassportService {
  private readonly config = loadApiConfig();
  private readonly signingKeys = keyPairFromSeed(
    Buffer.from(this.config.PASSPORT_SIGNING_PRIVATE_KEY, 'base64'),
  );

  constructor(
    private readonly database: ClinicalDatabase,
    private readonly context: ContextService,
    private readonly clinical: ClinicalService,
    private readonly audit: AuditClient,
    private readonly notifications: NotificationService,
  ) {}

  publicKey(): { keyId: string; algorithm: 'Ed25519'; publicKey: string } {
    return {
      keyId: this.config.PASSPORT_SIGNING_KEY_ID,
      algorithm: 'Ed25519',
      publicKey: Buffer.from(this.signingKeys.publicKey).toString('base64url'),
    };
  }

  async grant(principal: RequestPrincipal, input: GrantRequest): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const caregiver = await this.context.isCaregiver(actor.userId, input.patientId);
    if (actor.patientId !== input.patientId && !caregiver) {
      throw new ForbiddenException('Only the patient or linked caregiver can create this passport');
    }
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const tokenId = randomUUID();
    const grant = await this.database.consentGrant.create({
      data: { patientId: input.patientId, createdById: actor.userId, tokenId, expiresAt },
      include: { patient: { include: { facility: true } } },
    });
    const summary = await this.clinical.emergencySummary(input.patientId, expiresAt);
    const token = createPassport({
      claims: {
        tokenId,
        grantId: grant.id,
        issuer: grant.patient.facility.code,
        audience: 'kofa-emergency-summary',
        issuedAt: grant.createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        summary,
      },
      pin: input.pin,
      keyId: this.config.PASSPORT_SIGNING_KEY_ID,
      signingSecretKey: this.signingKeys.secretKey,
    });
    if (token.length > 2_953) {
      await this.database.consentGrant.update({
        where: { id: grant.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      throw new BadRequestException('Emergency summary exceeds the single-QR payload budget');
    }
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        caregiver ? 'CAREGIVER' : 'PATIENT',
        'CREATE_CONSENT_GRANT',
        'GRANT',
        input.patientId,
        { grantId: grant.id, expiresAt: expiresAt.toISOString() },
        `consent-create:${grant.id}`,
        { purposeOfUse: 'PATIENT_CONSENT' },
      ),
    );
    return { grantId: grant.id, token, expiresAt: expiresAt.toISOString(), key: this.publicKey() };
  }

  async use(
    principal: RequestPrincipal,
    token: string,
    pin: string,
    idempotencyKey: string,
  ): Promise<unknown> {
    const actor = await this.context.requireRole(principal, ['DOCTOR', 'NURSE', 'LOCUM_DOCTOR']);
    const outer = PassportEnvelopeSchema.parse(
      JSON.parse(Buffer.from(token, 'base64url').toString('utf8')),
    );
    if (outer.keyId !== this.config.PASSPORT_SIGNING_KEY_ID)
      throw new BadRequestException('Unknown passport signing key');
    const verified = verifyPassport({ token, pin, publicKey: this.signingKeys.publicKey });
    const grant = await this.database.consentGrant.findUnique({
      where: { id: verified.claims.grantId },
    });
    if (!grant || grant.tokenId !== verified.claims.tokenId)
      throw new NotFoundException('Consent grant not found');
    if (grant.status !== 'ACTIVE' || grant.revokedAt || grant.expiresAt <= new Date()) {
      throw new ForbiddenException('Consent grant has been revoked or expired');
    }
    const receipt = await this.audit.append(
      this.clinical.auditInput(
        actor,
        actor.role!,
        'USE_PASSPORT',
        'EMERGENCY',
        grant.patientId,
        { grantId: grant.id, offlineVerified: false },
        idempotencyKey,
        { purposeOfUse: 'PATIENT_CONSENT' },
      ),
    );
    await this.notifications.notifyPatient(
      grant.patientId,
      'PASSPORT_ACCESS',
      'Emergency passport viewed',
      {
        actorRole: actor.role!,
        occurredAt: new Date().toISOString(),
        grantId: grant.id,
      },
    );
    return {
      summary: verified.claims.summary,
      verification: { signatureValid: true, onlineStatus: 'ACTIVE', auditReceipt: receipt },
    };
  }

  async revoke(principal: RequestPrincipal, grantId: string): Promise<void> {
    const actor = await this.context.actor(principal);
    const grant = await this.database.consentGrant.findUnique({ where: { id: grantId } });
    if (!grant) throw new NotFoundException('Consent grant not found');
    const caregiver = await this.context.isCaregiver(actor.userId, grant.patientId);
    if (actor.patientId !== grant.patientId && !caregiver)
      throw new ForbiddenException('Not permitted to revoke this grant');
    await this.database.consentGrant.update({
      where: { id: grantId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.audit.append(
      this.clinical.auditInput(
        actor,
        caregiver ? 'CAREGIVER' : 'PATIENT',
        'REVOKE_CONSENT_GRANT',
        'GRANT',
        grant.patientId,
        { grantId },
        `consent-revoke:${grantId}`,
        { purposeOfUse: 'PATIENT_CONSENT' },
      ),
    );
  }

  async list(principal: RequestPrincipal, patientId: string): Promise<unknown> {
    const actor = await this.context.actor(principal);
    const caregiver = await this.context.isCaregiver(actor.userId, patientId);
    if (actor.patientId !== patientId && !caregiver) {
      throw new ForbiddenException('Only the patient or linked caregiver can list these grants');
    }
    return {
      items: await this.database.consentGrant.findMany({
        where: { patientId },
        select: {
          id: true,
          scope: true,
          status: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
}
