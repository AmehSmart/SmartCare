import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import StatsRow from "./components/StatsRow";
import ProfileCard from "./components/ProfileCard";
import QuickActions from "./components/QuickActions";
import ActivePatients from "./components/ActivePatients";
import RecentActivity from "./components/RecentActivity";
import PermissionsPanel from "./components/PermissionsPanel";
import Icon from "../../components/ui/Icon";
import { NAV_ITEMS, CURRENT_USER } from "../../components/layout/navConfig";
import { useAuth } from "../../context/useAuth";
import { getPatients } from "../../services/api/patientApi";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Pill from "../../components/ui/Pill";
import Avatar from "../../components/ui/Avatar";
import { getPatientAssignments, getUserPermissions, hasPermission } from "../../services/api/roleService";

const STAFF_STATS = [
    { label: "Active Patients", value: 10, note: "under your care", icon: "users", tint: "blue" },
];

const RECENT_ACTIVITY = [
    { tag: "Login", tagType: "blue", name: null, time: "just now" },
    { tag: "Field accessed", tagType: "green", name: "Fatima Abdullahi", time: "4d ago" },
    { tag: "Viewed record", tagType: "blue", name: "Fatima Abdullahi", time: "4d ago" },
    { tag: "Login", tagType: "blue", name: null, time: "4d ago" },
    { tag: "Break glass", tagType: "warning", name: "Fatima Abdullahi", time: "4d ago", flagged: true },
];

export default function Dashboard() {
    const [activeNav, setActiveNav] = useState("dashboard");
    const [allPatients, setAllPatients] = useState([]);
    const [activePatients, setActivePatients] = useState([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState("");
    const [activePatientsOpen, setActivePatientsOpen] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const doctor = {
        ...(user || CURRENT_USER),
        accessCode: "Active",
        fieldsAccess: "10 fields",
    };
    const isAdmin = hasPermission(doctor, "manage_roles");
    const patientMetrics = useMemo(() => {
        const totalPatients = allPatients.length;
        const activePatientsCount = allPatients.filter((patient) => patient.status === "Active").length;
        const dischargedPatientsCount = allPatients.filter((patient) => patient.status === "Discharged").length;
        const assignmentRecords = getPatientAssignments().filter((assignment) => assignment.status !== "Removed");
        const assignedPatientIds = new Set(assignmentRecords.map((assignment) => assignment.patientId));
        const patientsRequiringAssignment = allPatients.filter((patient) => !assignedPatientIds.has(patient.id)).length;

        return {
            totalPatients,
            activePatientsCount,
            dischargedPatientsCount,
            patientsRequiringAssignment,
        };
    }, [allPatients]);
    const stats = isAdmin ? [
        { label: "Total Patients", value: patientMetrics.totalPatients, note: "registered cases", icon: "users", tint: "blue" },
        { label: "Active Patients", value: patientMetrics.activePatientsCount, note: "currently active", icon: "heart", tint: "green" },
        { label: "Discharged Patients", value: patientMetrics.dischargedPatientsCount, note: "completed cases", icon: "check", tint: "gray" },
        { label: "Patients Requiring Assignment", value: patientMetrics.patientsRequiringAssignment, note: "awaiting assignment", icon: "file", tint: "amber" },
    ] : STAFF_STATS;
    const permissions = getUserPermissions(doctor);

    const today = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
    });

    const handleStatSelect = (label) => {
        if (label === "Active Patients") {
            setActivePatientsOpen(true);
        } else if (["Total Patients", "Discharged Patients", "Patients Requiring Assignment"].includes(label)) {
            navigate("/patients");
        } else if (label === "Fields Accessed") {
            navigate("/audit-log");
        } else if (label === "Access Denied") {
            navigate("/audit/queue");
        }
    };

    useEffect(() => {
        let mounted = true;

        getPatients(user || CURRENT_USER)
            .then((patients) => {
                if (mounted) {
                    setAllPatients(patients);
                    setActivePatients(patients.filter((patient) => patient.status === "Active"));
                }
            })
            .catch(() => {
                if (mounted) setPatientsError("Unable to load active patients.");
            })
            .finally(() => {
                if (mounted) setPatientsLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [user]);

    return (
        <div className="dash">
            <Sidebar
                navItems={NAV_ITEMS}
                activeKey={activeNav}
                onSelect={setActiveNav}
                user={doctor}
            />

            <div className="dash-main">
                <Topbar initials={doctor.initials} />

                <main className="dash-content">
                    <div className="dash-content__header">
                        <div>
                            <h1>Welcome, Dr.</h1>
                            <p>
                                {doctor.role} · {doctor.department}
                            </p>
                        </div>
                        <div className="date-pill">
                            <Icon name="clock" />
                            {today}
                        </div>
                    </div>

                    <StatsRow stats={stats} onSelect={handleStatSelect} />
                    <ProfileCard doctor={doctor} />

                    <div className="content-row">
                        <QuickActions />
                        <ActivePatients
                            patients={activePatients}
                            loading={patientsLoading}
                            error={patientsError}
                            onOpen={() => setActivePatientsOpen(true)}
                        />
                    </div>
                </main>
            </div>

            <aside className="dash-rail">
                {isAdmin && <RecentActivity activity={RECENT_ACTIVITY} />}
                <PermissionsPanel permissions={permissions} />
            </aside>

            <ActivePatientsModal
                open={activePatientsOpen}
                patients={activePatients}
                loading={patientsLoading}
                error={patientsError}
                onClose={() => setActivePatientsOpen(false)}
            />
        </div>
    );
}

function ActivePatientsModal({ open, patients, loading, error, onClose }) {
    const navigate = useNavigate();

    const viewPatient = (patient) => {
        onClose();
        navigate(patient.scope === "In scope" ? `/patients/${patient.id}` : `/patients/${patient.id}/denied`);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Active Patients"
            subtitle="Patients currently requiring attention."
            headerIcon="users"
            footer={
                <Button type="button" onClick={() => { onClose(); navigate("/patients"); }}>
                    View all patients
                </Button>
            }
        >
            <div className="dashboard-patient-modal-list" aria-live="polite">
                {loading && <p className="dashboard-patient-modal-state">Loading active patients...</p>}
                {!loading && error && <p className="dashboard-patient-modal-state dashboard-patient-modal-state--error">{error}</p>}
                {!loading && !error && patients.length === 0 && <p className="dashboard-patient-modal-state">No active patients</p>}
                {!loading && !error && patients.map((patient) => (
                    <article className="dashboard-patient-modal-item" key={patient.id}>
                        <div className="dashboard-patient-modal-item__identity">
                            <Avatar initials={patient.initials} size="sm" />
                            <div>
                                <strong>{patient.name}</strong>
                                <small>{patient.id} · {patient.ward}</small>
                            </div>
                        </div>
                        <div className="dashboard-patient-modal-item__action">
                            <Pill tone={patient.tone}>{patient.status}</Pill>
                            <Button type="button" size="sm" variant="secondary" onClick={() => viewPatient(patient)}>View details</Button>
                        </div>
                    </article>
                ))}
            </div>
        </Modal>
    );
}