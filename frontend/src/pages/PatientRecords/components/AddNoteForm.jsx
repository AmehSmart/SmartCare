import { useState } from "react";
import Icon from "../../../components/ui/Icon";
import Button from "../../../components/ui/Button";
import { addClinicalNote } from "../../../services/api/patientApi";

// Doctor/nurse clinical write. Saves a free-text note as a FHIR Observation via
// the backend, which enforces role + duty scope and audits the write.
export default function AddNoteForm({ patientId, fhirId }) {
    const [text, setText] = useState("");
    const [status, setStatus] = useState("idle"); // idle | saving | saved | error
    const [error, setError] = useState("");

    const save = async () => {
        if (!text.trim()) {
            setError("Enter a note before saving.");
            return;
        }
        setStatus("saving");
        setError("");
        try {
            await addClinicalNote({ patientId, fhirId, text });
            setText("");
            setStatus("saved");
        } catch (err) {
            setError(err.message || "Unable to save the note.");
            setStatus("error");
        }
    };

    return (
        <section className="pr-section pr-note-form">
            <h3>Add clinical note</h3>
            <textarea
                className="pr-reason-input"
                rows={3}
                placeholder="Write a clinical note for this patient..."
                value={text}
                onChange={(e) => { setText(e.target.value); if (status === "saved") setStatus("idle"); }}
            />
            {error && <p className="field-error" role="alert">{error}</p>}
            {status === "saved" && <p className="pr-note-saved" role="status"><Icon name="check" /> Note saved and recorded in the audit log.</p>}
            <Button onClick={save} disabled={status === "saving"}>
                {status === "saving" ? "Saving..." : "Save note"}
            </Button>
        </section>
    );
}
