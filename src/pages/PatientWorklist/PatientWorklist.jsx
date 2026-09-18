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
    const [patients, setPatients] = useState([]);
    const [query, setQuery] = useState("");
    const [scopeOnly, setScopeOnly] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadPatients() {
            try {
                const data = await getPatients();
                if (mounted) {
                    setPatients(data);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadPatients();

        return () => {
            mounted = false;
        };
    }, []);

    const filtered = useMemo(() => patients.filter((patient) => {
        const matchesQuery = `${patient.name} ${patient.id} ${patient.ward}`.toLowerCase().includes(query.toLowerCase());
        return matchesQuery && (!scopeOnly || patient.scope === "In scope");
    }), [patients, query, scopeOnly]);

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
                            <p>Search is limited to your current role, ward, and shift scope.</p>
                        </div>
                        <Pill tone="blue"><Icon name="shield" /> Ward A · Day shift</Pill>
                    </div>

                    <section className="worklist-layout">
                        <aside className="worklist-filters" aria-label="Patient filters">
                            <label className="worklist-search">
                                <span>Search patients</span>
                                <div><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, or ward" /></div>
                            </label>
                            <label className="worklist-check"><input type="checkbox" checked={scopeOnly} onChange={(event) => setScopeOnly(event.target.checked)} /> Show only in-scope records</label>
                            <div className="worklist-filter-note"><Icon name="lock" /><span>Patient visibility is enforced by the policy service. Hidden fields never reach this screen.</span></div>
                        </aside>

                        <section className="worklist-results" aria-live="polite">
                            <div className="worklist-results__header"><h2>{loading ? "Loading..." : `${filtered.length} patients`}</h2><span>Updated just now</span></div>
                            {loading ? (
                                <div className="worklist-empty"><Icon name="search" /><h2>Loading patients</h2><p>Please wait while the patient list is refreshed.</p></div>
                            ) : filtered.length === 0 ? <div className="worklist-empty"><Icon name="search" /><h2>No matching patients</h2><p>Try a different name, patient ID, or ward.</p></div> : <div className="patient-result-list">{filtered.map((patient) => <PatientResult key={patient.id} patient={patient} />)}</div>}
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