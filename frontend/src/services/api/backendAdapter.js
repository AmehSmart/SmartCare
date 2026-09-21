// Real Kofa backend implementations of the service-layer functions.
//
// Each mock module (authApi, patientApi, auditApi, emergencyApi, notificationApi)
// delegates here when VITE_API_BASE_URL is configured. The job of this file is to
// call the live /v1/* endpoints and reshape the responses into the objects the
// existing React components already expect, so the UI does not have to change.

import { apiFetch, setAccessToken, clearAccessToken, newIdempotencyKey } from "./httpClient";
import { getRolePermissions } from "./roleService";

// --- role + shape mapping -------------------------------------------------

const ROLE_LABELS = {
  DOCTOR: "Attending Doctor",
  NURSE: "Nurse",
  RECORDS_CLERK: "Records Clerk",
  AUDIT_OFFICER: "Audit Officer",
  ADMIN: "Administrator",
  LAB_PHARMACY: "Lab/Pharmacy Staff",
  PATIENT: "Patient",
};

function roleLabel(backendRole) {
  return ROLE_LABELS[backendRole] || "Nurse";
}

function initialsFrom(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ageFrom(birthDate) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const diff = Date.now() - born.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

// --- authentication -------------------------------------------------------

// Establishes the session: login, then pick the first active duty assignment
// and select it as the authorization context (role + ward).
export async function loginStaff({ staffId, pin, email, password }) {
  const loginEmail = (email ?? staffId ?? "").trim();
  const loginPassword = password ?? pin ?? "";

  const auth = await apiFetch("/v1/auth/login", {
    method: "POST",
    auth: false,
    body: { email: loginEmail, password: loginPassword },
  });

  setAccessToken(auth.accessToken);

  const user = auth.user || {};
  let role = "PATIENT";
  let wardName = "";
  let assignmentId = null;

  try {
    const assignments = await apiFetch("/v1/session/assignments");
    const active = Array.isArray(assignments) ? assignments[0] : null;
    if (active) {
      assignmentId = active.id;
      role = active.role || role;
      wardName = active.ward?.name || "";
      await apiFetch("/v1/session/context", {
        method: "POST",
        body: { assignmentId: active.id },
      });
    }
  } catch {
    // Users without a staff assignment (e.g. patients) simply have no duty context.
  }

  const label = roleLabel(role);
  const displayName = user.displayName || loginEmail;

  return {
    id: user.id,
    email: user.email || loginEmail,
    initials: initialsFrom(displayName),
    shortName: displayName.split(/\s+/)[0] || displayName,
    name: displayName,
    role: label,
    department: wardName || label,
    ward: wardName || "All Units",
    shift: "Day Shift",
    accessLevel: `${label} access`,
    assignmentId,
    backendRole: role,
    permissions: getRolePermissions(label),
  };
}

export function logout() {
  clearAccessToken();
}

export async function registerAdministrator({ email, password, invitationCode }) {
  const auth = await apiFetch("/v1/auth/register-admin", {
    method: "POST",
    auth: false,
    body: { email, password, invitationCode },
  });

  if (auth?.accessToken) {
    setAccessToken(auth.accessToken);
  }

  return auth;
}

export async function registerStaff({ email, staffId, name, department, ward, pin }) {
  return apiFetch("/v1/auth/register-staff", {
    method: "POST",
    auth: false,
    body: { email, staffId, name, department, ward, pin },
  });
}

// --- patients -------------------------------------------------------------

function mapPatientCard(item) {
  return {
    id: item.id,
    patientNumber: item.fhirId || item.id,
    initials: initialsFrom(item.displayName),
    name: item.displayName,
    age: ageFrom(item.birthDate),
    gender: item.gender || "-",
    ward: item.currentWard?.name || "Unassigned",
    status: item.status || (item.active === false ? "Inactive" : "Active"),
    department: item.department?.name || item.currentWard?.department?.name || "-",
    scope: "In scope",
    tone: "green",
  };
}

export async function getPatients(query) {
  const q = query && query.trim() ? `&query=${encodeURIComponent(query.trim())}` : "";
  const data = await apiFetch(`/v1/patients?limit=50${q}`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapPatientCard);
}

// Best-effort extraction of the rich fields the record screens render from the
// permitted FHIR bundle returned by the backend.
function extractFhir(resources = [], policyFields = []) {
  const result = {
    demographics: {},
    diagnosis: [],
    medications: [],
    labs: [],
    sensitiveFields: {},
  };

  for (const resource of resources) {
    switch (resource?.resourceType) {
      case "Patient": {
        const address = resource.address?.[0];
        result.demographics = {
          dob: resource.birthDate || "",
          gender: resource.gender || "",
          phone: resource.telecom?.find((t) => t.system === "phone")?.value || "",
          address: address ? [address.line?.join(" "), address.city].filter(Boolean).join(", ") : "",
        };
        break;
      }
      case "Condition":
        result.diagnosis.push(resource.code?.text || resource.code?.coding?.[0]?.display || "Recorded condition");
        break;
      case "MedicationRequest":
      case "MedicationStatement":
        result.medications.push({
          name:
            resource.medicationCodeableConcept?.text ||
            resource.medicationCodeableConcept?.coding?.[0]?.display ||
            "Medication",
          dose: resource.dosageInstruction?.[0]?.text || "",
          schedule: resource.dosageInstruction?.[0]?.timing?.code?.text || "",
        });
        break;
      case "Observation": {
        const value = resource.valueQuantity
          ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""}`.trim()
          : resource.valueString || "";
        result.labs.push({
          label: resource.code?.text || resource.code?.coding?.[0]?.display || "Observation",
          value,
          updated: resource._kofa?.updatedAt || resource.effectiveDateTime || "",
        });
        break;
      }
      default:
        break;
    }
  }

  result.policyFields = policyFields;
  return result;
}

export async function getPatientById(id) {
  const data = await apiFetch(`/v1/patients/${id}`);
  const patient = data?.patient || {};
  const extracted = extractFhir(data?.resources || [], data?.policy?.fields || []);

  return {
    id: patient.id || id,
    patientNumber: patient.fhirId || patient.id || id,
    initials: initialsFrom(patient.displayName),
    name: patient.displayName || "Unknown patient",
    age: ageFrom(patient.birthDate),
    gender: extracted.demographics.gender || "-",
    ward: patient.currentWard?.name || "-",
    status: patient.status || (patient.active === false ? "Inactive" : "Active"),
    department: patient.department?.name || "-",
    admittedAt: patient.admittedAt || null,
    dischargedAt: patient.dischargedAt || null,
    assignments: patient.assignments || [],
    scope: "In scope",
    ...extracted,
  };
}

export async function requestSensitiveFieldReveal({ patientId, reason }) {
  const data = await apiFetch(`/v1/patients/${patientId}/sensitive-reveal`, {
    method: "POST",
    idempotencyKey: newIdempotencyKey("reveal"),
    body: { reason },
  });
  return {
    allowed: true,
    patientId,
    reason,
    resources: (data?.resources || []).map(formatSensitiveResource),
    revealedAt: new Date().toISOString(),
  };
}

// Turn a permitted sensitive FHIR resource into a { label, value } pair for display.
function formatSensitiveResource(resource) {
  const label = resource?.code?.text || resource?.code?.coding?.[0]?.display || resource?.resourceType || "Sensitive record";
  const value =
    resource?.valueCodeableConcept?.text ||
    resource?.valueString ||
    (resource?.valueQuantity ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""}`.trim() : "") ||
    resource?.clinicalStatus?.text ||
    "Recorded";
  return { label, value, source: resource?._kofa?.source || "HOSPITAL_VERIFIED" };
}

// Admit/transfer a patient to a ward. The backend notifies that ward's on-duty
// staff so their Notifications light up with the new arrival.
export async function transferPatient({ patientId, wardId }) {
  return apiFetch(`/v1/patients/${patientId}/transfer`, {
    method: "POST",
    idempotencyKey: newIdempotencyKey("transfer"),
    body: { wardId },
  });
}

// Write a free-text clinical note as a FHIR Observation (writable by doctor and
// nurse). The subject reference must match the patient's FHIR id.
export async function addClinicalNote({ patientId, fhirId, text }) {
  const resource = {
    resourceType: "Observation",
    id: `note-${Date.now()}`,
    status: "final",
    subject: { reference: `Patient/${fhirId}` },
    code: { text: "Clinical note" },
    valueString: text,
    effectiveDateTime: new Date().toISOString(),
  };
  return apiFetch(`/v1/patients/${patientId}/resources`, {
    method: "POST",
    idempotencyKey: newIdempotencyKey("note"),
    body: { resource },
  });
}

// --- emergency (break-glass) ---------------------------------------------

export async function requestEmergencyAccess({ patientId, reason }) {
  // The real backend performs the grant on verify (with TOTP), so the request
  // step only carries the reason forward to the verification screen.
  return {
    grantId: patientId,
    patientId,
    reason,
    status: "pending_verification",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export async function verifyEmergencyAccess({ grantId, code, reasonCode = "UNCONSCIOUS_PATIENT", reasonText = "Emergency clinical access" }) {
  const data = await apiFetch(`/v1/patients/${grantId}/breakglass`, {
    method: "POST",
    body: {
      totp: String(code),
      reasonCode,
      reasonText,
      idempotencyKey: newIdempotencyKey("breakglass"),
    },
  });
  return {
    allowed: true,
    grantId: data?.emergencySessionId || grantId,
    emergencySessionId: data?.emergencySessionId,
    summary: data?.summary,
    banner: data?.banner,
    status: "active",
    expiresAt: data?.banner?.expiresAt || data?.summary?.expiresAt,
  };
}

export async function endEmergencyAccess({ grantId }) {
  if (!grantId) return { status: "inactive" };
  try {
    await apiFetch(`/v1/emergency-sessions/${grantId}`, { method: "DELETE" });
  } catch {
    // Session may already be expired server-side.
  }
  return { grantId, status: "ended" };
}

// --- audit ----------------------------------------------------------------

// Seeded staff, so the audit log reads with names instead of raw UUIDs.
const KNOWN_ACTORS = {
  "20000000-0000-4000-8000-000000000001": "Dr Aisha Bello",
  "20000000-0000-4000-8000-000000000002": "Maryam Yusuf",
  "20000000-0000-4000-8000-000000000003": "Musa Ibrahim",
  "20000000-0000-4000-8000-000000000004": "Zainab Garba",
  "20000000-0000-4000-8000-000000000005": "Hauwa Lawal",
  "20000000-0000-4000-8000-000000000006": "Amina Musa",
  "20000000-0000-4000-8000-000000000007": "Ifeanyi Eze",
};

function mapAuditEvent(event) {
  const occurred = event.occurredAt ? new Date(event.occurredAt) : null;
  return {
    id: event.id,
    eventId: event.sequence ? `EVT-${event.sequence}` : event.id,
    sequence: event.sequence,
    date: occurred ? occurred.toLocaleDateString("en-GB") : "",
    time: occurred ? occurred.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
    timestamp: event.occurredAt,
    actor: KNOWN_ACTORS[event.actorId] || event.actorId,
    actorFullName: KNOWN_ACTORS[event.actorId] || event.actorId,
    actorId: event.actorId,
    role: event.actorRole,
    action: event.action,
    field: event.resourceType || null,
    target: event.patientRef || "-",
    decision: event.decision,
    purposeOfUse: event.purposeOfUse,
    hash: event.hash,
    prevHash: event.previousHash,
    previousHash: event.previousHash,
    chainOk: true,
    integrityValid: true,
    flagged: Array.isArray(event.flags) && event.flags.length > 0,
  };
}

export async function getAuditEvents() {
  const data = await apiFetch("/v1/audit/events?limit=50");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapAuditEvent);
}

export async function getAuditQueue() {
  const flags = await apiFetch("/v1/audit/flags");
  const items = Array.isArray(flags) ? flags : [];
  return items.map((flag) => ({
    id: flag.id,
    flag: flag.ruleCode || flag.rule || "Anomaly",
    actor: flag.event?.actorId || "-",
    target: flag.event?.patientRef || "-",
    time: flag.createdAt ? new Date(flag.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
    severity: flag.severity || "Medium",
  }));
}

export async function verifyAuditChain() {
  const data = await apiFetch("/v1/audit/verify", { method: "POST" });
  return {
    integrityValid: Boolean(data?.valid),
    verifiedEvents: data?.checkedCount ?? 0,
    lastVerifiedAt: new Date().toISOString(),
    checkpoint: data?.checkpoint?.hash || "",
  };
}

// --- notifications --------------------------------------------------------

export async function getNotifications() {
  const data = await apiFetch("/v1/notifications");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    metadata: item.metadata || {},
    createdAt: item.createdAt,
    readAt: item.readAt,
    read: Boolean(item.readAt),
  }));
}

export async function markNotificationRead(id) {
  await apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH" });
  return { read: true };
}

// --- passport (SicklePass) ------------------------------------------------

// A patient's own record is the single item /v1/patients returns for them
// (a caregiver gets their dependents). This gives us the patientId the passport
// grant endpoints require.
export async function getMyPatient() {
  const data = await apiFetch("/v1/patients?limit=5");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((item) => ({ patientId: item.id, name: item.displayName, fhirId: item.fhirId }));
}

export async function createPassportGrant({ patientId, pin, expiresInSeconds }) {
  return apiFetch("/v1/passport/grants", {
    method: "POST",
    body: { patientId, pin, expiresInSeconds },
  }); // { grantId, token, expiresAt, key }
}

export async function listPassportGrants(patientId) {
  const data = await apiFetch(`/v1/passport/grants?patientId=${encodeURIComponent(patientId)}`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((g) => ({
    id: g.id,
    scope: g.scope,
    status: g.status,
    expiresAt: g.expiresAt,
    revokedAt: g.revokedAt,
  }));
}

export async function revokePassportGrant(id) {
  await apiFetch(`/v1/passport/grants/${id}`, { method: "DELETE" });
  return { revoked: true };
}

export async function usePassport({ token, pin }) {
  return apiFetch("/v1/passport/use", {
    method: "POST",
    idempotencyKey: newIdempotencyKey("passport"),
    body: { token, pin },
  }); // { summary, verification }
}

export async function getAccessLog(patientId) {
  const data = await apiFetch(`/v1/patients/${patientId}/access-log`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((e) => ({
    occurredAt: e.occurredAt,
    actor: e.actor,
    actorRole: e.actorRole,
    action: e.action,
    decision: e.decision,
    purposeOfUse: e.purposeOfUse,
  }));
}

// --- admin roster ---------------------------------------------------------

// Reads the administrative roster (users, assignments, wards) with no clinical
// data. Returns a flat staff list shaped like the roster table expects.
export async function getAdminRoster() {
  const data = await apiFetch("/v1/admin/roster");
  const users = Array.isArray(data?.items) ? data.items : [];
  return users.map((user) => {
    return {
      staffId: user.id, name: user.name || user.email || user.id,
      email: user.email || "",
      role: user.role ? roleLabel(user.role) : "Unassigned",
      ward: user.ward?.name || "-", department: user.department?.name || "-",
      shift: user.shift?.name || "-", active: user.active,
      assignedPatients: user.assignedPatients || [],
    };
  });
}

export async function getAdminPatients(query) {
  const suffix = query?.trim() ? `?query=${encodeURIComponent(query.trim())}` : "";
  const data = await apiFetch(`/v1/admin/patients${suffix}`);
  return (data?.items || []).map(mapPatientCard);
}

export async function createAdminPatient(input) {
  return apiFetch("/v1/admin/patients", { method: "POST", body: input });
}

export async function getAdminPatient(id) { return apiFetch(`/v1/admin/patients/${id}`); }
export async function getAssignmentStaff() { return apiFetch("/v1/admin/assignment-staff"); }
export async function getAdminDepartments() { return apiFetch("/v1/admin/departments"); }
export async function assignAdminPatient(patientId, userId) { return apiFetch(`/v1/admin/patients/${patientId}/assignments`, { method: "POST", body: { userId } }); }
export async function removeAdminPatientAssignment(id) { return apiFetch(`/v1/admin/patient-assignments/${id}`, { method: "DELETE" }); }
export async function setAdminPatientStatus(id, status) { return apiFetch(`/v1/admin/patients/${id}/status`, { method: "PATCH", body: { status } }); }
