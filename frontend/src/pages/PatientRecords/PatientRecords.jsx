import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import "./PatientRecords.css";
import Sidebar from "../../components/layout/Sidebar";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { NAV_ITEMS, CURRENT_USER } from "../../components/layout/navConfig";
import { getPatientById, getPatientFieldAccess } from "../../services/api/patientApi";
import { assignPatientToStaff, getPatientAssignmentsForPatient, getStaffDirectory, removePatientAssignment, hasPermission } from "../../services/api/roleService";
import { getAssignmentStaff, assignAdminPatient, removeAdminPatientAssignment, setAdminPatientStatus } from "../../services/api/adminApi";
import { isBackendEnabled } from "../../services/api/config";
import PatientHeader from "./components/PatientHeader";
import PatientTabs from "./components/PatientTabs";
import OverviewTab from "./components/OverviewTab";
import ClinicalTab from "./components/ClinicalTab";
import AppointmentHistoryTab from "./components/AppointmentHistoryTab";
import SensitiveTab from "./components/SensitiveTab";
import AddNoteForm from "./components/AddNoteForm";
import TransferControl from "./components/TransferControl";
import RecentAccessLog from "./components/RecentAccessLog";
import { useAuth } from "../../context/useAuth";

const ACCESS_LOG = [
    { time: "08:29", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "allergies" },
    { time: "08:29", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "vitals" },
    { time: "08:29", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "demographics" },
    { time: "08:27", user: "Nurse Emeka Nwosu", action: "EMERGENCY LOGIN", flagged: true },
];

const VITALS = [
    { label: "Blood Pressure", value: "110/72", unit: "mmHg", tone: "blue" },
    { label: "Heart Rate", value: "84", unit: "bpm", tone: "red" },
    { label: "Temperature", value: "37.0", unit: "°C", tone: "amber" },
    { label: "Oxygen Saturation", value: "99", unit: "%", tone: "teal" },
    { label: "Weight", value: "71", unit: "kg", tone: "purple" },
];

// Which chart tabs each role may see, matching the backend field policy.
const TAB_ACCESS = {
    "Attending Doctor": ["overview", "clinical", "appointments", "sensitive"],
    "Doctor": ["overview", "clinical", "appointments", "sensitive"],
    "Nurse": ["overview", "clinical", "appointments", "sensitive"],
    "Visiting/Locum Doctor": ["overview", "clinical", "appointments"],
    "Lab/Pharmacy Staff": ["overview", "clinical"],
    "Records Clerk": ["overview"],
    "Administrator": ["overview"],
};

