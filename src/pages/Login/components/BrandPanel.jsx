import Icon from "../../../components/ui/Icon";

const FEATURES = [
    { icon: "lock", title: "Role-based field masking", desc: "Every field is visible only to authorised roles" },
    { icon: "audit", title: "Tamper-evident audit trail", desc: "Every access is hashed and permanently logged" },
    { icon: "shield", title: "Emergency access codes", desc: "Break-glass entry with full supervisor notification", variant: "warning" },
    { icon: "users", title: "Shared login detection", desc: "Anomalous concurrent sessions are flagged instantly" },
];

export default function BrandPanel() {
    return (
        <aside className="login-panel">
            <div className="login-panel__brand">
                <span className="login-panel__brand-icon">
                    <Icon name="shield" />
                </span>
                <span className="login-panel__brand-name">Smart Care</span>
            </div>

            <div className="login-panel__orbit">
                <span className="orbit-ring orbit-ring--outer" />
                <span className="orbit-ring orbit-ring--inner" />
                <span className="orbit-node orbit-node--top">
                    <Icon name="lock" />
                    <span>RBAC</span>
                </span>
                <span className="orbit-node orbit-node--left">
                    <Icon name="monitor" />
                    <span>Monitor</span>
                </span>
                <span className="orbit-node orbit-node--bottom">
                    <Icon name="audit" />
                    <span>Audit</span>
                </span>
                <span className="orbit-center">
                    <Icon name="shield" />
                </span>
            </div>

            <div className="login-panel__copy">
                <h1>Secure access to patient records</h1>
                <p>
                    A security middleware layer for Nigerian hospital Smart Care systems.
                    Every access is authenticated, role-controlled, and permanently
                    audited.
                </p>
            </div>

            <ul className="login-panel__features">
                {FEATURES.map((f) => (
                    <li key={f.title} className="feature-item">
                        <span
                            className={`feature-item__icon${f.variant === "warning" ? " feature-item__icon--warning" : ""
                                }`}
                        >
                            <Icon name={f.icon} />
                        </span>
                        <span>
                            <strong>{f.title}</strong>
                            <small>{f.desc}</small>
                        </span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}