import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import Avatar from "../../components/ui/Avatar";
import { CURRENT_USER, NAV_ITEMS } from "../../components/layout/navConfig";
import { useAuth } from "../../context/useAuth";
import { getPatients } from "../../services/api/patientApi";
import "./PatientWorklist.css";

export default function PatientWorklist() {
    const { user } = useAuth();
    const isRecordsClerk = String(user?.role || "").toLowerCase().includes("records");
    const [patients, setPatients] = useState([]);
    const [query, setQuery] = useState("");
    const [scopeOnly, setScopeOnly] = useState(false);
    const [statusFilter, setStatusFilter] = useState("All");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        // Server-side search (debounced): the backend scopes results per role, so a
        // records clerk searches the whole facility while a nurse stays on her ward.
        const handle = setTimeout(async () => {
            try {
                const data = await getPatients(user, query);
                if (mounted) setPatients(data);
            } catch {
                if (mounted) setPatients([]);
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
                        <Pill tone="blue"><Icon name="shield" /> {user?.ward || "All Units"} · {user?.shift || "All Shifts"}</Pill>
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
                            ) : filtered.length === 0 ? <div className="worklist-empty"><Icon name="search" /><h2>No matching patients</h2><p>Try a different name, patient ID, ward, or status filter.</p></div> : <div className="patient-result-list">{filtered.map((patient) => <PatientResult key={patient.id} patient={patient} />)}</div>}
                        </section>
                    </section>
                </main>
            </div>
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