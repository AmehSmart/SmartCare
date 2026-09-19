import { useState } from "react";
import Icon from "../../../components/ui/Icon";

const CLINICAL_ITEMS = [
    {
        id: "medications",
        icon: "pill",
        label: "Medications",
        content: "Folic acid 5mg daily; Ferrous sulfate 200mg twice daily.",
        accessKey: "medications",
    },
    {
        id: "notes",
        icon: "file",
        label: "Clinical Notes",
        content: "Routine antenatal visit. No complaints. Fundal height on track.",
        accessKey: "clinicalNotes",
    },
];

export default function ClinicalTab({ patient }) {
    const [revealed, setRevealed] = useState({});
    const fieldAccess = patient?.fieldAccess || {};

    const toggle = (id) =>
        setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="pr-panel-body">
            {CLINICAL_ITEMS.map((item) => {
                const hasAccess = fieldAccess[item.accessKey] ?? false;

                if (!hasAccess) {
                    return (
                        <section className="pr-section" key={item.id}>
                            <h3>
                                <Icon name={item.icon} /> {item.label}
                            </h3>
                            <div className="pr-restricted-banner">
                                <Icon name="lock" />
                                This clinical field is restricted for your current role.
                            </div>
                        </section>
                    );
                }

                return (
                    <section className="pr-section" key={item.id}>
                        <h3>
                            <Icon name={item.icon} /> {item.label}
                        </h3>
                        {revealed[item.id] ? (
                            <p className="pr-revealed-text">{item.content}</p>
                        ) : (
                            <button
                                className="pr-reveal-link"
                                onClick={() => toggle(item.id)}
                            >
                                <Icon name="eye" /> Click to view <em>(Emergency)</em>
                            </button>
                        )}
                    </section>
                );
            })}
        </div>
    );
}