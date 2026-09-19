import { useMemo, useState } from "react";
import "./StaffRoles.css";
import Sidebar from "../../components/layout/Sidebar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { NAV_ITEMS, CURRENT_USER } from "../../components/layout/navConfig";
import { getPermissionGroups, getRoles, getStaffMembers, createRole, updateRole, deleteRole, assignRoleToStaff } from "../../services/api/roleService";
import Avatar from "../../components/ui/Avatar";
import { isBackendEnabled } from "../../services/api/config";

const FIELDS = [
    { label: "Demographics", doctor: true, nurse: true, records: true, intern: true, it: false },
    { label: "Vitals", doctor: true, nurse: true, records: false, intern: false, it: false },
    { label: "Medications", doctor: true, nurse: true, records: false, intern: false, it: false },
    { label: "Allergies", doctor: true, nurse: true, records: false, intern: false, it: false },
    { label: "Appointment History", doctor: true, nurse: true, records: true, intern: false, it: false },
    { label: "Clinical Notes", doctor: true, nurse: false, records: false, intern: false, it: false },
    { label: "HIV Status", doctor: true, nurse: false, records: false, intern: false, it: false },
    { label: "Mental Health Notes", doctor: true, nurse: false, records: false, intern: false, it: false },
    { label: "Reproductive History", doctor: true, nurse: false, records: false, intern: false, it: false },
    { label: "Genotype / Blood Group", doctor: true, nurse: false, records: false, intern: false, it: false },
];

function CheckCell({ allowed }) {
    if (allowed) {
        return (
            <span className="sr-check" aria-label="Permitted">
                <Icon name="check" />
            </span>
        );
    }
    return <span className="sr-dash" aria-label="Not permitted">-</span>;
}

