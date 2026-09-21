import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { CURRENT_USER, NAV_ITEMS } from "../../components/layout/navConfig";
import { useAuth } from "../../context/useAuth";
import { getPatients } from "../../services/api/patientApi";
import { createAdminPatient, getAdminDepartments, getAssignmentStaff } from "../../services/api/adminApi";
import { isBackendEnabled } from "../../services/api/config";
import "./PatientWorklist.css";

export default function PatientWorklist() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.backendRole === "ADMIN" && isBackendEnabled();
    const isRecordsClerk = String(user?.role || "").toLowerCase().includes("records");
    const [patients, setPatients] = useState([]);
    const [query, setQuery] = useState("");
    const [scopeOnly, setScopeOnly] = useState(false);
    const [statusFilter, setStatusFilter] = useState("All");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        // Server-side search (debounced): the backend scopes results per role, so a
        // records clerk searches the whole facility while a nurse stays on her ward.
        const handle = setTimeout(async () => {
            try {
                const data = await getPatients(user, query);
                if (mounted) { setPatients(data); setLoadError(""); }
            } catch (error) {
                if (mounted) { setPatients([]); setLoadError(error?.message || "Unable to load patients. Please try again."); }
            } finally {
                if (mounted) setLoading(false);
            }
        }, query ? 300 : 0);

        return () => {
            mounted = false;
            clearTimeout(handle);
        };
    }, [user, query]);

    const statusOptions = useMemo(() => {
        const statuses = new Set(["All"]);
        patients.forEach((patient) => {
            if (patient.status) statuses.add(patient.status);
        });
        return [...statuses];
    }, [patients]);

    // The query is applied server-side (scoped per role); only status/scope
    // filters are applied client-side on the returned results.
    const filtered = useMemo(() => patients.filter((patient) => {
        const matchesStatus = statusFilter === "All" || patient.status === statusFilter;
        return matchesStatus && (!scopeOnly || patient.scope === "In scope");
    }), [patients, scopeOnly, statusFilter]);

    return (
        <div className="worklist-page">
            <Sidebar navItems={NAV_ITEMS} user={user || CURRENT_USER} />
            <div className="worklist-main">
                <Topbar />
                <main className="worklist-content">
                    <div className="worklist-heading">
                        <div>
                            <p className="worklist-eyebrow">Clinical worklist</p>
                            <h1>Patients</h1>
                            <p>{isRecordsClerk ? "Search the full facility patient register (demographics and billing only)." : "Search is limited to your current role, ward, and shift scope."}</p>
                        </div>
                        <div className="worklist-heading__actions">
                            {isAdmin && <Button onClick={() => setCreateOpen(true)}><Icon name="plus" /> Add Patient</Button>}
                            <Pill tone="blue"><Icon name="shield" /> {user?.ward || "All Units"} · {user?.shift || "All Shifts"}</Pill>
                        </div>
                    </div>

                    <section className="worklist-layout">
                        <aside className="worklist-filters" aria-label="Patient filters">
                            <label className="worklist-search">
                                <span>Search patients</span>
                                <div><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, or ward" /></div>
                            </label>

                            <div className="worklist-status-group" aria-label="Status filter">
                                <span>Status</span>
                                <div className="worklist-status-options">
                                    {statusOptions.map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            className={`worklist-status-pill${statusFilter === status ? " worklist-status-pill--active" : ""}`}
                                            onClick={() => setStatusFilter(status)}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="worklist-check"><input type="checkbox" checked={scopeOnly} onChange={(event) => setScopeOnly(event.target.checked)} /> Show only in-scope records</label>
                            <div className="worklist-filter-note"><Icon name="lock" /><span>Patient visibility is enforced by the policy service. Hidden fields never reach this screen.</span></div>
                        </aside>

                        <section className="worklist-results" aria-live="polite">
                            <div className="worklist-results__header"><h2>{loading ? "Loading..." : `${filtered.length} patients`}</h2><span>Updated just now</span></div>
                            {loading ? (
                                <div className="worklist-empty"><Icon name="search" /><h2>Loading patients</h2><p>Please wait while the patient list is refreshed.</p></div>
                            ) : loadError ? <div className="worklist-empty" role="alert"><Icon name="alert" /><h2>Unable to load patients</h2><p>{loadError}</p><Button onClick={() => window.location.reload()}>Try again</Button></div> : filtered.length === 0 ? <div className="worklist-empty"><Icon name="search" /><h2>No matching patients</h2><p>Try a different name, patient ID, ward, or status filter.</p></div> : <div className="patient-result-list">{filtered.map((patient) => <PatientResult key={patient.id} patient={patient} />)}</div>}
                        </section>
                    </section>
                </main>
            </div>
            {isAdmin && <CreatePatientModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(patient) => navigate(`/patients/${patient.id}`)} />}
        </div>
    );
}

