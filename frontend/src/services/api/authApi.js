import { STAFF_PROFILES } from "./mockData";
import { getRolePermissions } from "./roleService";
import { isBackendEnabled } from "./config";
import { getStaffRegistrationOptions as backendGetStaffRegistrationOptions, loginStaff as backendLoginStaff, registerAdministrator as backendRegisterAdministrator, registerStaff as backendRegisterStaff } from "./backendAdapter";

const PROFILE_OVERRIDES_KEY = "smartcare-profile-overrides";
const LEGACY_PROFILE_OVERRIDES_KEY = "kofa-profile-overrides";

// BACKEND INTEGRATION:
// Replace this mock login flow with the real backend endpoint when the auth service is available.
// Expected endpoint: POST /api/auth/login
// Expected request: { staffId: string, pin: string }
// Expected response: {
//   accessToken, refreshToken, user: { id, name, role, ward, shift, initials, shortName }
// }
// Authentication requirement: session token for subsequent requests.
// Important fields: staffId, role, ward, shift, access scope, and emergency capability.
// Error states: invalid password, invalid staff, suspended session, out-of-hours access.
export async function loginStaff(credentials) {
  if (isBackendEnabled()) {
    return backendLoginStaff(credentials);
  }

  const { staffId, pin } = credentials;
  const profile = STAFF_PROFILES.find((member) => member.staffId === staffId);

  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!profile) {
    throw new Error("Invalid staff ID.");
  }

  if (profile.pin !== String(pin)) {
    throw new Error("Incorrect password or PIN.");
  }

  return toUserProfile({ ...profile, ...getProfileOverride(profile.staffId) });
}

export async function getCurrentAccessContext(staffId) {
  const profile = STAFF_PROFILES.find((member) => member.staffId === staffId);

  if (!profile) {
    throw new Error("Unknown staff profile.");
  }

  return {
    role: profile.role,
    ward: profile.ward,
    shift: profile.shift,
    department: profile.department,
    accessLevel: profile.accessLevel,
  };
}

export async function updateStaffProfile(staffId, updates) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const profile = STAFF_PROFILES.find((member) => member.staffId === staffId);

  if (!profile) {
    throw new Error("Staff profile not found.");
  }

  const name = String(updates.name ?? profile.name).trim();
  const department = String(updates.department ?? profile.department).trim();
  const ward = String(updates.ward ?? profile.ward).trim();
  const shift = String(updates.shift ?? profile.shift).trim();

  if (!name || !department || !ward || !shift) {
    throw new Error("Name, department, ward, and shift are required.");
  }

  profile.name = name;
  profile.department = department;
  profile.ward = ward;
  profile.shift = shift;
  profile.initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  profile.shortName = name.split(/\s+/)[0];
  saveProfileOverride(profile.staffId, { name, department, ward, shift, initials: profile.initials, shortName: profile.shortName });

  return toUserProfile(profile);
}

export async function registerStaff({ email, staffId, name, department, ward, pin, role, shift }) {
  if (isBackendEnabled()) {
    return backendRegisterStaff({ email, staffId, name, department, ward, pin, role, shift });
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const cleanStaffId = String(staffId ?? "").trim().toUpperCase();
  const cleanName = String(name ?? "").trim();
  const cleanDepartment = String(department ?? "").trim();
  const cleanWard = String(ward ?? "").trim();
  const cleanPin = String(pin ?? "");

  if (!cleanEmail || !cleanStaffId || !cleanName || !cleanDepartment || !cleanWard || !cleanPin) {
    throw new Error("Complete all required registration fields.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Enter a valid email address.");
  }

  if (STAFF_PROFILES.some((member) => member.staffId.toUpperCase() === cleanStaffId)) {
    throw new Error("That Staff ID is already registered.");
  }

  if (!/^\d{6}$/.test(cleanPin)) {
    throw new Error("Set a 6-digit PIN.");
  }

  const initials = cleanName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  STAFF_PROFILES.push({
    email: cleanEmail,
    staffId: cleanStaffId,
    roleId: "nurse",
    pin: cleanPin,
    initials,
    shortName: cleanName.split(/\s+/)[0],
    name: cleanName,
    role: "Nurse",
    department: cleanDepartment,
    ward: cleanWard,
    shift: "Day Shift",
    accessLevel: "Pending role assignment",
  });

  return { email: cleanEmail, staffId: cleanStaffId, status: "pending_activation" };
}

export async function getStaffRegistrationOptions() {
  if (isBackendEnabled()) return backendGetStaffRegistrationOptions();
  return { departments: [], shifts: [] };
}

export async function registerAdministrator({ email, password, invitationCode }) {
  if (isBackendEnabled()) {
    return backendRegisterAdministrator({ email, password, invitationCode });
  }

  await new Promise((resolve) => setTimeout(resolve, 350));

  const cleanEmail = String(email ?? "").trim();
  const cleanPassword = String(password ?? "");
  const cleanInvitationCode = String(invitationCode ?? "").trim();

  if (!cleanEmail || !cleanPassword || !cleanInvitationCode) {
    throw new Error("Administrator registration requires an email, password, and valid authorization code.");
  }

  if (cleanPassword.length < 8) {
    throw new Error("Use a stronger password for administrator registration.");
  }

  if (cleanInvitationCode.length < 6) {
    throw new Error("A valid administrator invitation code is required.");
  }

  throw new Error("Administrator registration is restricted to backend-authorized SmartCare personnel. This controlled workflow is not available in the current mock environment.");
}

function toUserProfile(profile) {
  return {
    id: profile.staffId,
    initials: profile.initials,
    shortName: profile.shortName,
    name: profile.name,
    role: profile.role,
    department: profile.department,
    ward: profile.ward,
    shift: profile.shift,
    accessLevel: profile.accessLevel,
    permissions: getRolePermissions(profile.role),
  };
}

function getProfileOverride(staffId) {
  try {
    const overrides = JSON.parse(localStorage.getItem(PROFILE_OVERRIDES_KEY) || localStorage.getItem(LEGACY_PROFILE_OVERRIDES_KEY) || "{}");
    return overrides[staffId] || {};
  } catch {
    return {};
  }
}

function saveProfileOverride(staffId, updates) {
  try {
    const overrides = JSON.parse(localStorage.getItem(PROFILE_OVERRIDES_KEY) || localStorage.getItem(LEGACY_PROFILE_OVERRIDES_KEY) || "{}");
    overrides[staffId] = { ...(overrides[staffId] || {}), ...updates };
    localStorage.setItem(PROFILE_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // The backend remains the source of truth when browser storage is unavailable.
  }
}
