import { z } from 'zod';
import type { EmergencySummary, SourceLabelSchema } from '@kofa/contracts';

const FhirIdSchema = z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/);
const ReferenceSchema = z.object({ reference: z.string().min(1).max(256) }).passthrough();
const CodingSchema = z
  .object({
    system: z.string().url().optional(),
    code: z.string().min(1).max(128),
    display: z.string().max(500).optional(),
  })
  .passthrough();
const CodeableConceptSchema = z
  .object({
    text: z.string().max(1000).optional(),
    coding: z.array(CodingSchema).max(50).optional(),
  })
  .refine(
    (value) => Boolean(value.text || value.coding?.length),
    'CodeableConcept needs text or coding',
  )
  .passthrough();
const base = { id: FhirIdSchema, meta: z.record(z.string(), z.unknown()).optional() };

export const SupportedFhirResourceSchema = z.discriminatedUnion('resourceType', [
  z
    .object({
      ...base,
      resourceType: z.literal('Patient'),
      active: z.boolean().optional(),
      name: z
        .array(
          z
            .object({ family: z.string().optional(), given: z.array(z.string()).optional() })
            .passthrough(),
        )
        .min(1),
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('Condition'),
      subject: ReferenceSchema,
      code: CodeableConceptSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('Observation'),
      status: z.string().min(1),
      subject: ReferenceSchema,
      code: CodeableConceptSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('MedicationRequest'),
      status: z.string().min(1),
      intent: z.string().min(1),
      subject: ReferenceSchema,
      medicationCodeableConcept: CodeableConceptSchema.optional(),
      medicationReference: ReferenceSchema.optional(),
    })
    .refine(
      (value) => Boolean(value.medicationCodeableConcept || value.medicationReference),
      'MedicationRequest needs a medication',
    )
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('AllergyIntolerance'),
      patient: ReferenceSchema,
      code: CodeableConceptSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('Procedure'),
      status: z.string().min(1),
      subject: ReferenceSchema,
      code: CodeableConceptSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('Encounter'),
      status: z.string().min(1),
      class: CodingSchema,
      subject: ReferenceSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('DiagnosticReport'),
      status: z.string().min(1),
      code: CodeableConceptSchema,
      subject: ReferenceSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('CarePlan'),
      status: z.string().min(1),
      intent: z.string().min(1),
      subject: ReferenceSchema,
    })
    .passthrough(),
  z
    .object({
      ...base,
      resourceType: z.literal('Coverage'),
      status: z.string().min(1),
      beneficiary: ReferenceSchema,
    })
    .passthrough(),
]);

export function resourcePatientReference(
  resource: z.infer<typeof SupportedFhirResourceSchema>,
): string | undefined {
  if (resource.resourceType === 'Patient') return `Patient/${resource.id}`;
  if (resource.resourceType === 'AllergyIntolerance') return resource.patient.reference;
  if (resource.resourceType === 'Coverage') return resource.beneficiary.reference;
  return resource.subject.reference;
}

type SourceLabel = z.infer<typeof SourceLabelSchema>;
type StoredResource = {
  resourceType: string;
  resource: unknown;
  sourceLabel: SourceLabel;
  updatedAt: Date;
};

const fieldResourceTypes: Readonly<Record<string, readonly string[]>> = {
  demographics: ['Patient'],
  conditions: ['Condition'],
  deepClinicalHistory: ['Encounter', 'Procedure', 'CarePlan'],
  medications: ['MedicationRequest', 'AllergyIntolerance'],
  labs: ['Observation', 'DiagnosticReport'],
  sensitiveFlags: ['Condition', 'Observation'],
  billing: ['Coverage'],
};

export function projectResources(
  resources: readonly StoredResource[],
  fields: readonly string[],
): unknown[] {
  const allowedTypes = new Set(fields.flatMap((field) => fieldResourceTypes[field] ?? []));
  const allowSensitive = fields.includes('sensitiveFlags');
  return resources
    .filter((stored) => allowedTypes.has(stored.resourceType))
    .filter((stored) => allowSensitive || !isSensitive(stored.resource))
    .map((stored) => ({
      ...(stored.resource as Record<string, unknown>),
      _kofa: { source: stored.sourceLabel, updatedAt: stored.updatedAt.toISOString() },
    }));
}

