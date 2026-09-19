import { useMemo } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import { useAuth } from "../../context/useAuth";
import { getAssignedPatientsForStaff } from "../../services/api/roleService";
import { NAV_ITEMS } from "../../components/layout/navConfig";

export default function MyPatients() {
    const { user } = useAuth();

    const list = useMemo(() => {
        if (!user) return [];
        return getAssignedPatientsForStaff(user.id || user.staffId).filter(Boolean);
    }, [user]);

    const loading = !user;

    return (
        <div className="worklist-page">
            <Sidebar navItems={NAV_ITEMS} user={user} />
            <div className="worklist-main">
                <Topbar initials={user?.initials} />
                <main className="worklist-content">
                    <div className="worklist-heading">
                        <div>
                            <p className="worklist-eyebrow">Assigned care</p>
                            <h1>My Patients</h1>
                            <p>Patients assigned to {user?.name || "your staff profile"} in the active role and ward context.</p>
                        </div>
                        <Pill tone="blue"><Icon name="shield" /> {user?.ward || "Current ward"}</Pill>
                    </div>

                    <section className="worklist-results" aria-live="polite">
                        <div className="worklist-results__header">
                            <h2>{loading ? "Loading..." : `${list.length} assigned patients`}</h2>
                            <span>{user?.shift || "Current shift"}</span>
                        </div>

                        {loading ? (
                            <div className="worklist-empty"><Icon name="search" /><h2>Loading your patients</h2><p>Please wait while your assignments are refreshed.</p></div>
                        ) : list.length === 0 ? (
                            <div className="worklist-empty"><Icon name="search" /><h2>No assigned patients</h2><p>You are not currently assigned to any active patient records.</p></div>
                        ) : (
                            <div className="patient-result-list">
                                {list.map((patient) => (
                                    <div className="patient-result" key={patient.id}>
                                        <div className="patient-result__identity">
                                            <div className="patient-result__avatar">{patient.initials}</div>
                                            <div>
                                                <strong>{patient.name}</strong>
                                                <span>{patient.id} · MRN: {patient.patientNumber || patient.id}</span>
                                                <small>{patient.note}</small>
                                            </div>
                                        </div>
                                        <span className="patient-result__meta">
                                            <strong>{patient.ward}</strong>
                                            <Pill tone={patient.tone || "green"}>{patient.assignmentType || "Assigned"}</Pill>
                                        </span>
                                        <Link className="patient-result__action" to={`/patients/${patient.id}`}>
                                            View Patient
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
