// SicklePass emergency passport.
//
// Backend mode uses the real /v1/passport/* endpoints and the patient's own
// record from /v1/patients. Mock mode returns static data so the prototype
// still renders when no backend is configured.

import { isBackendEnabled } from "./config";
import {
  getMyPatient as backendGetMyPatient,
  createPassportGrant as backendCreateGrant,
  listPassportGrants as backendListGrants,
  revokePassportGrant as backendRevokeGrant,
  usePassport as backendUsePassport,
  getAccessLog as backendGetAccessLog,
} from "./backendAdapter";

const MOCK_PATIENT = { patientId: "PT-000184", name: "Fatima Abdullahi", fhirId: "PT-000184" };

// Returns the patient records the signed-in patient/caregiver may act for.
export async function getMyPatients() {
  if (isBackendEnabled()) {
    return backendGetMyPatient();
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [MOCK_PATIENT];
}

export async function createGrant({ patientId, pin, expiresInSeconds }) {
  if (isBackendEnabled()) {
    return backendCreateGrant({ patientId, pin, expiresInSeconds });
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    grantId: `mock-grant-${Date.now()}`,
    token: `mock-token-${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}

export async function listGrants(patientId) {
  if (isBackendEnabled()) {
    return backendListGrants(patientId);
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [
    { id: "mock-1", scope: "emergency-summary", status: "ACTIVE", expiresAt: new Date(Date.now() + 3360000).toISOString(), revokedAt: null },
  ];
}

export async function revokeGrant(id) {
  if (isBackendEnabled()) {
    return backendRevokeGrant(id);
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
  return { revoked: true };
}

export async function redeemToken({ token, pin }) {
  if (isBackendEnabled()) {
    return backendUsePassport({ token, pin });
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    summary: { patient: { displayName: MOCK_PATIENT.name }, allergiesReactions: ["Penicillin - anaphylaxis"] },
    verification: { signatureValid: true, onlineStatus: "ACTIVE" },
  };
}

export async function getAccessHistory(patientId) {
  if (isBackendEnabled()) {
    return backendGetAccessLog(patientId);
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [
    { occurredAt: "2026-09-18T08:44:00Z", actor: "Dr. Adaeze Okonkwo", actorRole: "DOCTOR", action: "PASSPORT_SCAN", decision: "GRANT", purposeOfUse: "TREATMENT" },
  ];
}