export function buildEmergencySummary(input: {
  patient: { id: string; displayName: string; birthDate: Date | null };
  resources: readonly StoredResource[];
  facilityName: string;
  issuedAt: Date;
  expiresAt: Date;
}): EmergencySummary {
  const sourced = (stored: StoredResource, value: string) => ({
    value,
    source: stored.sourceLabel,
    updatedAt: stored.updatedAt.toISOString(),
  });
  const byType = (type: string) => input.resources.filter((item) => item.resourceType === type);
  const allergiesReactions = byType('AllergyIntolerance').map((item) =>
    sourced(item, display(item.resource)),
  );
  const currentMedications = byType('MedicationRequest')
    .filter((item) => readStatus(item.resource) === 'active')
    .map((item) => sourced(item, display(item.resource)));
  const transfusionHistory = byType('Procedure')
    .filter((item) => hasKofaTag(item.resource, 'transfusion'))
    .map((item) => sourced(item, display(item.resource)));
  const keyComplications = byType('Condition')
    .filter((item) => hasKofaTag(item.resource, 'key-complication'))
    .map((item) => sourced(item, display(item.resource)));
  const genotypeItem = byType('Observation').find((item) => hasKofaTag(item.resource, 'genotype'));
  const baselineItem = byType('Observation').find((item) =>
    hasKofaTag(item.resource, 'baseline-haemoglobin'),
  );
  const analgesiaItem = byType('CarePlan').find((item) =>
    hasKofaTag(item.resource, 'personalised-analgesia'),
  );
  const patientResource = byType('Patient')[0];

  const result: EmergencySummary = {
    patient: {
      id: input.patient.id,
      displayName: input.patient.displayName,
      ...(input.patient.birthDate
        ? { birthDate: input.patient.birthDate.toISOString().slice(0, 10) }
        : {}),
    },
    allergiesReactions,
    currentMedications,
    transfusionHistory,
    keyComplications,
    homeFacility: {
      value: input.facilityName,
      source: 'HOSPITAL_VERIFIED',
      updatedAt: input.issuedAt.toISOString(),
    },
    issuedAt: input.issuedAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
  };
  if (genotypeItem) {
    const genotype = readKofaValue(genotypeItem.resource);
    if (genotype === 'HbSS' || genotype === 'HbSC' || genotype === 'HbS_BETA_THAL') {
      result.genotype = {
        value: genotype,
        source: genotypeItem.sourceLabel,
        updatedAt: genotypeItem.updatedAt.toISOString(),
      };
    }
  }
  if (baselineItem)
    result.baselineHaemoglobin = sourced(baselineItem, readKofaValue(baselineItem.resource));
  if (analgesiaItem)
    result.personalisedAnalgesiaNote = sourced(
      analgesiaItem,
      readKofaValue(analgesiaItem.resource),
    );
  if (patientResource) {
    const emergencyContact = readKofaExtension(patientResource.resource, 'emergency-contact');
    if (emergencyContact) result.emergencyContact = sourced(patientResource, emergencyContact);
  }
  return result;
}

function isSensitive(resource: unknown): boolean {
  const value = resource as Record<string, unknown>;
  const meta = value.meta as Record<string, unknown> | undefined;
  const security = meta?.security;
  return (
    Array.isArray(security) &&
    security.some((item) => {
      const coding = item as Record<string, unknown>;
      return coding.code === 'R' || coding.code === 'V' || coding.code === 'KOFASENSITIVE';
    })
  );
}

function display(resource: unknown): string {
  const value = resource as Record<string, unknown>;
  const code = value.code as Record<string, unknown> | undefined;
  const medication = value.medicationCodeableConcept as Record<string, unknown> | undefined;
  return (
    stringValue(code?.text) ??
    firstCodingDisplay(code) ??
    stringValue(medication?.text) ??
    firstCodingDisplay(medication) ??
    'Recorded item'
  );
}

function firstCodingDisplay(value?: Record<string, unknown>): string | undefined {
  const coding = value?.coding;
  if (!Array.isArray(coding)) return undefined;
  const first = coding[0] as Record<string, unknown> | undefined;
  return stringValue(first?.display) ?? stringValue(first?.code);
}

function hasKofaTag(resource: unknown, tag: string): boolean {
  return readKofaExtension(resource, 'summary-category') === tag;
}

function readKofaValue(resource: unknown): string {
  return readKofaExtension(resource, 'summary-value') ?? display(resource);
}

function readKofaExtension(resource: unknown, name: string): string | undefined {
  const extensions = (resource as Record<string, unknown>).extension;
  if (!Array.isArray(extensions)) return undefined;
  const extension = extensions.find(
    (item) =>
      (item as Record<string, unknown>).url ===
      `https://kofa.health/fhir/StructureDefinition/${name}`,
  ) as Record<string, unknown> | undefined;
  return stringValue(extension?.valueString) ?? stringValue(extension?.valueCode);
}

function readStatus(resource: unknown): string | undefined {
  return stringValue((resource as Record<string, unknown>).status);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}
