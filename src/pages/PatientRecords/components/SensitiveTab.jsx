import { useState } from "react";
import Icon from "../../../components/ui/Icon";
import Pill from "../../../components/ui/Pill";

const SENSITIVE_ITEMS = [
    { id: "hiv", label: "HIV Status", accessKey: "hivStatus" },
    { id: "mental", label: "Mental Health Notes", accessKey: "mentalHealth" },
    { id: "reproductive", label: "Reproductive History", accessKey: "reproductiveHistory" },
    { id: "genotype", label: "Genotype / Blood Group", accessKey: "genotype" },
];

export default function SensitiveTab({ patient }) {
    const [revealed, setRevealed] = useState({});
    const fieldAccess = patient?.fieldAccess || {};

    const toggle = (id) =>
        setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));

    const renderRevealed = (id) => {
        switch (id) {
            case "hiv":
                return (
                    <div className="pr-sensitive-detail">
                        <span className="pr-field-label">STATUS</span>
                        <Pill tone="green">HIV Negative</Pill>
                    </div>
                );
            case "mental":
                return (
                    <p className="pr-revealed-text">
                        Mild anxiety noted at booking. Counseled. No pharmacotherapy.
                    </p>
                );
            case "reproductive":
                return (
                    <div className="pr-grid">
                        <div>
                            <span className="pr-field-label">GRAVIDA / PARA</span>
                            <span className="pr-field-value">G1P0</span>
                        </div>
                        <div>
                            <span className="pr-field-label">GESTATION</span>
                            <span className="pr-field-value">32 weeks gestation</span>
                        </div>
                    </div>
                );
            case "genotype":
                return (
                    <div className="pr-grid">
                        <div>
                            <span className="pr-field-label">BLOOD GROUP</span>
                            <span className="pr-field-value">B+</span>
                        </div>
                        <div>
                            <span className="pr-field-label">GENOTYPE</span>
                            <span className="pr-field-value">AA</span>
                        </div>
                        <div>
                            <span className="pr-field-label">RHESUS</span>
                            <span className="pr-field-value">Positive</span>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="pr-panel-body">
            <div className="pr-restricted-banner">
                <Icon name="alert" />
                Restricted — Access to these fields is role-controlled and permanently logged
            </div>

            {SENSITIVE_ITEMS.map((item) => {
                const hasAccess = fieldAccess[item.accessKey] ?? false;

                return (
                    <section className="pr-section" key={item.id}>
                        <h3>{item.label}</h3>
                        {!hasAccess ? (
                            <div className="pr-restricted-banner">
                                <Icon name="lock" />
                                This sensitive field is not available to your current role.
                            </div>
                        ) : revealed[item.id] ? (
                            renderRevealed(item.id)
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