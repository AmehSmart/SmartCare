import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import "./AdditionalPages.css";
import Sidebar from "../components/layout/Sidebar";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import Pill from "../components/ui/Pill";
import Modal from "../components/ui/Modal";
import { CURRENT_USER, NAV_ITEMS } from "../components/layout/navConfig";
import { getRoles, getStaffMembers, updateStaffAssignment } from "../services/api/roleService";
import { useAuth } from "../context/useAuth";
import QRCode from "qrcode";
import { buildTotpUri, createTotpEnrollment, disableTotpEnrollment, getTotpEnrollment, verifyTotpEnrollment } from "../services/api/totpApi";
import { getAuditQueue, verifyAuditChain } from "../services/api/auditApi";
import { verifyEmergencyAccess, endEmergencyAccess } from "../services/api/emergencyApi";
import { getRoster } from "../services/api/adminApi";
import { isBackendEnabled } from "../services/api/config";

const PATIENT = { name: "Fatima Abdullahi", id: "PT-000184", ward: "Ward B", genotype: "HbSS" };

const REASON_CODES = {
  "Unconscious patient": "UNCONSCIOUS_PATIENT",
  "Severe vaso-occlusive crisis": "SEVERE_CRISIS",
  "Immediate life-saving care": "LIFE_SAVING_CARE",
};

const severityTone = (level) => (String(level).toLowerCase() === "high" ? "red" : String(level).toLowerCase() === "low" ? "gray" : "warning");

function Shell({ title, children, subtitle, patient = false }) {
  return <div className="extra-shell"><Sidebar navItems={NAV_ITEMS} user={CURRENT_USER} /><main className="extra-main"><header className="extra-header"><div><p className="extra-eyebrow">{patient ? "Patient passport" : "SmartCare access control"}</p><h1>{title}</h1>{subtitle && <p className="extra-subtitle">{subtitle}</p>}</div></header>{children}</main></div>;
}

export function BreakGlass() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const targetId = patientId || PATIENT.id;
  const [reason, setReason] = useState("Unconscious patient");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleGrant = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await verifyEmergencyAccess({
        grantId: targetId,
        code,
        reasonCode: REASON_CODES[reason] || "UNCONSCIOUS_PATIENT",
        reasonText: reason,
      });
      navigate(`/patients/${targetId}/emergency-summary`, {
        state: {
          summary: result.summary,
          expiresAt: result.expiresAt,
          sessionId: result.emergencySessionId || result.grantId,
          reason,
        },
      });
    } catch (err) {
      setError(err.message || "Emergency access could not be granted.");
    } finally {
      setSubmitting(false);
    }
  };

  return <Shell title="Emergency access" subtitle="A temporary, fully audited override for an out-of-scope record."><section className="extra-card extra-card--narrow" role="dialog" aria-modal="true" aria-labelledby="breakglass-title"><div className="extra-emergency-icon"><Icon name="alert" /></div><h2 id="breakglass-title">Request break-glass access</h2><p>Access to this record is outside your assigned scope. State the emergency reason and verify your authenticator code.</p><label>Emergency reason<select value={reason} onChange={(e) => setReason(e.target.value)}>{Object.keys(REASON_CODES).map((r) => <option key={r}>{r}</option>)}</select></label><label>6-digit TOTP code<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" /></label>{error && <p className="extra-form-error" role="alert">{error}</p>}<Button variant="breakglass" disabled={code.length !== 6 || submitting} onClick={handleGrant}>{submitting ? "Verifying..." : "Grant emergency access"}</Button><Link to={`/patients/${targetId}/denied`}>Cancel</Link></section></Shell>;
}

