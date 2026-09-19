import type { Role } from '@kofa/contracts';

export type ClinicalField =
  | 'demographics'
  | 'conditions'
  | 'deepClinicalHistory'
  | 'medications'
  | 'labs'
  | 'sensitiveFlags'
  | 'billing'
  | 'emergencySummary'
  | 'auditMetadata';

export type AccessAction =
  | 'SEARCH_PATIENTS'
  | 'READ_CHART'
  | 'WRITE_CLINICAL'
  | 'REVEAL_SENSITIVE'
  | 'READ_EMERGENCY_SUMMARY'
  | 'READ_AUDIT'
  | 'MANAGE_ROSTER';

export type PolicyInput = {
  role: Role;
  action: AccessAction;
  sameFacility: boolean;
  assignmentActive: boolean;
  sameWard: boolean;
  attachedToCase: boolean;
  orderLinked: boolean;
  isSelf: boolean;
  isDependent: boolean;
  emergencyAuthorized: boolean;
};

export type PolicyDecision = {
  allowed: boolean;
  reason:
    | 'ALLOWED'
    | 'NO_ACTIVE_ASSIGNMENT'
    | 'FACILITY_MISMATCH'
    | 'OUTSIDE_SCOPE'
    | 'ROLE_FORBIDDEN'
    | 'EMERGENCY_AUTH_REQUIRED';
  fields: readonly ClinicalField[];
  sensitiveRevealRequired: boolean;
};

const EMPTY: readonly ClinicalField[] = Object.freeze([]);
const EMERGENCY: readonly ClinicalField[] = Object.freeze(['emergencySummary']);

const roleFields: Readonly<Record<Role, readonly ClinicalField[]>> = {
  PATIENT: [
    'demographics',
    'conditions',
    'deepClinicalHistory',
    'medications',
    'labs',
    'sensitiveFlags',
  ],
  CAREGIVER: [
    'demographics',
    'conditions',
    'deepClinicalHistory',
    'medications',
    'labs',
    'sensitiveFlags',
  ],
  DOCTOR: [
    'demographics',
    'conditions',
    'deepClinicalHistory',
    'medications',
    'labs',
    'sensitiveFlags',
    'billing',
  ],
  NURSE: ['demographics', 'conditions', 'medications', 'labs'],
  RECORDS_CLERK: ['demographics', 'billing'],
  LOCUM_DOCTOR: ['demographics', 'conditions', 'medications', 'labs'],
  LAB_PHARMACY: ['demographics', 'medications', 'labs'],
  AUDIT_OFFICER: ['auditMetadata'],
  ADMIN: EMPTY,
};

export function decidePolicy(input: PolicyInput): PolicyDecision {
  if (input.action === 'MANAGE_ROSTER')
    return result(input.role === 'ADMIN', 'ROLE_FORBIDDEN', EMPTY);
  if (input.action === 'READ_AUDIT') {
    return result(input.role === 'AUDIT_OFFICER' && input.sameFacility, 'ROLE_FORBIDDEN', [
      'auditMetadata',
    ]);
  }

  if (input.action === 'READ_EMERGENCY_SUMMARY') {
    const eligible = ['DOCTOR', 'NURSE', 'LOCUM_DOCTOR'].includes(input.role);
    if (!eligible) return result(false, 'ROLE_FORBIDDEN', EMPTY);
    if (!input.emergencyAuthorized) return result(false, 'EMERGENCY_AUTH_REQUIRED', EMPTY);
    return result(true, 'ALLOWED', EMERGENCY);
  }

  if (input.role === 'PATIENT' || input.role === 'CAREGIVER') {
    const ownsRecord = input.role === 'PATIENT' ? input.isSelf : input.isDependent;
    const readAction = input.action === 'READ_CHART' || input.action === 'SEARCH_PATIENTS';
    return result(
      ownsRecord && readAction,
      ownsRecord ? 'ROLE_FORBIDDEN' : 'OUTSIDE_SCOPE',
      ownsRecord && readAction ? roleFields[input.role] : EMPTY,
    );
  }

  if (!input.sameFacility) return result(false, 'FACILITY_MISMATCH', EMPTY);
  if (input.role === 'ADMIN' || input.role === 'AUDIT_OFFICER') {
    return result(false, 'ROLE_FORBIDDEN', EMPTY);
  }
  if (!input.assignmentActive) return result(false, 'NO_ACTIVE_ASSIGNMENT', EMPTY);

  let scoped = false;
  switch (input.role) {
    case 'DOCTOR':
      scoped = input.attachedToCase;
      break;
    case 'NURSE':
      scoped = input.sameWard;
      break;
    case 'RECORDS_CLERK':
      scoped = true;
      break;
    case 'LOCUM_DOCTOR':
      scoped = input.attachedToCase || input.sameWard;
      break;
    case 'LAB_PHARMACY':
      scoped = input.orderLinked;
      break;
  }
  if (!scoped) return result(false, 'OUTSIDE_SCOPE', EMPTY);

  if (input.action === 'REVEAL_SENSITIVE') {
    const mayReveal = input.role === 'DOCTOR' || input.role === 'NURSE';
    return result(mayReveal, 'ROLE_FORBIDDEN', mayReveal ? ['sensitiveFlags'] : EMPTY, true);
  }
  if (input.action === 'WRITE_CLINICAL') {
    const mayWrite = ['DOCTOR', 'NURSE', 'LOCUM_DOCTOR', 'LAB_PHARMACY'].includes(input.role);
    return result(mayWrite, 'ROLE_FORBIDDEN', mayWrite ? roleFields[input.role] : EMPTY);
  }
  return result(true, 'ALLOWED', roleFields[input.role]);
}

function result(
  allowed: boolean,
  deniedReason: PolicyDecision['reason'],
  fields: readonly ClinicalField[],
  sensitiveRevealRequired = false,
): PolicyDecision {
  return {
    allowed,
    reason: allowed ? 'ALLOWED' : deniedReason,
    fields: allowed ? fields : EMPTY,
    sensitiveRevealRequired,
  };
}