export default function PatientRecords() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentUser = user || CURRENT_USER;
    const allowedTabs = TAB_ACCESS[currentUser.role] || ["overview", "clinical", "appointments"];
    const [activeTab, setActiveTab] = useState("overview");
    const [patient, setPatient] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [assignmentSearch, setAssignmentSearch] = useState("");
    const [assignmentType, setAssignmentType] = useState("Primary Care");
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [actionError, setActionError] = useState("");
    const [availableStaff, setAvailableStaff] = useState([]);
    const [assignmentStaffLoading, setAssignmentStaffLoading] = useState(false);
    const [assignmentStaffError, setAssignmentStaffError] = useState("");

    useEffect(() => {
        let mounted = true;
        const accessUser = user || CURRENT_USER;

        async function loadPatient() {
            try {
                if (!patientId) {
                    return;
                }

                const nextPatient = await getPatientById(patientId, accessUser);
                if (mounted) {
                    setPatient({
                        id: nextPatient.id,
                        patientNumber: nextPatient.patientNumber,
                        initials: nextPatient.initials,
                        name: nextPatient.name,
                        gender: nextPatient.gender,
                        age: nextPatient.age,
                        tag: nextPatient.ward,
                        admitted: "8 Jun 2026",
                        code: nextPatient.id,
                        dob: nextPatient.demographics?.dob || "Not available",
                        address: nextPatient.demographics?.address || "Not available",
                        phone: nextPatient.demographics?.phone || "Not available",
                        status: nextPatient.status,
                        vitals: VITALS,
                        allergies: ["Latex (mild)"],
                        fieldAccess: getPatientFieldAccess(nextPatient, accessUser.role),
                    });
                    if (accessUser?.backendRole === "ADMIN" && isBackendEnabled()) {
                        setAssignments((nextPatient.assignments || []).map((assignment) => ({ id: assignment.id, staffId: assignment.staff?.id, staffName: assignment.staff?.displayName, assignmentType: "Care team", ward: nextPatient.ward, status: assignment.endsAt && new Date(assignment.endsAt) <= new Date() ? "Removed" : "Active" })));
                        if (mounted) {
                            setAssignmentStaffLoading(true);
                            setAssignmentStaffError("");
                        }
                        try {
                            const candidates = await getAssignmentStaff();
                            if (mounted) setAvailableStaff((candidates.items || []).map((staff) => ({ staffId: staff.id, name: staff.displayName, role: staff.assignments?.[0]?.role || "Staff", ward: staff.assignments?.[0]?.ward?.name || "-", department: staff.assignments?.[0]?.department?.name || "-" })));
                        } catch {
                            if (mounted) setAssignmentStaffError("Unable to load staff. Please try again.");
                        } finally {
                            if (mounted) setAssignmentStaffLoading(false);
                        }
                    } else setAssignments(getPatientAssignmentsForPatient(nextPatient.id));
                }
            } catch (err) {
                if (!mounted) return;
                // Only a genuine scope denial (403) goes to the break-glass path.
                // Other failures (e.g. a 503 while the audit service wakes) show an
                // error with retry - they must NOT look like a scope denial.
                if (err?.status === 403 || err?.code === "OUTSIDE_AUTHORIZED_SCOPE") {
                    navigate(`/patients/${patientId}/denied`, { replace: true });
                    return;
                }
                setLoadError(err?.message || "This patient could not be loaded right now. Please try again.");
                return;
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadPatient();

        return () => {
            mounted = false;
        };
    }, [patientId, user, navigate]);

    const isAdmin = currentUser.backendRole === "ADMIN" || hasPermission(currentUser, "manage_assignments") || currentUser.role === "Administrator";

    const eligibleStaff = useMemo(() => {
        const source = currentUser.backendRole === "ADMIN" && isBackendEnabled() ? availableStaff : getStaffDirectory();
        return source.filter((member) => {
            const roleName = String(member.role || "").toLowerCase();
            if (member.roleId === "administrator") return false;
            return roleName.includes("doctor") || roleName.includes("nurse") || roleName.includes("locum");
        });
    }, [availableStaff, currentUser.backendRole]);

    const filteredStaff = useMemo(() => {
        const normalized = assignmentSearch.trim().toLowerCase();
        if (!normalized) return eligibleStaff;
        return eligibleStaff.filter((member) => `${member.name} ${member.staffId} ${member.department} ${member.ward}`.toLowerCase().includes(normalized));
    }, [assignmentSearch, eligibleStaff]);

    const currentAssignment = assignments.find((assignment) => assignment.status !== "Removed") || null;

    const openAssignmentModal = () => {
        if (!patient) return;
        const firstCandidate = eligibleStaff[0];
        setSelectedStaffId(currentAssignment?.staffId || firstCandidate?.staffId || "");
        setAssignmentSearch("");
        setAssignmentType(currentAssignment?.assignmentType || "Primary Care");
        setAssignmentModalOpen(true);
    };

    const handleAssign = async () => {
        if (!patient || !selectedStaffId) return;
        setActionError("");
        try {
            if (currentUser.backendRole === "ADMIN" && isBackendEnabled()) {
                if (currentAssignment && currentAssignment.staffId !== selectedStaffId) {
                    await removeAdminPatientAssignment(currentAssignment.id);
                }
                await assignAdminPatient(patient.id, selectedStaffId);
                const selected = eligibleStaff.find((staff) => staff.staffId === selectedStaffId);
                setAssignments([{ id: `pending-${selectedStaffId}`, staffId: selectedStaffId, staffName: selected?.name, assignmentType: "Care team", ward: patient.tag, status: "Active" }]);
                setAssignmentModalOpen(false);
                return;
            }
            assignPatientToStaff({ patientId: patient.id, staffId: selectedStaffId, assignmentType, ward: patient.tag, status: "Active" });
            setAssignments(getPatientAssignmentsForPatient(patient.id));
            setAssignmentModalOpen(false);
        } catch (error) {
            setActionError(error?.message || "Unable to assign patient to staff.");
        }
    };

    const handleRemoveAssignment = async () => {
        if (!currentAssignment) return;
        const confirmed = window.confirm("Remove this assignment from the patient care team?");
        if (!confirmed) return;
        setActionError("");
        try {
            if (currentUser.backendRole === "ADMIN" && isBackendEnabled()) {
                await removeAdminPatientAssignment(currentAssignment.id);
                setAssignments((items) => items.map((item) => item.id === currentAssignment.id ? { ...item, status: "Removed" } : item));
            } else { removePatientAssignment(currentAssignment.id); setAssignments(getPatientAssignmentsForPatient(patient.id)); }
        } catch (error) {
            setActionError(error?.message || "Unable to remove patient assignment.");
        }
    };

    const handleStatusChange = async (status) => {
        if (!patient || currentUser.backendRole !== "ADMIN" || !isBackendEnabled()) return;
        setActionError("");
        try {
            const updated = await setAdminPatientStatus(patient.id, status);
            setPatient((current) => current ? { ...current, status: updated.status } : current);
        } catch (error) {
            setActionError(error?.message || "Unable to update patient status.");
        }
    };

    const renderTab = () => {
        if (!patient) return null;

        // Never render a tab the role is not permitted to see.
        const safeTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];
        switch (safeTab) {
            case "overview":
                return (
                    <>
                        <OverviewTab patient={patient} assignments={assignments} isAdmin={isAdmin} onAssign={openAssignmentModal} onRemove={handleRemoveAssignment} />
                        <TransferControl patientId={patient.id} role={currentUser.role} />
                    </>
                );
            case "clinical":
                return (
                    <>
                        <ClinicalTab patient={patient} />
                        {hasPermission(currentUser, "edit_patients") && (
                            <AddNoteForm patientId={patient.id} fhirId={patient.patientNumber} />
                        )}
                    </>
                );
            case "appointments":
                return <AppointmentHistoryTab />;
            case "sensitive":
                return <SensitiveTab patientId={patient.id} user={currentUser} />;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="pr-page">
                <Sidebar navItems={NAV_ITEMS} activeKey="records" user={currentUser} />
                <div className="pr-main">
                    <div className="pr-topstrip" />
                    <div className="pr-page-title">
                        <div className="pr-page-title__inner">
                            <h1>Patient Records</h1>
                            <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                    <div className="pr-content">
                        <div className="pr-card">
                            <p className="pr-loading">Loading patient record...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="pr-page">
                <Sidebar navItems={NAV_ITEMS} activeKey="records" user={currentUser} />
                <div className="pr-main">
                    <div className="pr-topstrip" />
                    <div className="pr-page-title">
                        <div className="pr-page-title__inner">
                            <h1>Patient Records</h1>
                            <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                    <div className="pr-content">
                        <div className="pr-card">
                            <p className="pr-loading" role="alert">{loadError}</p>
                            <p className="pr-loading" style={{ opacity: 0.7 }}>The service may be waking up. Wait a moment and reload.</p>
                            <Button onClick={() => window.location.reload()}>Retry</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="pr-page">
                <Sidebar navItems={NAV_ITEMS} activeKey="records" user={currentUser} />
                <div className="pr-main">
                    <div className="pr-topstrip" />
                    <div className="pr-page-title">
                        <div className="pr-page-title__inner">
                            <h1>Patient Records</h1>
                            <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                    <div className="pr-content">
                        <div className="pr-card">
                            <p className="pr-loading">Patient record not found.</p>
                            <Link className="pr-back-link" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pr-page">
            <Sidebar
                navItems={NAV_ITEMS}
                activeKey="records"
                onSelect={() => { }}
                user={currentUser}
            />

            <div className="pr-main">
                <div className="pr-topstrip" />
                <div className="pr-page-title">
                    <div className="pr-page-title__inner">
                        <h1>Patient Records</h1>
                        <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                    </div>
                </div>

                <div className="pr-content">
                    <div className="pr-breadcrumb">
                        <Link to="/patients" className="pr-breadcrumb__link">
                            <Icon name="chevron" className="pr-breadcrumb__back" />
                            <span>Patients</span>
                        </Link>
                        <span className="pr-breadcrumb__sep">/</span>
                        <strong>Patient Details</strong>
                    </div>

                    <div className="pr-card">
                        <PatientHeader patient={patient} />
                        {actionError && <p className="registration-error" role="alert"><Icon name="alert" /> {actionError}</p>}
                        {currentUser.backendRole === "ADMIN" && isBackendEnabled() && (
                            <div className="pr-assignment-box" style={{ margin: "0 24px 16px" }}>
                                <span className="pr-assignment-label">Administrative patient status</span>
                                <select value={patient.status} onChange={(event) => handleStatusChange(event.target.value)} aria-label="Patient status">
                                    <option value="ACTIVE">Active</option><option value="DISCHARGED">Discharged</option><option value="INACTIVE">Inactive</option>
                                </select>
                            </div>
                        )}
                        <PatientTabs activeTab={activeTab} onChange={setActiveTab} allowedTabs={allowedTabs} />
                        {renderTab()}
                    </div>

                    <div className="pr-card">
                        <RecentAccessLog entries={ACCESS_LOG} />
                    </div>
                </div>
            </div>

            <Modal
                open={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                title="Assign staff"
                subtitle={`Patient: ${patient?.name || ""} · MRN: ${patient?.code || ""}`}
                headerIcon="users"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setAssignmentModalOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleAssign} disabled={!selectedStaffId}>Assign staff</Button>
                    </>
                }
            >
                <div className="assignment-modal">
                    <label className="assignment-field">
                        <span>Staff type</span>
                        <select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)}>
                            <option value="Primary Care">Primary Care</option>
                            <option value="Attending Doctor">Attending Doctor</option>
                            <option value="Nurse">Nurse</option>
                        </select>
                    </label>

                    <label className="assignment-field">
                        <span>Select staff</span>
                        <input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Search staff..." />
                    </label>

                    <div className="assignment-list">
                        {assignmentStaffLoading ? (
                            <p className="assignment-empty">Loading staff...</p>
                        ) : assignmentStaffError ? (
                            <p className="assignment-empty">{assignmentStaffError}</p>
                        ) : filteredStaff.length === 0 ? (
                            <p className="assignment-empty">No assignable staff found.</p>
                        ) : filteredStaff.map((member) => (
                            <button
                                key={member.staffId}
                                type="button"
                                className={`assignment-option${selectedStaffId === member.staffId ? " assignment-option--selected" : ""}`}
                                onClick={() => setSelectedStaffId(member.staffId)}
                            >
                                <div>
                                    <strong>{member.name}</strong>
                                    <small>{member.role} · {member.department} · {member.ward}</small>
                                </div>
                                <span>{member.staffId}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