function PatientResult({ patient }) {
    const destination = patient.scope === "In scope" ? `/patients/${patient.id}` : `/patients/${patient.id}/denied`;
    return <Link className="patient-result" to={destination}>
        <Avatar initials={patient.initials} size="md" />
        <span className="patient-result__identity"><strong>{patient.name}</strong><span>{patient.id} · {patient.age} years · {patient.gender}</span><small>{patient.note}</small></span>
        <span className="patient-result__meta"><strong>{patient.ward}</strong><Pill tone={patient.tone}>{patient.scope}</Pill></span>
        <Icon name="chevron" />
    </Link>;
}

function CreatePatientModal({ open, onClose, onCreated }) {
    const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", birthDate: "", departmentId: "", wardId: "", status: "ACTIVE", assignedStaffId: "" });
    const [departments, setDepartments] = useState([]);
    const [staff, setStaff] = useState([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError("");
        Promise.all([getAdminDepartments(), getAssignmentStaff()]).then(([departmentData, staffData]) => {
            setDepartments(departmentData.items || []);
            setStaff(staffData.items || []);
        }).catch((loadError) => setError(loadError?.message || "Unable to load registration options."));
    }, [open]);

    const selectedDepartment = departments.find((department) => department.id === form.departmentId);
    const update = (field, value) => setForm((current) => ({ ...current, [field]: value, ...(field === "departmentId" ? { wardId: "" } : {}) }));
    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setSaving(true);
        try {
            const patient = await createAdminPatient({ ...form, birthDate: form.birthDate || undefined, departmentId: form.departmentId || undefined, wardId: form.wardId || undefined, assignedStaffId: form.assignedStaffId || undefined });
            setForm({ firstName: "", middleName: "", lastName: "", birthDate: "", departmentId: "", wardId: "", status: "ACTIVE", assignedStaffId: "" });
            onClose();
            onCreated(patient);
        } catch (createError) {
            setError(createError?.message || "Unable to create patient.");
        } finally { setSaving(false); }
    };

    return <Modal open={open} onClose={onClose} title="Add patient" subtitle="Create a real patient record in the Clinical database." headerIcon="users" footer={null}>
        <form className="patient-create-form" onSubmit={submit}>
            <div className="patient-create-section"><h3>Patient identity</h3><div className="patient-create-grid">
                <label>First name<input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
                <label>Middle name<input value={form.middleName} onChange={(event) => update("middleName", event.target.value)} /></label>
                <label>Last name<input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
                <label>Date of birth<input type="date" value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} /></label>
            </div><p className="patient-create-note">MRN is generated by the backend after submission.</p></div>
            <div className="patient-create-section"><h3>Administrative information</h3><div className="patient-create-grid">
                <label>Department<select value={form.departmentId} onChange={(event) => update("departmentId", event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
                <label>Ward<select value={form.wardId} onChange={(event) => update("wardId", event.target.value)} disabled={!selectedDepartment}><option value="">Select ward</option>{(selectedDepartment?.wards || []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select></label>
                <label>Status<select value={form.status} onChange={(event) => update("status", event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="DISCHARGED">Discharged</option></select></label>
                <label>Assign staff<select value={form.assignedStaffId} onChange={(event) => update("assignedStaffId", event.target.value)}><option value="">Leave unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.assignments?.[0]?.role || "Staff"}</option>)}</select></label>
            </div></div>
            {error && <p className="registration-error" role="alert"><Icon name="alert" /> {error}</p>}
            <div className="patient-create-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create patient"}</Button></div>
        </form>
    </Modal>;
}