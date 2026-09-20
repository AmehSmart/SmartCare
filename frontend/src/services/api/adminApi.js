// Administrative roster.
//
// In backend mode this reads the real /v1/admin/roster (users, assignments,
// wards) with no clinical data. In mock mode it falls back to the local staff
// directory so the prototype still renders.

import { isBackendEnabled } from "./config";
import { getAdminRoster as backendGetAdminRoster, getAdminPatients, getAdminPatient, getAssignmentStaff, assignAdminPatient, removeAdminPatientAssignment, setAdminPatientStatus } from "./backendAdapter";
import { getStaffMembers } from "./roleService";

export async function getRoster() {
  if (isBackendEnabled()) {
    return backendGetAdminRoster();
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return getStaffMembers();
}

export { getAdminPatients, getAdminPatient, getAssignmentStaff, assignAdminPatient, removeAdminPatientAssignment, setAdminPatientStatus };
