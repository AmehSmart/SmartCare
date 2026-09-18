import Icon from "../../../components/ui/Icon";
import { useNavigate } from "react-router-dom";

const QUICK_ACTIONS = [
    { icon: "file", title: "Patient Records", subtitle: "Browse and access records", route: "/patients" },
    { icon: "book", title: "Audit Log", subtitle: "View your access history", route: "/audit-log" },
    { icon: "users", title: "Staff Directory", subtitle: "Roles and access code setup", route: "/staff-roles" },
];

export default function QuickActions() {
    const navigate = useNavigate();

    return (
        <section className="panel">
            <h2>Quick Actions</h2>
            <ul className="action-list">
                {QUICK_ACTIONS.map((a) => (
                    <li key={a.title} className="action-list__item" onClick={() => navigate(a.route)} role="button" tabIndex={0} onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(a.route);
                        }
                    }}>
                        <span className="action-list__icon">
                            <Icon name={a.icon} />
                        </span>
                        <div>
                            <strong>{a.title}</strong>
                            <small>{a.subtitle}</small>
                        </div>
                        <Icon name="chevron" />
                    </li>
                ))}
            </ul>
        </section>
    );
}