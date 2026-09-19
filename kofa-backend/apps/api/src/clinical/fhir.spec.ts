import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildEmergencySummary, projectResources, SupportedFhirResourceSchema } from './fhir.js';

const updatedAt = new Date('2026-09-18T10:00:00.000Z');
const stored = (resourceType: string, resource: unknown) => ({
  resourceType,
  resource,
  sourceLabel: 'HOSPITAL_VERIFIED' as const,
  updatedAt,
});

describe('FHIR projections', () => {
  it('rejects clinical resources without a patient reference', () => {
    expect(() =>
      SupportedFhirResourceSchema.parse({
        resourceType: 'Observation',
        id: 'observation-1',
        status: 'final',
        code: { text: 'Haemoglobin' },
      }),
    ).toThrow();
  });

  it('accepts the supported Observation profile', () => {
    expect(
      SupportedFhirResourceSchema.parse({
        resourceType: 'Observation',
        id: 'observation-1',
        status: 'final',
        subject: { reference: 'Patient/patient-amina-musa' },
        code: { coding: [{ system: 'http://loinc.org', code: '718-7' }] },
      }).resourceType,
    ).toBe('Observation');
  });

  it('redacts sensitive resources unless explicitly projected', () => {
    const sensitive = stored('Condition', {
      resourceType: 'Condition',
      id: 'sensitive',
      meta: { security: [{ code: 'R' }] },
    });
    expect(projectResources([sensitive], ['conditions'])).toHaveLength(0);
    expect(projectResources([sensitive], ['sensitiveFlags'])).toHaveLength(1);
  });

  it('creates a fixed emergency summary without unrelated history', () => {
    const extension = (name: string, valueString: string) => ({
      url: `https://kofa.health/fhir/StructureDefinition/${name}`,
      valueString,
    });
    const summary = buildEmergencySummary({
      patient: { id: randomUUID(), displayName: 'Amina Musa', birthDate: null },
      facilityName: 'ABUTH Zaria',
      issuedAt: updatedAt,
      expiresAt: new Date(updatedAt.getTime() + 60_000),
      resources: [
        stored('Observation', {
          resourceType: 'Observation',
          id: 'genotype',
          extension: [
            extension('summary-category', 'genotype'),
            extension('summary-value', 'HbSS'),
          ],
        }),
        stored('Condition', {
          resourceType: 'Condition',
          id: 'unrelated',
          code: { text: 'Unrelated history' },
        }),
      ],
    });
    expect(summary.genotype?.value).toBe('HbSS');
    expect(JSON.stringify(summary)).not.toContain('Unrelated history');
  });
});
