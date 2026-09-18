import { AUDIT_EVENTS, ROLE_PERMISSION_MATRIX } from "./mockData";

// BACKEND INTEGRATION:
// Replace this mock audit API with the official audit store and verification service.
// Expected endpoints: GET /api/audit/events, GET /api/audit/events/:id, GET /api/audit/queue, POST /api/audit/verify
// Expected responses: event list, anomaly queue, integrity status, and a cryptographic verification result.
// Authentication requirement: audit officer or admin-only session.
// Important fields: actor, patient, action, field, eventId, hash, prevHash, integrityValid, flagged.
// Error states: chain break, permissions denied, invalid event ID, verification mismatch.
export async function getAuditEvents() {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return AUDIT_EVENTS;
}

export async function getAuditQueue() {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return [
    { flag: "Ward mismatch", actor: "Chioma Eze", target: "Fatima Abdullahi", time: "19:36", severity: "High" },
    { flag: "Off-shift access", actor: "Dr. Adaeze Okonkwo", target: "Fatima Abdullahi", time: "08:44", severity: "Medium" },
    { flag: "Repeat break-glass", actor: "Nurse Emeka Nwosu", target: "Fatima Abdullahi", time: "08:27", severity: "High" },
  ];
}

export async function verifyAuditChain() {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    integrityValid: true,
    verifiedEvents: 20,
    lastVerifiedAt: "2026-09-12T19:36:00Z",
    checkpoint: "7a1f32e14a91d4d4...",
  };
}

export async function getRolePermissionMatrix() {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return ROLE_PERMISSION_MATRIX;
}
