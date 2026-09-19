export const NAV_ITEMS = [
    { key: "dashboard",    label: "Dashboard",      icon: "grid" },
    { key: "notifications", label: "Notifications",  icon: "bell" },
    { key: "my-patients",  label: "My Patients",     icon: "users", permission: "view_my_patients" },
    { key: "records",      label: "Patients",        icon: "file", permission: "view_patients" },
    { key: "my-access",    label: "My Access",       icon: "lock", permission: "view_own_access" },
    { key: "audit",        label: "Audit Log",       icon: "audit", permission: "view_audit_logs" },
    { key: "audit-queue",  label: "Audit Queue",     icon: "bell", permission: "view_security_alerts" },
    { key: "staff",        label: "Staff & Roles",   icon: "users", permission: "manage_roles" },
    { key: "roster",       label: "Roster Mgmt.",    icon: "calendar", permission: "assign_roles" },
    { key: "totp",         label: "TOTP Setup",      icon: "key" },
];

export const CURRENT_USER = {
    initials:   "NE",
    shortName:  "Nurse",
    name:       "Nurse Emeka Nwosu",
    id:         "N8002",
    role:       "Nurse",
    department: "Ward B",
    ward:       "Ward B",
    shift:      "Day Shift",
};