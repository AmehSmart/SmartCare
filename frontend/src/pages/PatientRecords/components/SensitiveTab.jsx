import { useState } from "react";
import Icon from "../../../components/ui/Icon";
import Pill from "../../../components/ui/Pill";
import Button from "../../../components/ui/Button";
import { requestSensitiveFieldReveal } from "../../../services/api/patientApi";

// Sensitive information is never shown up front. Revealing it calls the backend
// (doctor/nurse only), which authorises and permanently logs the access, then
// returns only the permitted sensitive records. Nothing is decided or stored
// client-side.
export default function SensitiveTab({ patientId, user }) {
    const [reason, setReason] = useState("");
    const [status, setStatus] = useState("idle"); // idle | revealing | revealed | denied | error
    const [records, setRecords] = useState([]);
    const [error, setError] = useState("");
    const [revealedAt, setRevealedAt] = useState("");

    const reveal = async () => {
        if (!reason.trim()) {
            setError("Enter a clinical reason. This reveal is permanently recorded.");
            return;
        }
        setStatus("revealing");
        setError("");
        try {
            const result = await requestSensitiveFieldReveal({
                patientId,
                field: "sensitiveFlags",
                reason: reason.trim(),
                actorId: user?.id,
            });
            setRecords(result.resources || []);
            setRevealedAt(result.revealedAt || new Date().toISOString());
            setStatus("revealed");
        } catch (err) {
            if (err.status === 403) {
                setStatus("denied");
            } else {
                setError(err.message || "Unable to reveal sensitive information.");
                setStatus("error");
            }
        }
    };

    return (
        <div className="pr-panel-body">
            <div className="pr-restricted-banner">
                <Icon name="alert" />
                Restricted - access to these fields is authorised and permanently logged by the server.
            </div>

            {status === "denied" && (
                <div className="pr-restricted-banner">
                    <Icon name="lock" />
                    Your role is not permitted to reveal sensitive information.
                </div>
            )}

            {status !== "revealed" && status !== "denied" && (
                <section className="pr-section">
                    <h3>Reveal sensitive information</h3>
                    <p className="pr-field-label">Sensitive fields (HIV status, mental-health notes, genotype) stay hidden until you record a reason.</p>
                    <textarea
                        className="pr-reason-input"
                        rows={2}
                        placeholder="Clinical reason for revealing (recorded in the audit log)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                    {error && <p className="field-error" role="alert">{error}</p>}
                    <Button variant="secondary" onClick={reveal} disabled={status === "revealing"}>
                        <Icon name="eye" /> {status === "revealing" ? "Revealing..." : "Reveal (logged)"}
                    </Button>
                </section>
            )}

            {status === "revealed" && (
                <>
                    <div className="pr-restricted-banner" style={{ background: "var(--color-success-light)", color: "var(--color-success)" }}>
                        <Icon name="check" />
                        Reveal recorded at {new Date(revealedAt).toLocaleString("en-GB")}.
                    </div>
                    {records.length === 0 && <p className="pr-field-label">No sensitive records on file for this patient.</p>}
                    {records.map((item, i) => (
                        <section className="pr-section" key={i}>
                            <div className="pr-sensitive-detail">
                                <span className="pr-field-label">{item.label?.toUpperCase()}</span>
                                <span className="pr-field-value">{item.value}</span>
                            </div>
                            <Pill tone="green">{item.source === "HOSPITAL_VERIFIED" ? "Hospital-verified" : item.source}</Pill>
                        </section>
                    ))}
                </>
            )}
        </div>
    );
}