export function EmergencySummary() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const state = location.state || {};
  const summary = state.summary || null;

  const [seconds, setSeconds] = useState(() => (state.expiresAt
    ? Math.max(0, Math.round((new Date(state.expiresAt).getTime() - Date.now()) / 1000))
    : 899));
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (ended) return undefined;
    const id = setInterval(() => setSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [ended]);

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const actorName = user?.name || "the clinician";

  const handleEnd = async () => {
    try {
      await endEmergencyAccess({ grantId: state.sessionId, actorId: user?.id });
    } finally {
      setEnded(true);
      navigate(patientId ? `/patients/${patientId}` : "/dashboard");
    }
  };

  const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(" · ") : "None recorded");
  const home = summary?.homeFacility?.value || summary?.homeFacility || (summary ? "Not recorded" : "Lagos University Teaching Hospital");

  return <Shell title="Emergency summary" subtitle="Minimum necessary clinical information">
    <div className="extra-countdown" role="alert" aria-live="polite">
      <Icon name="alert" /> Emergency access active for {actorName} · {time} remaining
      <button type="button" onClick={handleEnd}>End access now</button>
    </div>
    <section className="extra-grid">
      {summary ? <>
        <Info title="Allergies and reactions" value={list(summary.allergiesReactions)} danger={Boolean(summary.allergiesReactions?.length)} />
        <Info title="Current medications" value={list(summary.currentMedications)} />
        <Info title="Transfusion history" value={list(summary.transfusionHistory)} />
        <Info title="Key complications" value={list(summary.keyComplications)} />
        <Info title="Home facility" value={home} />
        <Info title="Patient" value={summary.patient?.displayName || "-"} />
      </> : <>
        <Info title="Confirmed genotype" value="HbSS (sickle cell disease)" />
        <Info title="Allergies" value="Penicillin - anaphylaxis" danger />
        <Info title="Current medications" value="Hydroxyurea 500mg · analgesia plan" />
        <Info title="Key complications" value="Prior acute chest syndrome" />
        <Info title="Transfusion history" value="Last transfusion: 14 Jun 2026" />
        <Info title="Home facility" value="Lagos University Teaching Hospital" />
      </>}
    </section>
  </Shell>;
}
function Info({ title, value, danger }) { return <article className={`extra-info${danger ? " extra-info--danger" : ""}`}><h2>{title}</h2><p>{value}</p><Pill tone={danger ? "red" : "green"}>{danger ? "Critical" : "Hospital-verified"}</Pill></article>; }

export function Passport() { return <Shell title="My emergency passport" subtitle="Your critical health information, ready when care cannot wait." patient><section className="extra-card extra-card--passport"><Pill tone="green">✓ Works offline · verified by signature</Pill><h2>{PATIENT.name}</h2><p>{PATIENT.id} · Emergency summary is ready to share.</p><Link className="extra-primary-link" to="/passport/qr">Show emergency QR card</Link><div className="extra-stat"><strong>2</strong><span>active emergency shares</span></div><h3>Recent access</h3><p className="extra-muted">Dr. Adaeze Okonkwo viewed your emergency summary today at 08:44.</p></section></Shell> }

export function PassportQR() { return <Shell title="Emergency QR card" subtitle="This signed code expires automatically." patient><section className="extra-card extra-card--narrow extra-center"><div className="extra-qr" aria-label="Emergency QR code"><Icon name="qr-code" /></div><h2>{PATIENT.name}</h2><label>Expires in<select defaultValue="1 hour"><option>1 hour</option><option>12 hours</option><option>24 hours</option></select></label><label className="extra-check"><input type="checkbox" /> Require a PIN before opening</label><Button variant="danger">Revoke grant</Button></section></Shell> }

export function Scan() { const [state, setState] = useState("idle"); return <div className="extra-scan"><Link to="/dashboard">← Back to portal</Link><div className="extra-camera"><Icon name="camera" /><div className="extra-scan-frame" /></div><h1>Scan emergency QR</h1><p>Position the QR code inside the frame, or enter a token manually.</p>{state === "verified" && <div className="extra-verified" role="status">✓ Signature verified - safe to open summary</div>}<input placeholder="Paste token" aria-label="Manual emergency token" /><Button onClick={() => setState("verified")}>Verify token</Button></div> }

export function PassportConsent() { return <Shell title="Sharing & consent" subtitle="Review and control access to your emergency summary." patient><section className="extra-card"><h2>Active grants</h2><div className="extra-list"><div><strong>Emergency QR grant</strong><span>Expires in 56 minutes</span><button>Revoke</button></div><div><strong>Caregiver access</strong><span>Added 12 Sep 2026</span><button>Revoke</button></div></div><h2>Access history</h2><p className="extra-muted">Dr. Adaeze Okonkwo · Passport scan · 08 Sep 2026, 08:44</p></section></Shell> }

