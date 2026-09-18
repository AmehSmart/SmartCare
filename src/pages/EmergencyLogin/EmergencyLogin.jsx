import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./EmergencyLogin.css";
import "../PatientRecords/PatientRecords.css";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import Pill from "../../components/ui/Pill";
import { useAuth } from "../../context/useAuth";
import { getPatientById, getPatients, getPatientFieldAccess } from "../../services/api/patientApi";
import { emergencyLogin, endEmergencyAccess, requestEmergencyAccess, verifyEmergencyAccess } from "../../services/api/emergencyApi";
import PatientHeader from "../PatientRecords/components/PatientHeader";
import PatientTabs from "../PatientRecords/components/PatientTabs";
import OverviewTab from "../PatientRecords/components/OverviewTab";
import ClinicalTab from "../PatientRecords/components/ClinicalTab";
import AppointmentHistoryTab from "../PatientRecords/components/AppointmentHistoryTab";
import SensitiveTab from "../PatientRecords/components/SensitiveTab";
import RecentAccessLog from "../PatientRecords/components/RecentAccessLog";
import Avatar from "../../components/ui/Avatar";

const REASONS = [
    { value: "Patient unconscious", detail: "Need full history for dosing decisions" },
    { value: "Cardiac/respiratory emergency", detail: "Urgent medication review" },
    { value: "Surgical emergency", detail: "Blood group required" },
    { value: "Life-threatening event", detail: "No time for full review" },
    { value: "Other", detail: "Specify below" },
];

function EmergencyFrame({ step, children }) {
    const steps = [
        { key: "auth", label: "Authenticate", icon: "key" },
        { key: "patient", label: "Patient", icon: "person" },
        { key: "reason", label: "Reason", icon: "clipboard" },
    ];

    return (
        <main className="emergency-page">
            <div className="emergency-topline" />
            <div className="emergency-wrap">
                <Link className="emergency-back" to={step === "auth" ? "/login" : "/emergency-login"}>
                    <Icon name="chevron-left" /> Back to {step === "auth" ? "login" : "emergency access"}
                </Link>
                <section className="emergency-card">
                    <header className="emergency-card__header">
                        <div className="emergency-card__icon"><Icon name="alert" /></div>
                        <div>
                            <h1>Emergency Access</h1>
                            <p>Code-verified · 30-min session · Single patient · Fully audited</p>
                        </div>
                    </header>
                    <div className="emergency-warning" role="note">
                        <Icon name="alert" />
                        <span>This access is immediately logged and flagged for supervisor review. Misuse is a disciplinary offense.</span>
                    </div>
                    <nav className="emergency-steps" aria-label="Emergency access steps">
                        {steps.map((item, index) => {
                            const active = item.key === step;
                            const complete = steps.findIndex((entry) => entry.key === step) > index;
                            return (
                                <div key={item.key} className={`emergency-step${active ? " emergency-step--active" : ""}${complete ? " emergency-step--complete" : ""}`}>
                                    <span><Icon name={complete ? "check-bare" : item.icon} /></span>
                                    <small>{item.label}</small>
                                </div>
                            );
                        })}
                    </nav>
                    {children}
                </section>
            </div>
        </main>
    );
}

function ErrorMessage({ children }) {
    return children ? <p className="emergency-error" role="alert"><Icon name="alert" /> {children}</p> : null;
}

