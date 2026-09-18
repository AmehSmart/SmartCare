// BACKEND INTEGRATION:
// Replace this mock emergency flow with the backend's break-glass approval endpoints.
// Expected endpoints: POST /api/emergency-access/request and POST /api/emergency-access/verify
// Expected requests: { patientId, actorId, reason, ward, shift }
// Expected responses: status, approved, expiryTimestamp, reason, grantId, and access window metadata.
// Authentication requirement: authenticated clinician session plus emergency policy approval.
// Important fields: requestId, grantId, expiresAt, codeVerified, reasons, and accessType.
// Error states: invalid code, expired grant, denied policy, missing reason, insufficient role.
import { STAFF_PROFILES } from "./mockData";
import { addRoleAudit, getRolePermissions } from "./roleService";

export async function emergencyLogin({ code }) {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const profile = STAFF_PROFILES.find((member) => member.emergencyCode === String(code));
  if (!profile) {
    throw new Error("That emergency access code is invalid or expired.");
  }

  const permissions = getRolePermissions(profile.role);
  if (!permissions.includes("view_patients")) {
    throw new Error("Your role is not permitted to request emergency patient access.");
  }

  const user = {
    id: profile.staffId,
    initials: profile.initials,
    shortName: profile.shortName,
    name: profile.name,
    role: profile.role,
    department: profile.department,
    ward: profile.ward,
    shift: profile.shift,
    accessLevel: profile.accessLevel,
    permissions,
  };

  addRoleAudit("Emergency login", profile.name, "Emergency access", { role: profile.role });
  return user;
}
export async function requestEmergencyAccess({ patientId, actorId, reason, ward, shift }) {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!patientId || !actorId || !reason) {
    throw new Error("Emergency access request requires patient, actor, and reason.");
  }

  addRoleAudit("Emergency access requested", actorId, patientId, { reason, ward, shift });

  return {
    grantId: `grant-${Date.now()}`,
    patientId,
    actorId,
    reason,
    ward,
    shift,
    status: "pending_verification",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export async function verifyEmergencyAccess({ grantId, code }) {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!grantId || !code || String(code).length !== 6) {
    throw new Error("TOTP verification requires a valid 6-digit code.");
  }

  addRoleAudit("Emergency session started", "Emergency access", grantId, { verified: true });

  return {
    allowed: true,
    grantId,
    status: "active",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export async function endEmergencyAccess({ grantId, actorId }) {
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (!grantId) {
    return { status: "inactive" };
  }

  addRoleAudit("Emergency session ended", actorId || "Emergency access", grantId);
  return { grantId, status: "ended" };
}

export async function getEmergencyStatus(grantId) {
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (!grantId) {
    return { status: "inactive" };
  }

  return {
    status: "active",
    expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
  };
}
