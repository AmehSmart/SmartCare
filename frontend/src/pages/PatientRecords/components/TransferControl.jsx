import { useState } from "react";
import Icon from "../../../components/ui/Icon";
import Button from "../../../components/ui/Button";
import { transferPatient } from "../../../services/api/patientApi";

// Seeded wards. Admitting/transferring a patient here notifies that ward's
// on-duty staff (their Notifications light up with the new arrival).
const WARDS = [
    { id: "41000000-0000-4000-8000-000000000001", name: "Medical Ward A" },
    { id: "41000000-0000-4000-8000-000000000002", name: "Medical Ward B" },
    { id: "41000000-0000-4000-8000-000000000003", name: "Emergency Department" },
];

const ALLOWED_ROLES = ["Attending Doctor", "Doctor", "Nurse", "Records Clerk", "Administrator"];

export default function TransferControl({ patientId, role }) {
    const [wardId, setWardId] = useState(WARDS[0].id);
    const [status, setStatus] = useState("idle"); // idle | saving | done | error
    const [message, setMessage] = useState("");

    if (!ALLOWED_ROLES.includes(role)) return null;

    const submit = async () => {
        setStatus("saving");
        setMessage("");
        try {
            const result = await transferPatient({ patientId, wardId });
            setStatus("done");
            setMessage(`Admitted to ${result.ward || "the selected ward"}. On-duty staff there have been notified.`);
        } catch (err) {
            setStatus("error");
            setMessage(err.message || "Unable to transfer the patient.");
        }
    };

    return (
        <section className="pr-section pr-transfer">
            <h3>Admit / transfer to a ward</h3>
            <p className="pr-field-label">Moves the patient and alerts that ward's on-duty staff to review the new arrival.</p>
            <div className="pr-transfer-row">
                <select value={wardId} onChange={(e) => setWardId(e.target.value)}>
                    {WARDS.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
                </select>
                <Button variant="secondary" onClick={submit} disabled={status === "saving"}>
                    {status === "saving" ? "Transferring..." : "Transfer"}
                </Button>
            </div>
            {message && (
                <p className={status === "error" ? "field-error" : "pr-note-saved"} role={status === "error" ? "alert" : "status"}>
                    {status !== "error" && <Icon name="check" />} {message}
                </p>
            )}
        </section>
    );
}
