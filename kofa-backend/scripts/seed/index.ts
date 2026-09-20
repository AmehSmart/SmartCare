import { randomBytes, scryptSync } from 'node:crypto';
import { encryptEnvelope } from '@kofa/core';
import { PrismaClient, Role, SourceLabel } from '../../generated/clinical/client.js';

const database = new PrismaClient();

const ids = {
  facility: '40000000-0000-4000-8000-000000000001',
  wardA: '41000000-0000-4000-8000-000000000001',
  wardB: '41000000-0000-4000-8000-000000000002',
  ed: '41000000-0000-4000-8000-000000000003',
  cardiology: '42000000-0000-4000-8000-000000000001',
  emergency: '42000000-0000-4000-8000-000000000002',
  medicine: '42000000-0000-4000-8000-000000000003',
  dayShift: '43000000-0000-4000-8000-000000000001',
  nightShift: '43000000-0000-4000-8000-000000000002',
  doctor: '20000000-0000-4000-8000-000000000001',
  nurse: '20000000-0000-4000-8000-000000000002',
  clerk: '20000000-0000-4000-8000-000000000003',
  audit: '20000000-0000-4000-8000-000000000004',
  admin: '20000000-0000-4000-8000-000000000005',
  patientUser: '20000000-0000-4000-8000-000000000006',
  lab: '20000000-0000-4000-8000-000000000007',
  doctor2: '20000000-0000-4000-8000-000000000008',
  doctor3: '20000000-0000-4000-8000-000000000009',
  nurse2: '20000000-0000-4000-8000-000000000010',
  amina: '30000000-0000-4000-8000-000000000001',
  chidi: '30000000-0000-4000-8000-000000000002',
  fatima: '30000000-0000-4000-8000-000000000003',
  ibrahim: '30000000-0000-4000-8000-000000000004',
  grace: '30000000-0000-4000-8000-000000000005',
  tunde: '30000000-0000-4000-8000-000000000006',
  zara: '30000000-0000-4000-8000-000000000007',
  kunle: '30000000-0000-4000-8000-000000000008',
} as const;