function AuthStep() {
    const navigate = useNavigate();
    const { startEmergencySession } = useAuth();
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (code.length !== 6) {
            setError("Enter your 6-digit emergency access code.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const user = await emergencyLogin({ code });
            startEmergencySession({ user, code, status: "authenticated", authenticatedAt: new Date().toISOString() });
            navigate("/emergency/search");
        } catch (requestError) {
            setError(requestError.message || "Unable to verify emergency access.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <EmergencyFrame step="auth">
            <form className="emergency-step-content" onSubmit={submit} noValidate>
                <div className="emergency-step-heading">
                    <div>
                        <h2>Authenticate yourself</h2>
                        <p>Enter your 6-digit emergency access code.</p>
                    </div>
                    <span>Step 1 of 3</span>
                </div>
                <label className="emergency-field">
                    <span>Emergency Access Code</span>
                    <input
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="0 0 0 0 0 0"
                        autoFocus
                    />
                </label>
                <p className="emergency-demo">Use the emergency code assigned to your staff profile.</p>
                <ErrorMessage>{error}</ErrorMessage>
                <Button type="submit" variant="glass" full disabled={loading || code.length !== 6}>
                    {loading ? "Verifying..." : "Verify code"} <Icon name="arrow-right" />
                </Button>
            </form>
        </EmergencyFrame>
    );
}

function PatientStep() {
    const navigate = useNavigate();
    const { updateEmergencySession, endEmergencySession } = useAuth();
    const [patients, setPatients] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        getPatients()
            .then((result) => { if (mounted) setPatients(result); })
            .catch(() => { if (mounted) setError("Unable to load patients. Try again."); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const filteredPatients = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return patients;
        return patients.filter((patient) => `${patient.name} ${patient.id} ${patient.ward}`.toLowerCase().includes(normalizedQuery));
    }, [patients, query]);

    const selectPatient = (patient) => {
        updateEmergencySession({ selectedPatientId: patient.id });
        navigate("/emergency/reason");
    };

    const leaveFlow = () => {
        endEmergencySession();
        navigate("/login", { replace: true });
    };

    return (
        <EmergencyFrame step="patient">
            <section className="emergency-step-content">
                <div className="emergency-step-heading">
                    <div>
                        <h2>Identify the patient</h2>
                        <p>Search by name, ID, or ward. You may access one patient per emergency session.</p>
                    </div>
                    <span>Step 2 of 3</span>
                </div>
                <div className="emergency-notice emergency-notice--success"><Icon name="check" /> Patient search is logged.</div>
                <label className="emergency-field">
                    <span>Patient search</span>
                    <div className="emergency-search-input"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, patient ID, or ward" autoFocus /></div>
                </label>
                <div className="emergency-results" aria-live="polite">
                    {loading ? <p className="emergency-empty">Loading patients...</p> : error ? <ErrorMessage>{error}</ErrorMessage> : filteredPatients.length === 0 ? <p className="emergency-empty">No matching patient found.</p> : filteredPatients.map((patient) => (
                        <button key={patient.id} type="button" className="emergency-patient" onClick={() => selectPatient(patient)}>
                            <Avatar initials={patient.initials} size="sm" />
                            <span><strong>{patient.name}</strong><small>{patient.id} · {patient.age} years · {patient.ward}</small></span>
                            <Icon name="chevron" />
                        </button>
                    ))}
                </div>
                <p className="emergency-audit-note"><Icon name="audit" /> Every search and patient selection is recorded.</p>
                <button type="button" className="emergency-secondary-action" onClick={leaveFlow}>End emergency access</button>
            </section>
        </EmergencyFrame>
    );
}

function ReasonStep() {
    const navigate = useNavigate();
    const { emergencySession, updateEmergencySession, endEmergencySession } = useAuth();
    const [reason, setReason] = useState(REASONS[0].value);
    const [otherReason, setOtherReason] = useState("");
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const selectedPatientId = emergencySession?.selectedPatientId;
        if (!selectedPatientId) {
            navigate("/emergency/search", { replace: true });
            return;
        }
        getPatientById(selectedPatientId)
            .then(setPatient)
            .catch(() => setError("Unable to load the selected patient."))
            .finally(() => setLoading(false));
    }, [emergencySession?.selectedPatientId, navigate]);

    const submit = async (event) => {
        event.preventDefault();
        if (!patient) return;
        setSubmitting(true);
        setError("");
        try {
            const accessReason = reason === "Other" ? `Other: ${otherReason.trim()}` : reason;
            const request = await requestEmergencyAccess({
                patientId: patient.id,
                actorId: emergencySession.user.id,
                reason: accessReason,
                ward: emergencySession.user.ward,
                shift: emergencySession.user.shift,
            });
            const verified = await verifyEmergencyAccess({ grantId: request.grantId, code: emergencySession.code });
            updateEmergencySession({
                status: verified.status,
                grantId: verified.grantId,
                patientId: patient.id,
                selectedPatientId: patient.id,
                reason: accessReason,
                expiresAt: verified.expiresAt,
                user: emergencySession.user,
            });
            navigate(`/emergency/patients/${patient.id}`);
        } catch (requestError) {
            setError(requestError.message || "Unable to activate emergency access.");
        } finally {
            setSubmitting(false);
        }
    };

    const goBack = () => navigate("/emergency/search");
    const cancel = () => { endEmergencySession(); navigate("/login", { replace: true }); };

    return (
        <EmergencyFrame step="reason">
            <form className="emergency-step-content" onSubmit={submit}>
                <div className="emergency-step-heading">
                    <div>
                        <h2>State the emergency reason</h2>
                        <p>Choose the reason for accessing this patient's record.</p>
                    </div>
                    <span>Step 3 of 3</span>
                </div>
                {loading ? <p className="emergency-empty">Loading selected patient...</p> : patient && <div className="emergency-selected-patient"><Avatar initials={patient.initials} size="sm" /><span><strong>{patient.name}</strong><small>{patient.id} · {patient.ward}</small></span><Pill tone="warning">Single patient</Pill></div>}
                <fieldset className="emergency-reasons">
                    <legend>Why do you need emergency access?</legend>
                    <div className="emergency-reason-list">
                        {REASONS.map((item) => (
                            <label key={item.value} className={`emergency-reason-option${reason === item.value ? " emergency-reason-option--selected" : ""}`}>
                                <input type="radio" name="emergency-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />
                                <span className="emergency-reason-option__radio" />
                                <span><strong>{item.value}</strong><small>{item.detail}</small></span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                {reason === "Other" && <label className="emergency-field emergency-other-field"><span>Describe the emergency</span><textarea value={otherReason} onChange={(event) => setOtherReason(event.target.value)} placeholder="Briefly describe why access is needed" rows="3" /></label>}
                <div className="emergency-notice"><Icon name="alert" /> This access is limited to the selected patient and will expire after 30 minutes.</div>
                <ErrorMessage>{error}</ErrorMessage>
                <div className="emergency-action-row"><Button type="button" variant="secondary" onClick={goBack} disabled={submitting}>Back</Button><Button type="button" variant="secondary" onClick={cancel} disabled={submitting}>Cancel</Button><Button type="submit" variant="glass" disabled={submitting || !patient || (reason === "Other" && !otherReason.trim())}>{submitting ? "Activating..." : "Continue"} <Icon name="arrow-right" /></Button></div>
            </form>
        </EmergencyFrame>
    );
}

export default function EmergencyLogin({ step = "auth" }) {
    if (step === "patient") return <PatientStep />;
    if (step === "reason") return <ReasonStep />;
    return <AuthStep />;
}

export function EmergencyPatientAccess() {
    const navigate = useNavigate();
    const { patientId } = useParams();
    const { emergencySession, endEmergencySession } = useAuth();
    const [patient, setPatient] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [seconds, setSeconds] = useState(1800);
    const fieldAccess = patient ? getPatientFieldAccess(patient, emergencySession.user.role) : {};

    useEffect(() => {
        getPatientById(patientId)
            .then(setPatient)
            .catch(() => setError("This patient record is unavailable."))
            .finally(() => setLoading(false));
        const timer = setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
        return () => clearInterval(timer);
    }, [patientId]);

    const endSession = async () => {
        await endEmergencyAccess({ grantId: emergencySession.grantId, actorId: emergencySession.user.id });
        endEmergencySession();
        navigate("/login", { replace: true });
    };

    const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

    const patientView = patient ? {
        initials: patient.initials,
        name: patient.name,
        gender: patient.gender,
        age: patient.age,
        tag: patient.ward,
        admitted: "8 Jun 2026",
        code: patient.id,
        dob: patient.demographics?.dob || "Not available",
        address: patient.demographics?.address || "Not available",
        phone: patient.demographics?.phone || "Not available",
        vitals: [
            { label: "Blood Pressure", value: "110/72", unit: "mmHg", tone: "blue" },
            { label: "Heart Rate", value: "84", unit: "bpm", tone: "red" },
            { label: "Temperature", value: "37.0", unit: "°C", tone: "amber" },
            { label: "Oxygen Saturation", value: "99", unit: "%", tone: "teal" },
        ],
        allergies: ["Latex (mild)"],
        fieldAccess,
    } : null;

    const renderTab = () => {
        if (!patientView) return null;
        switch (activeTab) {
            case "clinical": return <ClinicalTab patient={patientView} />;
            case "appointments": return <AppointmentHistoryTab />;
            case "sensitive": return <SensitiveTab patient={patientView} />;
            default: return <OverviewTab patient={patientView} />;
        }
    };

    const accessLog = [
        { time: "08:29", user: emergencySession.user.name, action: "EMERGENCY LOGIN", flagged: true },
        { time: "08:29", user: emergencySession.user.name, action: "PATIENT SELECTED", detail: patient?.name },
        { time: "08:27", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "demographics" },
    ];

    return (
        <main className="emergency-page emergency-page--record">
            <div className="emergency-topline" />
            <div className="emergency-record-wrap">
                <header className="emergency-record-header"><div><p>Emergency access · {emergencySession.user.name}</p><h1>Patient record</h1></div><Button variant="danger" size="sm" onClick={endSession}>End emergency session</Button></header>
                <div className="emergency-session-banner" role="alert"><Icon name="alert" /> Emergency session active · {time} remaining · {emergencySession.reason}</div>
                {loading ? <div className="emergency-record-card"><p>Loading patient record...</p></div> : error ? <div className="emergency-record-card"><ErrorMessage>{error}</ErrorMessage></div> : patientView && <>
                    <section className="emergency-record-card emergency-record-patient-card">
                        <PatientHeader patient={patientView} />
                        <PatientTabs activeTab={activeTab} onChange={setActiveTab} />
                        {renderTab()}
                    </section>
                    <section className="emergency-record-card emergency-record-access-card">
                        <RecentAccessLog entries={accessLog} />
                    </section>
                    <p className="emergency-audit-note"><Icon name="audit" /> Patient record access and every visible field are recorded in the audit trail.</p>
                </>}
            </div>
        </main>
    );
}