export function AuditQueue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getAuditQueue()
      .then((data) => { if (mounted) setRows(data); })
      .catch((err) => { if (mounted) setError(err.message || "Unable to load the anomaly queue."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return <Shell title="Audit officer queue" subtitle="Flagged events ranked by severity.">
    <section className="extra-card">
      <div className="extra-actions"><h2>Open anomalies</h2><Link className="extra-outline-link" to="/audit/verify">Run integrity check</Link></div>
      <div className="extra-table-wrap">
        <table className="extra-table">
          <thead><tr><th>Flag</th><th>Actor</th><th>Target</th><th>Time</th><th>Severity</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5}>Loading anomalies...</td></tr>}
            {!loading && error && <tr><td colSpan={5} className="extra-form-error">{error}</td></tr>}
            {!loading && !error && rows.length === 0 && <tr><td colSpan={5}>No open anomalies.</td></tr>}
            {!loading && !error && rows.map((row, i) => <tr key={row.id || i}>
              <td>{row.flag}</td><td>{row.actor}</td><td>{row.target}</td><td>{row.time}</td>
              <td><Pill tone={severityTone(row.severity)}>{row.severity}</Pill></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </Shell>;
}

export function AuditVerify() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = () => {
    setLoading(true);
    setError("");
    verifyAuditChain()
      .then(setResult)
      .catch((err) => setError(err.message || "Unable to verify the audit chain."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { run(); }, []);

  const ok = result?.integrityValid;
  return <Shell title="Audit integrity verification" subtitle="Cryptographic verification of the append-only audit chain.">
    <section className={`extra-integrity${ok === false ? " extra-info--danger" : ""}`} role="status">
      <Icon name={ok === false ? "alert" : "check"} />
      <div>
        {loading && <h2>Verifying chain...</h2>}
        {!loading && error && <h2>{error}</h2>}
        {!loading && !error && result && <>
          <h2>{ok ? `Chain intact - ${result.verifiedEvents} entries verified` : "Chain integrity check failed"}</h2>
          <p>{ok ? "Every event hashes to its predecessor." : "One or more entries did not match the expected hash."} Last verified {new Date(result.lastVerifiedAt).toLocaleString("en-GB")}.</p>
        </>}
      </div>
    </section>
    <section className="extra-card">
      <div className="extra-actions"><h2>Verification details</h2><Button variant="secondary" onClick={run} disabled={loading}>{loading ? "Running..." : "Re-run check"}</Button></div>
      <p className="extra-muted mono">SHA-256 · checkpoint: {result?.checkpoint || "-"}</p>
    </section>
  </Shell>;
}

export function AdminRoster() {
  const backendMode = isBackendEnabled();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [roles] = useState(() => getRoles());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState("");
  const [form, setForm] = useState({ staffId: "", role: "", ward: "", shift: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getRoster()
      .then((data) => { if (mounted) setStaff(data); })
      .catch((err) => { if (mounted) setLoadError(err.message || "Unable to load the roster."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const openAssignment = (member = null) => {
    setError("");
    setEditingStaffId(member?.staffId ?? "");
    setForm({
      staffId: member?.staffId ?? "",
      role: member?.role ?? roles[0]?.name ?? "",
      ward: member?.ward ?? "",
      shift: member?.shift ?? "Day Shift",
    });
    setModalOpen(true);
  };

  const closeAssignment = () => {
    setModalOpen(false);
    setEditingStaffId("");
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.staffId || !form.role || !form.ward || !form.shift) {
      setError("Select a staff member, role, ward, and shift.");
      return;
    }

    try {
      updateStaffAssignment(form.staffId, form);
      setStaff(getStaffMembers());
      closeAssignment();
    } catch (assignmentError) {
      setError(assignmentError.message || "Unable to save assignment.");
    }
  };

  return <Shell title="Roster management" subtitle="Assign staff roles, wards, and approved duty periods without viewing clinical records.">
    <section className="extra-card">
      <div className="extra-actions">
        <h2>Staff assignments</h2>
        {!backendMode && <Button onClick={() => openAssignment()}><Icon name="plus" /> Add assignment</Button>}
      </div>
      {backendMode && <p className="extra-muted">Live roster from the server. Assignment editing is managed in the backend and is read-only here.</p>}
      <div className="extra-table-wrap">
        <table className="extra-table">
          <thead><tr><th>Staff member</th><th>Role</th><th>Ward</th><th>Shift</th>{!backendMode && <th>Actions</th>}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={backendMode ? 4 : 5}>Loading roster...</td></tr>}
            {!loading && loadError && <tr><td colSpan={backendMode ? 4 : 5} className="extra-form-error">{loadError}</td></tr>}
            {!loading && !loadError && staff.length === 0 && <tr><td colSpan={backendMode ? 4 : 5}>No staff on the roster.</td></tr>}
            {!loading && !loadError && staff.map((member) => <tr key={member.staffId}>
              <td>{member.name}</td>
              <td>{member.role}</td>
              <td>{member.ward}</td>
              <td>{member.shift}</td>
              {!backendMode && <td><button type="button" onClick={() => openAssignment(member)}>Edit</button></td>}
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <Modal
      open={modalOpen}
      onClose={closeAssignment}
      title={editingStaffId ? "Edit staff assignment" : "Add staff assignment"}
      subtitle="Update the staff member's role, ward, and approved shift."
      headerIcon="users"
    >
      <form className="extra-assignment-form" onSubmit={handleSubmit}>
        <label>Staff member
          <select value={form.staffId} onChange={(event) => setForm((current) => ({ ...current, staffId: event.target.value }))} disabled={Boolean(editingStaffId)}>
            <option value="">Select staff member</option>
            {staff.map((member) => <option key={member.staffId} value={member.staffId}>{member.name} ({member.staffId})</option>)}
          </select>
        </label>
        <label>Role
          <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
            <option value="">Select role</option>
            {roles.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
          </select>
        </label>
        <label>Ward or department
          <input value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))} placeholder="e.g. Ward B" />
        </label>
        <label>Approved shift
          <select value={form.shift} onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))}>
            <option>Day Shift</option>
            <option>Night Shift</option>
            <option>Rotating Shift</option>
          </select>
        </label>
        {error && <p className="extra-form-error" role="alert">{error}</p>}
        <div className="extra-form-actions">
          <Button type="button" variant="secondary" onClick={closeAssignment}>Cancel</Button>
          <Button type="submit">{editingStaffId ? "Save changes" : "Add assignment"}</Button>
        </div>
      </form>
    </Modal>
  </Shell>;
}

export function AdminTOTP() {
  const { user, updateUser } = useAuth();
  const [enrollment, setEnrollment] = useState(() => user ? (getTotpEnrollment(user.id) || createTotpEnrollment({ staffId: user.id, accountName: user.name })) : null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || !enrollment) return;

    QRCode.toDataURL(buildTotpUri({ secret: enrollment.secret, accountName: user.name }), {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(() => setError("Unable to generate the authenticator QR code."));
  }, [user, enrollment]);

  const completeEnrollment = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const verified = await verifyTotpEnrollment({ staffId: user.id, secret: enrollment.secret, code: value });
      setEnrollment(verified);
      updateUser({ totpEnabled: true });
      setMessage("Two-factor authentication is enabled for this account.");
      setValue("");
    } catch (verificationError) {
      setError(verificationError.message || "Unable to verify the authenticator code.");
    } finally {
      setLoading(false);
    }
  };

  const disableEnrollment = () => {
    const disabled = disableTotpEnrollment(user.id);
    setEnrollment(disabled);
    updateUser({ totpEnabled: false });
    setMessage("Two-factor authentication has been disabled.");
    setError("");
  };

  return <Shell title="TOTP enrolment" subtitle="Set up a second factor for emergency access.">
    <section className="extra-card extra-card--narrow extra-center extra-totp-card">
      <div className="extra-qr extra-qr--real">{qrDataUrl ? <img src={qrDataUrl} alt="Scan this QR code with your authenticator app" /> : <span>Generating QR...</span>}</div>
      <h2>{enrollment?.enabled ? "Authenticator enabled" : "Scan with your authenticator"}</h2>
      <p className="extra-muted">Scan the QR code with Google Authenticator, Microsoft Authenticator, or another TOTP app.</p>
      <p className="extra-totp-secret mono">Manual setup key: {enrollment?.secret}</p>
      {!enrollment?.enabled && <>
        <label>Verification code<input value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></label>
        {error && <p className="extra-form-error" role="alert">{error}</p>}
        <Button onClick={completeEnrollment} disabled={loading || value.length !== 6}>{loading ? "Verifying..." : "Complete enrolment"}</Button>
      </>}
      {enrollment?.enabled && <Button variant="danger" onClick={disableEnrollment}>Disable TOTP</Button>}
      {message && <p className="extra-totp-success" role="status">{message}</p>}
    </section>
  </Shell>;
}
