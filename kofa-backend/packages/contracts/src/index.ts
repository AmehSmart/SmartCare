import { z } from 'zod';

export const roles = [
  'PATIENT',
  'CAREGIVER',
  'DOCTOR',
  'NURSE',
  'RECORDS_CLERK',
  'LOCUM_DOCTOR',
  'LAB_PHARMACY',
  'AUDIT_OFFICER',
  'ADMIN',
] as const;
export const RoleSchema = z.enum(roles);
export type Role = z.infer<typeof RoleSchema>;

export const auditDecisions = ['GRANT', 'DENY', 'EMERGENCY', 'ERROR'] as const;
export const AuditDecisionSchema = z.enum(auditDecisions);

export const PurposeOfUseSchema = z.enum([
  'TREATMENT',
  'BTG',
  'ETREAT',
  'PATIENT_CONSENT',
  'OPERATIONS',
  'SECURITY',
]);

const SafeContextValueSchema = z.union([z.string().max(512), z.number(), z.boolean(), z.null()]);

export const AuditAppendSchema = z
  .object({
    occurredAt: z.iso.datetime(),
    actorId: z.string().min(1).max(128),
    actorRole: RoleSchema,
    facilityId: z.uuid().optional(),
    patientRef: z.uuid().optional(),
    action: z.string().min(1).max(128),
    resourceType: z.string().max(64).optional(),
    decision: AuditDecisionSchema,
    purposeOfUse: PurposeOfUseSchema,
    reasonCode: z.string().min(1).max(64).optional(),
    reasonText: z.string().min(1).max(500).optional(),
    context: z.record(z.string(), SafeContextValueSchema).default({}),
    idempotencyKey: z.string().min(16).max(128),
  })
  .strict();
export type AuditAppend = z.infer<typeof AuditAppendSchema>;

export const AuditReceiptSchema = z.object({
  id: z.uuid(),
  sequence: z.string().regex(/^\d+$/),
  recordedAt: z.iso.datetime(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AuditReceipt = z.infer<typeof AuditReceiptSchema>;

export const DutyContextSelectionSchema = z.object({ assignmentId: z.uuid() }).strict();

export const PatientQuerySchema = z.object({
  query: z.string().trim().max(120).default(''),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const BreakGlassRequestSchema = z
  .object({
    totp: z.string().regex(/^\d{6}$/),
    reasonCode: z.enum(['UNCONSCIOUS_PATIENT', 'VOC_CRISIS', 'IMMEDIATE_THREAT_TO_LIFE', 'OTHER']),
    reasonText: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().min(16).max(128),
  })
  .superRefine((value, context) => {
    if (value.reasonCode === 'OTHER' && !value.reasonText) {
      context.addIssue({
        code: 'custom',
        path: ['reasonText'],
        message: 'reasonText is required when reasonCode is OTHER',
      });
    }
  });

export const ConsentGrantRequestSchema = z.object({
  patientId: z.uuid(),
  pin: z.string().min(6).max(64),
  expiresInSeconds: z.number().int().min(60).max(86_400),
});

export const PassportEnvelopeSchema = z
  .object({
    version: z.literal(1),
    keyId: z.string().min(1).max(128),
    salt: z.string().min(1),
    nonce: z.string().min(1),
    ciphertext: z.string().min(1),
  })
  .strict();

export const SourceLabelSchema = z.enum([
  'PATIENT_ENTERED',
  'DOCUMENT_BACKED',
  'HOSPITAL_VERIFIED',
]);

export const SourcedValueSchema = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    source: SourceLabelSchema,
    updatedAt: z.iso.datetime(),
  });

export const EmergencySummarySchema = z
  .object({
    patient: z.object({
      id: z.uuid(),
      displayName: z.string().min(1).max(200),
      birthDate: z.string().date().optional(),
    }),
    genotype: SourcedValueSchema(z.enum(['HbSS', 'HbSC', 'HbS_BETA_THAL'])).optional(),
    allergiesReactions: z.array(SourcedValueSchema(z.string().max(500))).max(50),
    currentMedications: z.array(SourcedValueSchema(z.string().max(500))).max(100),
    transfusionHistory: z.array(SourcedValueSchema(z.string().max(500))).max(100),
    keyComplications: z.array(SourcedValueSchema(z.string().max(500))).max(50),
    baselineHaemoglobin: SourcedValueSchema(z.string().max(100)).optional(),
    personalisedAnalgesiaNote: SourcedValueSchema(z.string().max(1000)).optional(),
    homeFacility: SourcedValueSchema(z.string().max(500)),
    emergencyContact: SourcedValueSchema(z.string().max(500)).optional(),
    issuedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type EmergencySummary = z.infer<typeof EmergencySummarySchema>;

export const OfflineEventSchema = z.object({
  idempotencyKey: z.string().min(16).max(128),
  sequence: z.string().regex(/^[1-9]\d*$/),
  occurredAt: z.iso.datetime(),
  manifestId: z.uuid(),
  patientRef: z.uuid(),
  action: z.enum(['READ_CACHED_CHART', 'READ_CACHED_EMERGENCY_SUMMARY']),
  signature: z.string().min(1),
});

export const OfflineSyncSchema = z.object({
  deviceId: z.uuid(),
  events: z.array(OfflineEventSchema).min(1).max(500),
});

export type AuthenticatedPrincipal = {
  subject: string;
  sessionId: string;
  roles: Role[];
  tokenExpiresAt: Date;
};
