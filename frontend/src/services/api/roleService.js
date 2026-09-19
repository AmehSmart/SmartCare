import { AUDIT_EVENTS, PATIENT_ASSIGNMENTS, PATIENTS, ROLE_DEFINITIONS, STAFF_PROFILES } from "./mockData";

const permissionSet = (values = []) => [...new Set(values.filter(Boolean))];
const normalizeRoleName = (roleName) => String(roleName ?? "").trim().toLowerCase();

export function getRoles() {
  return ROLE_DEFINITIONS.map((role) => ({
    ...role,
    permissions: [...role.permissions],
  }));
}

export function getRoleByName(roleName) {
  const normalized = String(roleName ?? "").trim().toLowerCase();
  return getRoles().find((role) => role.name.toLowerCase() === normalized) || null;
}

export function getRolePermissions(roleName) {
  return getRoleByName(roleName)?.permissions ?? [];
}

export function getUserPermissions(user) {
  if (!user) return [];
  return permissionSet(user.permissions?.length ? user.permissions : getRolePermissions(user.role));
}

export function hasPermission(user, permission) {
  return getUserPermissions(user).includes(permission);
}

export function hasAnyPermission(user, permissions = []) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasAllPermissions(user, permissions = []) {
  return permissions.every((permission) => hasPermission(user, permission));
}

export function isAdministrator(user) {
  const roleName = normalizeRoleName(user?.role);
  return roleName === "administrator" || (hasPermission(user, "manage_roles") && hasPermission(user, "view_staff") && hasPermission(user, "view_audit_logs"));
}

export function getPermissionGroups() {
  return [
    {
      group: "Patients",
      permissions: [
        { value: "view_patients", label: "View patients" },
        { value: "create_patients", label: "Create patients" },
        { value: "edit_patients", label: "Edit patients" },
        { value: "delete_patients", label: "Delete patients" },
      ],
    },
    {
      group: "Staff",
      permissions: [
        { value: "view_staff", label: "View staff" },
        { value: "create_staff", label: "Create staff" },
        { value: "edit_staff", label: "Edit staff" },
        { value: "remove_staff", label: "Remove staff" },
      ],
    },
    {
      group: "Roles",
      permissions: [
        { value: "view_roles", label: "View roles" },
        { value: "create_roles", label: "Create roles" },
        { value: "edit_roles", label: "Edit roles" },
        { value: "delete_roles", label: "Delete roles" },
        { value: "assign_roles", label: "Assign roles" },
        { value: "manage_roles", label: "Manage roles" },
      ],
    },
    {
      group: "Audit",
      permissions: [
        { value: "view_audit_logs", label: "View audit logs" },
        { value: "export_audit_logs", label: "Export audit logs" },
      ],
    },
  ];
}

export function addRoleAudit(action, actor, target, details = {}) {
  const auditEntry = {
    id: Date.now(),
    date: new Date().toLocaleDateString("en-GB"),
    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    actor,
    actorFullName: actor,
    actorId: "SYSTEM",
    role: "ADMIN",
    action,
    field: null,
    target,
    ip: "127.0.0.1",
    eventId: `ROLE-${Date.now()}`,
    hash: `role-${Date.now().toString(16)}`,
    prevHash: AUDIT_EVENTS[0]?.hash ?? "genesis",
    chainOk: true,
    details,
  };

  AUDIT_EVENTS.unshift(auditEntry);
  return auditEntry;
}

export function createRole(roleInput) {
  const cleanName = String(roleInput.name ?? "").trim();
  const duplicate = getRoles().some((role) => role.name.toLowerCase() === cleanName.toLowerCase());

  if (!cleanName) {
    throw new Error("Role name is required.");
  }

  if (duplicate) {
    throw new Error("A role with this name already exists.");
  }

  const role = {
    id: `role-${Date.now()}`,
    name: cleanName,
    description: String(roleInput.description ?? "").trim() || "Custom role",
    permissions: permissionSet(roleInput.permissions ?? []),
    protected: false,
  };

  ROLE_DEFINITIONS.push(role);
  addRoleAudit("Role created", "System", cleanName, { permissions: role.permissions });
  return role;
}

export function updateRole(roleId, updates) {
  const index = ROLE_DEFINITIONS.findIndex((role) => role.id === roleId);

  if (index === -1) {
    throw new Error("Role not found.");
  }

  const current = ROLE_DEFINITIONS[index];

  if (current.protected && updates.name && current.name !== updates.name) {
    throw new Error("System roles cannot be renamed.");
  }

  const nextRole = {
    ...current,
    name: updates.name?.trim() || current.name,
    description: updates.description?.trim() || current.description,
    permissions: permissionSet(updates.permissions ?? current.permissions),
  };

  ROLE_DEFINITIONS[index] = nextRole;
  STAFF_PROFILES.forEach((member) => {
    if (member.role === current.name) {
      member.role = nextRole.name;
    }
  });

  addRoleAudit("Role updated", "System", nextRole.name, {
    previous: current.name,
    permissions: nextRole.permissions,
  });

  return nextRole;
}