async function main(): Promise<void> {
  const demoPasswordHash = hashPassword('KofaDemo!2026');
  await database.facility.upsert({
    where: { id: ids.facility },
    create: {
      id: ids.facility,
      name: 'Ahmadu Bello University Teaching Hospital',
      code: 'ABUTH-ZARIA',
      contact: { phone: '+234-800-000-0000', city: 'Zaria' },
    },
    update: {},
  });
  for (const department of [
    { id: ids.cardiology, name: 'Cardiology', code: 'CARD' },
    { id: ids.emergency, name: 'Emergency Medicine', code: 'EMERG' },
    { id: ids.medicine, name: 'General Medicine', code: 'GENMED' },
  ]) await database.department.upsert({ where: { id: department.id }, create: { ...department, facilityId: ids.facility }, update: department });
  for (const shift of [
    { id: ids.dayShift, name: 'Day Shift', code: 'DAY', startsAt: '08:00', endsAt: '20:00' },
    { id: ids.nightShift, name: 'Night Shift', code: 'NIGHT', startsAt: '20:00', endsAt: '08:00' },
  ]) await database.shift.upsert({ where: { id: shift.id }, create: { ...shift, facilityId: ids.facility }, update: shift });
  for (const ward of [
    { id: ids.wardA, name: 'Cardiology Ward', code: 'WARD-A', departmentId: ids.cardiology },
    { id: ids.wardB, name: 'General Medicine Ward', code: 'WARD-B', departmentId: ids.medicine },
    { id: ids.ed, name: 'Emergency Department', code: 'ED', departmentId: ids.emergency },
  ]) {
    await database.ward.upsert({
      where: { id: ward.id },
      create: { ...ward, facilityId: ids.facility },
      update: ward,
    });
  }

  const patients = [
    {
      id: ids.amina,
      fhirId: 'patient-amina-musa',
      displayName: 'Amina Musa',
      birthDate: new Date('2001-04-12'),
      currentWardId: ids.wardB,
      departmentId: ids.medicine,
    },
    {
      id: ids.chidi,
      fhirId: 'patient-chidi-okafor',
      displayName: 'Chidi Okafor',
      birthDate: new Date('1987-02-03'),
      currentWardId: ids.wardA,
      departmentId: ids.cardiology,
    },
    {
      id: ids.fatima,
      fhirId: 'patient-fatima-bello',
      displayName: 'Fatima Bello',
      birthDate: new Date('1994-11-21'),
      currentWardId: ids.wardA,
      departmentId: ids.cardiology,
    },
    { id: ids.ibrahim, fhirId: 'patient-ibrahim-danladi', displayName: 'Ibrahim Danladi', birthDate: new Date('1972-08-15'), currentWardId: ids.ed, departmentId: ids.emergency },
    { id: ids.grace, fhirId: 'patient-grace-okon', displayName: 'Grace Okon', birthDate: new Date('1982-01-23'), currentWardId: ids.ed, departmentId: ids.emergency },
    { id: ids.tunde, fhirId: 'patient-tunde-ade', displayName: 'Tunde Ade', birthDate: new Date('1991-06-09'), currentWardId: ids.wardB, departmentId: ids.medicine },
    { id: ids.zara, fhirId: 'patient-zara-yakubu', displayName: 'Zara Yakubu', birthDate: new Date('2000-12-01'), currentWardId: ids.wardA, departmentId: ids.cardiology, status: 'DISCHARGED' as const, active: false, dischargedAt: new Date('2026-08-20') },
    { id: ids.kunle, fhirId: 'patient-kunle-oladele', displayName: 'Kunle Oladele', birthDate: new Date('1965-03-28'), currentWardId: ids.wardB, departmentId: ids.medicine, status: 'INACTIVE' as const, active: false },
  ];
  for (const patient of patients) {
    await database.patient.upsert({
      where: { id: patient.id },
      create: { ...patient, facilityId: ids.facility },
      update: patient,
    });
  }

  const users = [
    {
      id: ids.doctor,
      authSubject: '10000000-0000-4000-8000-000000000001',
      displayName: 'Dr Aisha Bello',
      email: 'doctor1@smartcare.test',
    },
    {
      id: ids.nurse,
      authSubject: '10000000-0000-4000-8000-000000000002',
      displayName: 'Maryam Yusuf',
      email: 'nurse1@smartcare.test',
    },
    {
      id: ids.clerk,
      authSubject: '10000000-0000-4000-8000-000000000003',
      displayName: 'Musa Ibrahim',
      email: 'records1@smartcare.test',
    },
    {
      id: ids.audit,
      authSubject: '10000000-0000-4000-8000-000000000004',
      displayName: 'Zainab Garba',
      email: 'zainab@example.test',
    },
    {
      id: ids.admin,
      authSubject: '10000000-0000-4000-8000-000000000005',
      displayName: 'Hauwa Lawal',
      email: 'admin@smartcare.test',
    },
    {
      id: ids.patientUser,
      authSubject: '10000000-0000-4000-8000-000000000006',
      displayName: 'Amina Musa',
      email: 'amina@example.test',
      patientId: ids.amina,
    },
    {
      id: ids.lab,
      authSubject: '10000000-0000-4000-8000-000000000007',
      displayName: 'Ifeanyi Eze',
      email: 'lab1@smartcare.test',
    },
    { id: ids.doctor2, authSubject: '10000000-0000-4000-8000-000000000008', displayName: 'Dr Chukwu Okeke', email: 'doctor2@smartcare.test' },
    { id: ids.doctor3, authSubject: '10000000-0000-4000-8000-000000000009', displayName: 'Dr Sade Adebayo', email: 'doctor3@smartcare.test' },
    { id: ids.nurse2, authSubject: '10000000-0000-4000-8000-000000000010', displayName: 'Nurse Halima Sani', email: 'nurse2@smartcare.test' },
  ];
  for (const user of users) {
    await database.userProfile.upsert({
      where: { id: user.id },
      create: { ...user, facilityId: ids.facility, passwordHash: demoPasswordHash },
      update: {
        displayName: user.displayName,
        email: user.email,
        patientId: user.patientId,
        passwordHash: demoPasswordHash,
      },
    });
  }

  const startsAt = new Date('2020-01-01T00:00:00Z');
  const endsAt = new Date('2035-01-01T00:00:00Z');
  const assignments: Array<{ id: string; userId: string; role: Role; wardId?: string; departmentId?: string; shiftId?: string }> = [
    {
      id: '50000000-0000-4000-8000-000000000001',
      userId: ids.doctor,
      role: Role.DOCTOR,
      wardId: ids.ed,
      departmentId: ids.emergency,
      shiftId: ids.dayShift,
    },
    {
      id: '50000000-0000-4000-8000-000000000002',
      userId: ids.nurse,
      role: Role.NURSE,
      wardId: ids.wardA,
      departmentId: ids.cardiology,
      shiftId: ids.dayShift,
    },
    { id: '50000000-0000-4000-8000-000000000003', userId: ids.clerk, role: Role.RECORDS_CLERK, departmentId: ids.medicine, shiftId: ids.dayShift },
    { id: '50000000-0000-4000-8000-000000000004', userId: ids.audit, role: Role.AUDIT_OFFICER },
    { id: '50000000-0000-4000-8000-000000000005', userId: ids.admin, role: Role.ADMIN },
    {
      id: '50000000-0000-4000-8000-000000000006',
      userId: ids.lab,
      role: Role.LAB_PHARMACY,
    },
    { id: '50000000-0000-4000-8000-000000000008', userId: ids.doctor2, role: Role.DOCTOR, wardId: ids.wardA, departmentId: ids.cardiology, shiftId: ids.dayShift },
    { id: '50000000-0000-4000-8000-000000000009', userId: ids.doctor3, role: Role.DOCTOR, wardId: ids.wardB, departmentId: ids.medicine, shiftId: ids.nightShift },
    { id: '50000000-0000-4000-8000-000000000010', userId: ids.nurse2, role: Role.NURSE, wardId: ids.ed, departmentId: ids.emergency, shiftId: ids.nightShift },
  ];
  for (const assignment of assignments) {
    await database.assignment.upsert({
      where: { id: assignment.id },
      create: { ...assignment, startsAt, endsAt },
      update: { role: assignment.role, wardId: assignment.wardId, departmentId: assignment.departmentId, shiftId: assignment.shiftId, startsAt, endsAt, active: true },
    });
  }
  await database.caseAttachment.upsert({
    where: { userId_patientId_startsAt: { userId: ids.doctor, patientId: ids.chidi, startsAt } },
    create: { userId: ids.doctor, patientId: ids.chidi, startsAt },
    update: {},
  });
  for (const [userId, patientId] of [
    [ids.doctor, ids.ibrahim], [ids.doctor2, ids.chidi], [ids.doctor2, ids.fatima],
    [ids.doctor3, ids.amina], [ids.nurse, ids.fatima], [ids.nurse2, ids.grace],
  ] as const) {
    await database.caseAttachment.upsert({
      where: { userId_patientId_startsAt: { userId, patientId, startsAt } },
      create: { userId, patientId, startsAt }, update: {},
    });
  }
  await database.orderLink.upsert({
    where: { id: '60000000-0000-4000-8000-000000000001' },
    create: {
      id: '60000000-0000-4000-8000-000000000001',
      patientId: ids.chidi,
      assigneeUserId: ids.lab,
      createdByUserId: ids.doctor,
      resourceTypes: ['Observation', 'DiagnosticReport'],
      startsAt,
      endsAt,
    },
    update: {
      assigneeUserId: ids.lab,
      resourceTypes: ['Observation', 'DiagnosticReport'],
      startsAt,
      endsAt,
    },
  });

  const totpKeyValue = process.env.TOTP_ENCRYPTION_KEY;
  if (!totpKeyValue) throw new Error('TOTP_ENCRYPTION_KEY is required to seed demo credentials');
  const totpKey = Buffer.from(totpKeyValue, 'base64');
  const demoTotpSecret = 'JBSWY3DPEHPK3PXP';
  for (const userId of [ids.doctor, ids.nurse]) {
    await database.totpCredential.upsert({
      where: { userId },
      create: {
        userId,
        encryptedSecret: encryptEnvelope(demoTotpSecret, totpKey, `totp:${userId}`),
        enabledAt: new Date(),
      },
      update: {
        encryptedSecret: encryptEnvelope(demoTotpSecret, totpKey, `totp:${userId}`),
        enabledAt: new Date(),
        lastUsedStep: null,
      },
    });
  }

  await seedResources();
  process.stdout.write('Kofa synthetic dataset seeded. TOTP demo secret: JBSWY3DPEHPK3PXP\n');
}

