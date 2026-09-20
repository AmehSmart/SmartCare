import { PATIENT_ASSIGNMENTS, PATIENTS, ROLE_PERMISSION_MATRIX } from "./mockData";
import { hasPermission, isAdministrator } from "./roleService";
import { isBackendEnabled } from "./config";
import {
  getPatients as backendGetPatients,
  getPatientById as backendGetPatientById,
  requestSensitiveFieldReveal as backendRequestSensitiveFieldReveal,
  addClinicalNote as backendAddClinicalNote,
} from "./backendAdapter";

const normalizeRole = (value = "") => String(value || "").trim().toLowerCase();

function isBreakGlassEligible(user) {
  const role = normalizeRole(user?.role);
  return role === "nurse" || role === "attending doctor" || role === "visiting/locum doctor" || role === "doctor";
}

export function canAccessPatient(user, patient, context = {}) {
  if (!user || !patient) return false;
  if (isAdministrator(user) && hasPermission(user, "view_all_patients")) return true;
  if (!hasPermission(user, "view_patients")) return false;

  const patientWard = patient.ward;
  const userWard = context.ward || user.ward || "";
  const userShift = context.shift || user.shift || "";
  const emergencyActive = Boolean(context.emergencyActive || context.hasEmergencyAccess);
  const roleName = normalizeRole(user.role);
  const assignments = PATIENT_ASSIGNMENTS.filter((assignment) => assignment.patientId === patient.id && assignment.status !== "Removed");
  const assignedToUser = assignments.some((assignment) => assignment.staffId === user.id);
  const wardMatches = patientWard === userWard || userWard === "All Units" || userWard === "All Shifts";
  const shiftMatches = !userShift || userShift === "All Shifts" || userShift === context.shift || userShift === user.shift;

  if (emergencyActive && isBreakGlassEligible(user)) {
    return true;
  }

  if (roleName === "administrator") {
    return true;
  }

  if (roleName === "records clerk") {
    return wardMatches || assignedToUser;
  }

  if (roleName === "lab/pharmacy staff" || roleName === "lab") {
    return wardMatches || assignedToUser;
  }

  if (roleName === "attending doctor" || roleName === "doctor" || roleName === "visiting/locum doctor" || roleName === "locum") {
    return assignedToUser || wardMatches || patientWard === "Maternity";
  }

  if (roleName === "nurse") {
    return (assignedToUser || wardMatches) && shiftMatches;
  }

  return assignedToUser || wardMatches;
}

export async function getPatients(user) {
  if (isBackendEnabled()) {
    return backendGetPatients(user);
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  if (user && !hasPermission(user, "view_patients")) {
    throw new Error("You are not authorized to view patients.");
  }

  const visiblePatients = user && !hasPermission(user, "view_all_patients")
    ? PATIENTS.filter((patient) => canAccessPatient(user, patient, { ward: user.ward, shift: user.shift }))
    : PATIENTS;

  return visiblePatients.map((patient) => ({
    ...patient,
    scope: canAccessPatient(user, patient, { ward: user?.ward, shift: user?.shift }) ? "In scope" : "Out of scope",
  }));
}

export async function getPatientById(id, user) {
  if (isBackendEnabled()) {
    return backendGetPatientById(id, user);
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  const patient = PATIENTS.find((entry) => entry.id === id);

  if (!patient) {
    throw new Error("Patient not found.");
  }

  if (user && !hasPermission(user, "view_patients")) {
    throw new Error("You are not authorized to view this patient.");
  }

  if (user && !canAccessPatient(user, patient, { ward: user.ward, shift: user.shift })) {
    throw new Error("This patient is outside your assigned scope.");
  }

  return patient;
}

export function getFieldAccessForRole(role = "Nurse") {
  const normalizedRole = normalizeRole(role);
  const roleKey = {
    nurse: "nurse",
    doctor: "doctor",
    attending: "doctor",
    "attending doctor": "doctor",
    "visiting/locum doctor": "locum",
    locum: "locum",
    records: "records",
    "records clerk": "records",
    administrator: "administrator",
    "lab/pharmacy staff": "lab",
    lab: "lab",
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
  if (isBackendEnabled()) {
    return backendRequestSensitiveFieldReveal({ patientId, field, reason, actorId });
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!patientId || !reason) {
    throw new Error("A clinical reason is required to reveal sensitive information.");
  }

  return {
    allowed: true,
    field,
    patientId,
    actorId,
    reason,
    revealedAt: new Date().toISOString(),
    resources: [
      { label: "HIV status", value: "Negative (screened 2026-06-02)", source: "HOSPITAL_VERIFIED" },
      { label: "Mental health note", value: "Mild anxiety at booking; counselled, no pharmacotherapy.", source: "HOSPITAL_VERIFIED" },
    ],
  };
}

export async function addClinicalNote({ patientId, fhirId, text }) {
  const note = String(text ?? "").trim();
  if (!note) {
    throw new Error("Enter a note before saving.");
  }
  if (isBackendEnabled()) {
    return backendAddClinicalNote({ patientId, fhirId, text: note });
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { ok: true, patientId, savedAt: new Date().toISOString() };
}
