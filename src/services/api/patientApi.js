import { PATIENTS, ROLE_PERMISSION_MATRIX } from "./mockData";

// BACKEND INTEGRATION:
// Replace this mock patient-store layer with the real backend endpoint.
// Expected endpoint: GET /api/patients and GET /api/patients/:id
// Expected response: patient collection with scope metadata, field visibility, and sensitive fields gated by backend policy.
// Authentication requirement: authenticated staff token and role-based access context.
// Important fields: id, ward, scope, demographics, diagnosis, medications, labs, sensitiveFields, accessState.
// Error states: patient not found, unauthorized access, policy deny, out-of-scope patient.
export async function getPatients() {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return PATIENTS.map((patient) => ({
    ...patient,
    scope: patient.ward === "Ward B" ? "Out of scope" : "In scope",
  }));
}

export async function getPatientById(id) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const patient = PATIENTS.find((entry) => entry.id === id);

  if (!patient) {
    throw new Error("Patient not found.");
  }

  return patient;
}

export function getFieldAccessForRole(role = "Nurse") {
  const normalizedRole = String(role || "Nurse").toLowerCase();
  const roleKey = {
    nurse: "nurse",
    doctor: "doctor",
    attending: "doctor",
    "attending doctor": "doctor",
    records: "records",
    "records clerk": "records",
    intern: "intern",
    it: "it",
  }[normalizedRole] || "nurse";

  return ROLE_PERMISSION_MATRIX.reduce((access, row) => {
    access[row.label] = Boolean(row[roleKey]);
    return access;
  }, {});
}

export function getPatientFieldAccess(patient, role = "Nurse") {
  if (!patient) {
    return {};
  }

  const fieldAccess = getFieldAccessForRole(role);

  return {
    demographics: fieldAccess["Demographics"],
    vitals: fieldAccess["Vitals"],
    medications: fieldAccess["Medications"],
    allergies: fieldAccess["Allergies"],
    clinicalNotes: fieldAccess["Clinical Notes"],
    hivStatus: fieldAccess["HIV Status"],
    mentalHealth: fieldAccess["Mental Health Notes"],
    genotype: fieldAccess["Genotype / Blood Group"],
  };
}

export async function requestSensitiveFieldReveal({ patientId, field, reason, actorId }) {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!patientId || !field || !reason || !actorId) {
    throw new Error("Sensitive field reveal requires patient, field, actor, and reason.");
  }

  return {
    allowed: true,
    field,
    patientId,
    actorId,
    reason,
    revealedAt: new Date().toISOString(),
  };
}