function RoleForm({ mode = "create", initialValues, onSubmit, onCancel, saving = false, error = "" }) {
    const [name, setName] = useState(initialValues?.name ?? "");
    const [description, setDescription] = useState(initialValues?.description ?? "");
    const [selectedPermissions, setSelectedPermissions] = useState(initialValues?.permissions ?? []);

    const permissionGroups = useMemo(() => getPermissionGroups(), []);

    const togglePermission = (permissionValue) => {
        setSelectedPermissions((current) =>
            current.includes(permissionValue)
                ? current.filter((value) => value !== permissionValue)
                : [...current, permissionValue]
        );
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit({
            name,
            description,
            permissions: selectedPermissions,
        });
    };

    return (
        <form className="sr-form" onSubmit={handleSubmit}>
            <label className="sr-form__field">
                <span>Role name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Clinical Lead" />
            </label>

            <label className="sr-form__field">
                <span>Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Role purpose and scope" rows="3" />
            </label>

            <div className="sr-form__permissions">
                {permissionGroups.map((group) => (
                    <div key={group.group} className="sr-permission-group">
                        <h3>{group.group}</h3>
                        <div className="sr-permission-grid">
                            {group.permissions.map((permission) => (
                                <label key={permission.value} className="sr-permission-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedPermissions.includes(permission.value)}
                                        onChange={() => togglePermission(permission.value)}
                                    />
                                    <span>{permission.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {error && <div className="sr-form__error">{error}</div>}

            <div className="sr-modal-actions">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving || !name.trim()}>
                    {saving ? (mode === "edit" ? "Saving..." : "Creating...") : mode === "edit" ? "Save changes" : "Create role"}
                </Button>
            </div>
        </form>
    );
}

export default function StaffRoles() {
    const [roles, setRoles] = useState(() => getRoles());
    const [staff, setStaff] = useState(() => getStaffMembers());
    const [roleModalOpen, setRoleModalOpen] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState(null);
    const [savingRole, setSavingRole] = useState(false);
    const [roleError, setRoleError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [assigningStaffId, setAssigningStaffId] = useState(null);
    const [selectedRoleName, setSelectedRoleName] = useState("");

    const activeRoles = useMemo(() => roles.map((role) => ({
        ...role,
        tone: role.name === "Attending Doctor" ? "blue" : role.name === "Nurse" ? "green" : role.name === "Records Clerk" ? "warning" : "gray",
    })), [roles]);

    const openCreateModal = () => {
        setEditingRoleId(null);
        setRoleError("");
        setRoleModalOpen(true);
    };

    const openEditModal = (role) => {
        setEditingRoleId(role.id);
        setRoleError("");
        setRoleModalOpen(true);
    };

    const closeRoleModal = () => {
        setRoleModalOpen(false);
        setEditingRoleId(null);
        setRoleError("");
    };

    const handleRoleSubmit = async ({ name, description, permissions }) => {
        setSavingRole(true);
        setRoleError("");

        try {
            if (editingRoleId) {
                const nextRole = updateRole(editingRoleId, { name, description, permissions });
                setRoles(getRoles());
                setStaff(getStaffMembers());
                setRoleModalOpen(false);
                setEditingRoleId(null);
                return nextRole;
            }

            const nextRole = createRole({ name, description, permissions });
            setRoles(getRoles());
            setRoleModalOpen(false);
            return nextRole;
        } catch (error) {
            setRoleError(error.message || "Unable to save role.");
            return null;
        } finally {
            setSavingRole(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!deleteTarget) return;

        try {
            deleteRole(deleteTarget.id);
            setRoles(getRoles());
            setStaff(getStaffMembers());
            setDeleteTarget(null);
        } catch (error) {
            setRoleError(error.message || "Unable to delete role.");
        }
    };

    const handleExportRoles = () => {
        const csvRows = [
            ["Role", "Description", "Permissions"],
            ...roles.map((role) => [role.name, role.description, role.permissions.join(" | ")]),
        ];

        const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "role-library.csv";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const handleAssignRole = async (staffId) => {
        if (!selectedRoleName) return;

        try {
            assignRoleToStaff(staffId, selectedRoleName);
            setStaff(getStaffMembers());
            setAssigningStaffId(null);
            setSelectedRoleName("");
        } catch (error) {
            setRoleError(error.message || "Unable to assign role.");
        }
    };

    const roleFormValues = useMemo(() => {
        if (!editingRoleId) return null;
        const role = roles.find((item) => item.id === editingRoleId);
        return role ? { name: role.name, description: role.description, permissions: role.permissions } : null;
    }, [editingRoleId, roles]);

    return (
        <div className="sr-page">
            <Sidebar navItems={NAV_ITEMS} user={CURRENT_USER} />

            <div className="sr-main">
                <div className="sr-topstrip" />

                <div className="sr-page-title">
                    <h1>Staff &amp; Roles</h1>
                    <p>Manage access levels, emergency access codes, and session activity</p>
                    {isBackendEnabled() && (
                        <p role="note" style={{ marginTop: 8, padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-warning-light)", color: "var(--color-warning)", fontSize: 13, fontWeight: 700 }}>
                            This role and permission matrix is a local policy view. Live staff, role, and assignment changes are managed by the backend admin endpoints and are not editable here yet. See Roster Management for the live roster.
                        </p>
                    )}
                </div>

                <div className="sr-content">
                    <div className="sr-card">
                        <div className="sr-card-header sr-card-header--split">
                            <div className="sr-card-header__left">
                                <Icon name="shield" />
                                <h2>Role Permission Matrix</h2>
                            </div>
                            <div className="sr-card-header__actions">
                                <Button size="sm" variant="secondary" onClick={openCreateModal}><Icon name="plus" /> Create role</Button>
                            </div>
                        </div>
                        <div className="sr-matrix-wrap">
                            <table className="sr-matrix" aria-label="Role permission matrix">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th><span className="sr-role-pill sr-role-pill--doctor">Doctor</span></th>
                                        <th><span className="sr-role-pill sr-role-pill--nurse">Nurse</span></th>
                                        <th><span className="sr-role-pill sr-role-pill--records">Records</span></th>
                                        <th><span className="sr-role-pill sr-role-pill--intern">Intern</span></th>
                                        <th><span className="sr-role-pill sr-role-pill--it">IT</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {FIELDS.map((f) => (
                                        <tr key={f.label}>
                                            <td>{f.label}</td>
                                            <td><CheckCell allowed={f.doctor} /></td>
                                            <td><CheckCell allowed={f.nurse} /></td>
                                            <td><CheckCell allowed={f.records} /></td>
                                            <td><CheckCell allowed={f.intern} /></td>
                                            <td><CheckCell allowed={f.it} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sr-card">
                        <div className="sr-card-header sr-card-header--split">
                            <div className="sr-card-header__left">
                                <Icon name="users" />
                                <h2>Staff Directory</h2>
                            </div>
                            <div className="sr-card-header__actions">
                                <Button size="sm" variant="secondary" onClick={handleExportRoles}><Icon name="download" /> Export</Button>
                            </div>
                        </div>

                        <div className="sr-directory">
                            <table className="sr-table" aria-label="Staff directory">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Ward</th>
                                        <th>Role</th>
                                        <th>Sessions</th>
                                        <th>Access Code</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staff.map((member) => (
                                        <tr key={member.staffId} className={member.flagged ? "sr-row--flagged" : ""}>
                                            <td>
                                                <div className="sr-staff-cell">
                                                    <Avatar initials={member.initials} size="sm" tone={member.role === "Nurse" ? "green" : member.role === "Records Clerk" ? "amber" : "blue"} />
                                                    <div>
                                                        <div className="sr-staff-name">{member.name}</div>
                                                        <div className="sr-staff-id">{member.staffId}</div>
                                                        {member.flagNote && (
                                                            <div className="sr-flag-note">
                                                                <Icon name="alert" />
                                                                {member.flagNote}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{member.ward}</td>
                                            <td>
                                                <div className="sr-role-stack">
                                                    <Pill tone={member.role === "Attending Doctor" ? "blue" : member.role === "Nurse" ? "green" : member.role === "Records Clerk" ? "warning" : "gray"}>{member.role}</Pill>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="sr-session-dot" />
                                                {member.sessions ?? 1} active
                                            </td>
                                            <td>
                                                {member.codeActive ? (
                                                    <button type="button" className="sr-code-btn">
                                                        <Icon name="key" />
                                                        Code Active
                                                    </button>
                                                ) : (
                                                    <span className="sr-na">N/A</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="sr-action-col">
                                                    {assigningStaffId === member.staffId ? (
                                                        <div className="sr-assign-row">
                                                            <select value={selectedRoleName} onChange={(event) => setSelectedRoleName(event.target.value)}>
                                                                <option value="">Choose role</option>
                                                                {activeRoles.map((role) => (
                                                                    <option key={role.id} value={role.name}>{role.name}</option>
                                                                ))}
                                                            </select>
                                                            <Button size="sm" type="button" onClick={() => handleAssignRole(member.staffId)} disabled={!selectedRoleName}>Save</Button>
                                                            <Button size="sm" type="button" variant="secondary" onClick={() => { setAssigningStaffId(null); setSelectedRoleName(""); }}>Cancel</Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button type="button" className="sr-action-link" onClick={() => { setAssigningStaffId(member.staffId); setSelectedRoleName(member.role); }}>Assign role</button>
                                                            <button type="button" className="sr-action-link sr-action-link--muted" onClick={() => setDeleteTarget({ id: activeRoles.find((role) => role.name === member.role)?.id, label: member.role })}>Remove</button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sr-card">
                        <div className="sr-card-header sr-card-header--split">
                            <div className="sr-card-header__left">
                                <Icon name="shield" />
                                <h2>Role Library</h2>
                            </div>
                        </div>
                        <div className="sr-role-list">
                            {activeRoles.map((role) => (
                                <div key={role.id} className="sr-role-item">
                                    <div className="sr-role-item__head">
                                        <Pill tone={role.tone}>{role.name}</Pill>
                                        <div className="sr-role-item__actions">
                                            <button type="button" className="sr-action-link" onClick={() => openEditModal(role)}>Edit</button>
                                            <button type="button" className="sr-action-link sr-action-link--danger" onClick={() => setDeleteTarget({ id: role.id, label: role.name, protected: role.protected })} disabled={role.protected}>Delete</button>
                                        </div>
                                    </div>
                                    <p>{role.description}</p>
                                    <div className="sr-role-perms">
                                        {role.permissions.map((permission) => (
                                            <span key={permission} className="sr-role-permission">{permission.replace(/_/g, " ")}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={roleModalOpen}
                onClose={closeRoleModal}
                title={editingRoleId ? "Edit role" : "Create new role"}
                subtitle={editingRoleId ? "Update the selected role and its permissions." : "Define a role, assign the correct permissions, and save it."}
                headerIcon="shield"
            >
                <RoleForm
                    mode={editingRoleId ? "edit" : "create"}
                    initialValues={roleFormValues}
                    onSubmit={handleRoleSubmit}
                    onCancel={closeRoleModal}
                    saving={savingRole}
                    error={roleError}
                />
            </Modal>

            <Modal
                open={Boolean(deleteTarget)}
                onClose={() => setDeleteTarget(null)}
                title="Delete role"
                subtitle={deleteTarget ? `This will remove ${deleteTarget.label} from the role library.` : "Delete role"}
                headerIcon="trash"
                footer={
                    <div className="sr-modal-actions">
                        <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button type="button" variant="danger" onClick={handleDeleteRole} disabled={deleteTarget?.protected}>Confirm delete</Button>
                    </div>
                }
            >
                {deleteTarget && (
                    <div className="sr-delete-copy">
                        {deleteTarget.protected ? (
                            <p>This role is protected and cannot be deleted.</p>
                        ) : (
                            <>
                                <p>Are you sure you want to delete the <strong>{deleteTarget.label}</strong> role?</p>
                                <p>Any staff assigned to it will be automatically reset to the default Nurse role.</p>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
