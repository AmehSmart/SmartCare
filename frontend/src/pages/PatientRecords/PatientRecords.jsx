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
import PatientHeader from "./components/PatientHeader";
import PatientTabs from "./components/PatientTabs";
import OverviewTab from "./components/OverviewTab";
import ClinicalTab from "./components/ClinicalTab";
import AppointmentHistoryTab from "./components/AppointmentHistoryTab";
import SensitiveTab from "./components/SensitiveTab";
import AddNoteForm from "./components/AddNoteForm";
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

export default function PatientRecords() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentUser = user || CURRENT_USER;
    const [activeTab, setActiveTab] = useState("overview");
    const [patient, setPatient] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [assignmentSearch, setAssignmentSearch] = useState("");
    const [assignmentType, setAssignmentType] = useState("Primary Care");
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [loading, setLoading] = useState(true);

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
                    setAssignments(getPatientAssignmentsForPatient(nextPatient.id));
                }
            } catch {
                // Out-of-scope (403) or any load failure: send the clinician to the
                // scope-denied screen, which offers the audited break-glass path.
                if (mounted) {
                    navigate(`/patients/${patientId}/denied`, { replace: true });
                }
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
    }, [patientId, user]);

    const isAdmin = hasPermission(currentUser, "manage_assignments") || currentUser.role === "Administrator";

    const eligibleStaff = useMemo(() => {
        return getStaffDirectory().filter((member) => {
            const roleName = String(member.role || "").toLowerCase();
            if (member.roleId === "administrator") return false;
            return roleName.includes("doctor") || roleName.includes("nurse") || roleName.includes("locum");
        });
    }, []);

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

    const handleAssign = () => {
        if (!patient || !selectedStaffId) return;
        assignPatientToStaff({
            patientId: patient.id,
            staffId: selectedStaffId,
            assignmentType,
            ward: patient.tag,
            status: "Active",
        });
        setAssignments(getPatientAssignmentsForPatient(patient.id));
        setAssignmentModalOpen(false);
    };

    const handleRemoveAssignment = () => {
        if (!currentAssignment) return;
        const confirmed = window.confirm("Remove this assignment from the patient care team?");
        if (!confirmed) return;
        removePatientAssignment(currentAssignment.id);
        setAssignments(getPatientAssignmentsForPatient(patient.id));
    };

    const renderTab = () => {
        if (!patient) return null;

        switch (activeTab) {
            case "overview":
                return <OverviewTab patient={patient} assignments={assignments} isAdmin={isAdmin} onAssign={openAssignmentModal} onRemove={handleRemoveAssignment} />;
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
                        <PatientTabs activeTab={activeTab} onChange={setActiveTab} />
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
                        {filteredStaff.length === 0 ? (
                            <p className="assignment-empty">No eligible staff found.</p>
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