export function deleteRole(roleId) {
  const target = ROLE_DEFINITIONS.find((role) => role.id === roleId);

  if (!target) {
    throw new Error("Role not found.");
  }

  if (target.protected) {
    throw new Error("This is a protected role and cannot be deleted.");
  }

  const assigned = STAFF_PROFILES.filter((member) => member.role === target.name);
  if (assigned.length > 0) {
    assigned.forEach((member) => {
      member.role = "Nurse";
      member.roleId = "nurse";
    });
  }

  const index = ROLE_DEFINITIONS.findIndex((role) => role.id === roleId);
  const [deleted] = ROLE_DEFINITIONS.splice(index, 1);
  addRoleAudit("Role deleted", "System", deleted.name, { assignedCount: assigned.length });

  return deleted;
}

export function getStaffMembers() {
  return STAFF_PROFILES.map((member) => ({
    ...member,
    permissions: getRolePermissions(member.role),
  }));
}

export function assignRoleToStaff(staffId, roleName) {
  const member = STAFF_PROFILES.find((person) => person.staffId === staffId);
  const nextRole = getRoleByName(roleName);

  if (!member) {
    throw new Error("Staff member not found.");
  }

  if (!nextRole) {
    throw new Error("Role not found.");
  }

  const previousRole = member.role;
  member.role = nextRole.name;
  member.roleId = nextRole.id;
  member.permissions = [...nextRole.permissions];

  addRoleAudit("Role assigned", "System", `${member.name} → ${nextRole.name}`, {
    previousRole,
    newRole: nextRole.name,
  });

  return member;
}

export function updateStaffAssignment(staffId, assignment) {
  const member = STAFF_PROFILES.find((person) => person.staffId === staffId);

  if (!member) {
    throw new Error("Staff member not found.");
  }

  const role = getRoleByName(assignment.role);
  if (!role) {
    throw new Error("Role not found.");
  }

  const previous = {
    role: member.role,
    ward: member.ward,
    shift: member.shift,
  };

  member.role = role.name;
  member.roleId = role.id;
  member.ward = String(assignment.ward ?? "").trim() || member.ward;
  member.department = member.ward;
  member.shift = String(assignment.shift ?? "").trim() || member.shift;
  member.permissions = [...role.permissions];

  addRoleAudit("Staff assignment updated", "System", member.name, {
    previous,
    next: { role: member.role, ward: member.ward, shift: member.shift },
  });

  return member;
}

export function getPatientAssignments() {
  return [...PATIENT_ASSIGNMENTS];
}

export function getPatientAssignmentsForPatient(patientId) {
  return PATIENT_ASSIGNMENTS.filter((assignment) => assignment.patientId === patientId && assignment.status !== "Removed");
}

export function getPatientAssignmentsForStaff(staffId) {
  return PATIENT_ASSIGNMENTS.filter((assignment) => assignment.staffId === staffId && assignment.status !== "Removed");
}

export function getAssignedPatientsForStaff(staffId) {
  const assignments = getPatientAssignmentsForStaff(staffId);
  return assignments.map((assignment) => {
    const patient = PATIENTS.find((entry) => entry.id === assignment.patientId);
    return patient ? { ...patient, assignmentType: assignment.assignmentType, assignmentWard: assignment.ward, assignmentStatus: assignment.status } : null;
  }).filter(Boolean);
}

export function assignPatientToStaff({ patientId, staffId, assignmentType, ward, startDate, status = "Active" }) {
  const patient = PATIENTS.find((entry) => entry.id === patientId);
  const staffMember = STAFF_PROFILES.find((member) => member.staffId === staffId);

  if (!patient) throw new Error("Patient not found.");
  if (!staffMember) throw new Error("Staff member not found.");

  const existing = PATIENT_ASSIGNMENTS.find((assignment) => assignment.patientId === patientId && assignment.staffId === staffId && assignment.status !== "Removed");

  if (existing) {
    existing.assignmentType = assignmentType || existing.assignmentType;
    existing.ward = ward || existing.ward;
    existing.startDate = startDate || existing.startDate;
    existing.status = status || existing.status;
    addRoleAudit("Patient reassigned", "System", `${patient.name} → ${staffMember.name}`, { patientId, staffId, assignmentType, ward, status });
    return existing;
  }

  const assignment = {
    id: `assignment-${Date.now()}`,
    patientId,
    staffId,
    staffName: staffMember.name,
    assignmentType: assignmentType || "Assigned Staff",
    ward: ward || patient.ward || staffMember.ward,
    startDate: startDate || new Date().toISOString().slice(0, 10),
    status,
  };

  PATIENT_ASSIGNMENTS.push(assignment);
  addRoleAudit("Patient assigned", "System", `${patient.name} → ${staffMember.name}`, { patientId, staffId, assignmentType: assignment.assignmentType, ward: assignment.ward, status });
  return assignment;
}

export function removePatientAssignment(assignmentId) {
  const assignment = PATIENT_ASSIGNMENTS.find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error("Assignment not found.");

  assignment.status = "Removed";
  const patient = PATIENTS.find((entry) => entry.id === assignment.patientId);
  addRoleAudit("Patient unassigned", "System", `${patient?.name ?? assignment.patientId} → ${assignment.staffName}`, { patientId: assignment.patientId, staffId: assignment.staffId, assignmentId });
  return assignment;
}

export function getStaffDirectory() {
  return STAFF_PROFILES.map((member) => ({
    ...member,
    permissions: getRolePermissions(member.role),
  }));
}