async function seedResources(): Promise<void> {
  const now = new Date('2026-09-01T09:00:00Z');
  const extension = (name: string, valueString: string) => ({
    url: `https://kofa.health/fhir/StructureDefinition/${name}`,
    valueString,
  });
  const resources = [
    {
      patientId: ids.amina,
      resourceType: 'Patient',
      fhirId: 'patient-amina-musa',
      resource: {
        resourceType: 'Patient',
        id: 'patient-amina-musa',
        active: true,
        name: [{ use: 'official', family: 'Musa', given: ['Amina'] }],
        gender: 'female',
        birthDate: '2001-04-12',
        telecom: [{ system: 'phone', value: '+234-801-555-0101' }],
        address: [{ city: 'Zaria', state: 'Kaduna', country: 'NG' }],
        extension: [extension('emergency-contact', 'Bello Musa · +234-801-555-0199')],
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'Observation',
      fhirId: 'amina-genotype',
      resource: {
        resourceType: 'Observation',
        id: 'amina-genotype',
        status: 'final',
        meta: {
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' },
          ],
        },
        code: { text: 'Haemoglobin genotype' },
        valueCodeableConcept: { text: 'HbSS' },
        extension: [extension('summary-category', 'genotype'), extension('summary-value', 'HbSS')],
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'AllergyIntolerance',
      fhirId: 'amina-allergy-penicillin',
      resource: {
        resourceType: 'AllergyIntolerance',
        id: 'amina-allergy-penicillin',
        clinicalStatus: { text: 'active' },
        code: { text: 'Penicillin — urticaria' },
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'MedicationRequest',
      fhirId: 'amina-hydroxyurea',
      resource: {
        resourceType: 'MedicationRequest',
        id: 'amina-hydroxyurea',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '5552',
              display: 'Hydroxyurea',
            },
          ],
        },
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'Procedure',
      fhirId: 'amina-transfusion-2025',
      resource: {
        resourceType: 'Procedure',
        id: 'amina-transfusion-2025',
        status: 'completed',
        code: { text: 'Red blood cell transfusion · 2025-12-03' },
        extension: [extension('summary-category', 'transfusion')],
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'Condition',
      fhirId: 'amina-acs',
      resource: {
        resourceType: 'Condition',
        id: 'amina-acs',
        clinicalStatus: { text: 'inactive' },
        code: { text: 'Previous acute chest syndrome' },
        extension: [extension('summary-category', 'key-complication')],
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'Observation',
      fhirId: 'amina-baseline-hb',
      resource: {
        resourceType: 'Observation',
        id: 'amina-baseline-hb',
        status: 'final',
        code: { text: 'Baseline haemoglobin' },
        valueQuantity: { value: 8.1, unit: 'g/dL' },
        extension: [
          extension('summary-category', 'baseline-haemoglobin'),
          extension('summary-value', '8.1 g/dL (baseline recorded 2026-08-14)'),
        ],
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'CarePlan',
      fhirId: 'amina-analgesia-plan',
      resource: {
        resourceType: 'CarePlan',
        id: 'amina-analgesia-plan',
        status: 'active',
        intent: 'plan',
        title: 'Verified individual pain-management plan',
        extension: [
          extension('summary-category', 'personalised-analgesia'),
          extension(
            'summary-value',
            'Verified plan exists at home facility; contact haematology team for current instructions.',
          ),
        ],
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'Patient',
      fhirId: 'patient-chidi-okafor',
      resource: {
        resourceType: 'Patient',
        id: 'patient-chidi-okafor',
        active: true,
        name: [{ family: 'Okafor', given: ['Chidi'] }],
        gender: 'male',
        birthDate: '1987-02-03',
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'Patient',
      fhirId: 'patient-fatima-bello',
      resource: {
        resourceType: 'Patient',
        id: 'patient-fatima-bello',
        active: true,
        name: [{ family: 'Bello', given: ['Fatima'] }],
        gender: 'female',
        birthDate: '1994-11-21',
        telecom: [{ system: 'phone', value: '+234-803-555-0212' }],
        address: [{ city: 'Zaria', state: 'Kaduna', country: 'NG' }],
        extension: [extension('emergency-contact', 'Halima Bello · +234-803-555-0299')],
      },
    },

    // --- Sensitive + billing for Amina (SCD patient) ---
    {
      patientId: ids.amina,
      resourceType: 'Observation',
      fhirId: 'amina-hiv-status',
      resource: {
        resourceType: 'Observation',
        id: 'amina-hiv-status',
        status: 'final',
        meta: {
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' },
          ],
        },
        code: { text: 'HIV status' },
        valueCodeableConcept: { text: 'Negative (screened 2026-06-02)' },
      },
    },
    {
      patientId: ids.amina,
      resourceType: 'Coverage',
      fhirId: 'amina-coverage',
      resource: {
        resourceType: 'Coverage',
        id: 'amina-coverage',
        status: 'active',
        beneficiary: { reference: 'Patient/patient-amina-musa' },
        payor: [{ display: 'NHIS · Kaduna State scheme' }],
        subscriberId: 'NHIS-KD-4471902',
      },
    },

    // --- Chidi Okafor (Ward A, attending doctor case) ---
    {
      patientId: ids.chidi,
      resourceType: 'Condition',
      fhirId: 'chidi-scd',
      resource: {
        resourceType: 'Condition',
        id: 'chidi-scd',
        clinicalStatus: { text: 'active' },
        code: { text: 'Sickle cell disease (HbSC)' },
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'Observation',
      fhirId: 'chidi-genotype',
      resource: {
        resourceType: 'Observation',
        id: 'chidi-genotype',
        status: 'final',
        meta: {
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' },
          ],
        },
        code: { text: 'Haemoglobin genotype' },
        valueCodeableConcept: { text: 'HbSC' },
        extension: [extension('summary-category', 'genotype'), extension('summary-value', 'HbSC')],
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'AllergyIntolerance',
      fhirId: 'chidi-allergy-sulfa',
      resource: {
        resourceType: 'AllergyIntolerance',
        id: 'chidi-allergy-sulfa',
        clinicalStatus: { text: 'active' },
        patient: { reference: 'Patient/patient-chidi-okafor' },
        code: { text: 'Sulfonamides - rash' },
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'MedicationRequest',
      fhirId: 'chidi-folic-acid',
      resource: {
        resourceType: 'MedicationRequest',
        id: 'chidi-folic-acid',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/patient-chidi-okafor' },
        medicationCodeableConcept: { text: 'Folic acid 5mg once daily' },
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'Observation',
      fhirId: 'chidi-hb',
      resource: {
        resourceType: 'Observation',
        id: 'chidi-hb',
        status: 'final',
        code: { text: 'Haemoglobin' },
        valueQuantity: { value: 7.6, unit: 'g/dL' },
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'Observation',
      fhirId: 'chidi-hiv-status',
      resource: {
        resourceType: 'Observation',
        id: 'chidi-hiv-status',
        status: 'final',
        meta: {
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' },
          ],
        },
        code: { text: 'HIV status' },
        valueCodeableConcept: { text: 'Positive - on ART, last viral load undetectable' },
      },
    },
    {
      patientId: ids.chidi,
      resourceType: 'Coverage',
      fhirId: 'chidi-coverage',
      resource: {
        resourceType: 'Coverage',
        id: 'chidi-coverage',
        status: 'active',
        beneficiary: { reference: 'Patient/patient-chidi-okafor' },
        payor: [{ display: 'Hygeia HMO' }],
        subscriberId: 'HYG-99213-CO',
      },
    },

    // --- Fatima Bello (Ward A) ---
    {
      patientId: ids.fatima,
      resourceType: 'Condition',
      fhirId: 'fatima-scd',
      resource: {
        resourceType: 'Condition',
        id: 'fatima-scd',
        clinicalStatus: { text: 'active' },
        code: { text: 'Sickle cell disease (HbSS) with recurrent vaso-occlusive crises' },
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'Observation',
      fhirId: 'fatima-genotype',
      resource: {
        resourceType: 'Observation',
        id: 'fatima-genotype',
        status: 'final',
        meta: {
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' },
          ],
        },
        code: { text: 'Haemoglobin genotype' },
        valueCodeableConcept: { text: 'HbSS' },
        extension: [extension('summary-category', 'genotype'), extension('summary-value', 'HbSS')],
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'AllergyIntolerance',
      fhirId: 'fatima-allergy-penicillin',
      resource: {
        resourceType: 'AllergyIntolerance',
        id: 'fatima-allergy-penicillin',
        clinicalStatus: { text: 'active' },
        patient: { reference: 'Patient/patient-fatima-bello' },
        code: { text: 'Penicillin - anaphylaxis' },
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'MedicationRequest',
      fhirId: 'fatima-hydroxyurea',
      resource: {
        resourceType: 'MedicationRequest',
        id: 'fatima-hydroxyurea',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/patient-fatima-bello' },
        medicationCodeableConcept: { text: 'Hydroxyurea 500mg once daily' },
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'Procedure',
      fhirId: 'fatima-transfusion-2026',
      resource: {
        resourceType: 'Procedure',
        id: 'fatima-transfusion-2026',
        status: 'completed',
        code: { text: 'Red blood cell transfusion · 2026-06-14' },
        extension: [extension('summary-category', 'transfusion')],
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'Condition',
      fhirId: 'fatima-acs',
      resource: {
        resourceType: 'Condition',
        id: 'fatima-acs',
        clinicalStatus: { text: 'active' },
        code: { text: 'Acute chest syndrome (recurrent)' },
        extension: [extension('summary-category', 'key-complication')],
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'Observation',
      fhirId: 'fatima-mental-health',
      resource: {
        resourceType: 'Observation',
        id: 'fatima-mental-health',
        status: 'final',
        meta: {
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' },
          ],
        },
        code: { text: 'Mental health note' },
        valueString: 'Depression secondary to chronic pain; on counselling, no pharmacotherapy.',
      },
    },
    {
      patientId: ids.fatima,
      resourceType: 'Coverage',
      fhirId: 'fatima-coverage',
      resource: {
        resourceType: 'Coverage',
        id: 'fatima-coverage',
        status: 'active',
        beneficiary: { reference: 'Patient/patient-fatima-bello' },
        payor: [{ display: 'NHIS · Kaduna State scheme' }],
        subscriberId: 'NHIS-KD-8830145',
      },
    },
  ];
  for (const item of resources) {
    await database.fhirResource.upsert({
      where: {
        resourceType_fhirId_version: {
          resourceType: item.resourceType,
          fhirId: item.fhirId,
          version: 1,
        },
      },
      create: {
        ...item,
        version: 1,
        sourceLabel: SourceLabel.HOSPITAL_VERIFIED,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        resource: item.resource,
        sourceLabel: SourceLabel.HOSPITAL_VERIFIED,
        updatedAt: now,
      },
    });
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
