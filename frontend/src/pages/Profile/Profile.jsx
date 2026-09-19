import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import Pill from "../../components/ui/Pill";
import Icon from "../../components/ui/Icon";
import { NAV_ITEMS } from "../../components/layout/navConfig";
import { useAuth } from "../../context/useAuth";
import { updateStaffProfile } from "../../services/api/authApi";
import { getRolePermissions } from "../../services/api/roleService";

export default function Profile() {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [form, setForm] = useState(() => ({
        name: user?.name ?? "",
        department: user?.department ?? "",
        ward: user?.ward ?? "",
        shift: user?.shift ?? "",
    }));

    if (!user) {
        navigate("/login", { replace: true });
        return null;
    }

    const permissions = getRolePermissions(user.role);
    const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const startEditing = () => {
        setForm({ name: user.name, department: user.department, ward: user.ward, shift: user.shift });
        setMessage("");
        setError("");
        setEditing(true);
    };

    const cancelEditing = () => {
        setForm({ name: user.name, department: user.department, ward: user.ward, shift: user.shift });
        setError("");
        setEditing(false);
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        if (!form.name.trim() || !form.department.trim() || !form.ward.trim() || !form.shift.trim()) {
            setError("Name, department, ward, and shift are required.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");
        try {
            const updated = await updateStaffProfile(user.id, form);
            updateUser(updated);
            setForm({ name: updated.name, department: updated.department, ward: updated.ward, shift: updated.shift });
            setEditing(false);
            setMessage("Profile updated successfully.");
        } catch (saveError) {
            setError(saveError.message || "Unable to update your profile.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="profile-page">
            <Sidebar navItems={NAV_ITEMS} user={user} />
            <div className="profile-main">
                <Topbar initials={user.initials} />
                <main className="profile-content">
                    <header className="profile-heading">
                        <div><p className="profile-eyebrow">Account</p><h1>Profile</h1><p>Review your staff information and current access context.</p></div>
                        {!editing && <Button onClick={startEditing}><Icon name="edit" /> Edit profile</Button>}
                    </header>

                    {message && <div className="profile-feedback profile-feedback--success" role="status"><Icon name="check" /> {message}</div>}
                    {error && <div className="profile-feedback profile-feedback--error" role="alert"><Icon name="alert" /> {error}</div>}

                    <section className="profile-card profile-identity-card">
                        <div className="profile-identity"><Avatar initials={user.initials} size="lg" /><div><h2>{user.name}</h2><p>{user.id} · {user.role}</p></div><Pill tone="green">Active</Pill></div>
                    </section>

                    <form className="profile-card" onSubmit={saveProfile}>
                        <div className="profile-card-heading"><div><h2>Personal information</h2><p>These details are used throughout your staff profile.</p></div>{editing && <span className="profile-editing-label">Editing</span>}</div>
                        <div className="profile-form-grid">
                            <Field label="Full name" value={form.name} editing={editing} onChange={(value) => setField("name", value)} />
                            <ReadOnlyField label="Staff ID" value={user.id} />
                            <Field label="Department" value={form.department} editing={editing} onChange={(value) => setField("department", value)} />
                            <Field label="Ward or unit" value={form.ward} editing={editing} onChange={(value) => setField("ward", value)} />
                            <Field label="Approved shift" value={form.shift} editing={editing} onChange={(value) => setField("shift", value)} />
                            <ReadOnlyField label="Role" value={user.role} note="Role changes are managed by an authorized administrator." />
                        </div>
                        {editing && <div className="profile-actions"><Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></div>}
                    </form>

                    <section className="profile-card">
                        <div className="profile-card-heading"><div><h2>Access and permissions</h2><p>Your role determines the actions and records available to you.</p></div><Pill tone="blue">{user.role}</Pill></div>
                        <div className="profile-permissions">{permissions.length ? permissions.map((permission) => <span key={permission}>{permission.replace(/_/g, " ")}</span>) : <span>No permissions assigned</span>}</div>
                    </section>

                    <section className="profile-card profile-security-card">
                        <div><h2>Security</h2><p>Use the sign-out control in the navigation to end your authenticated session.</p></div>
                        <Button variant="secondary" onClick={() => navigate("/admin/totp")}><Icon name="key" /> TOTP setup</Button>
                    </section>
                </main>
            </div>
        </div>
    );
}

function Field({ label, value, editing, onChange }) {
    return <label className="profile-field"><span>{label}</span>{editing ? <input value={value} onChange={(event) => onChange(event.target.value)} /> : <strong>{value || "Not available"}</strong>}</label>;
}

function ReadOnlyField({ label, value, note }) {
    return <div className="profile-field"><span>{label}</span><strong>{value || "Not available"}</strong>{note && <small>{note}</small>}</div>;
}
