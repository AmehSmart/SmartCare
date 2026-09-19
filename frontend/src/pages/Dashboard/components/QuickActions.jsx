import Icon from "../../../components/ui/Icon";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { hasPermission } from "../../../services/api/roleService";

const QUICK_ACTIONS = [
    { icon: "users", title: "My Patients", subtitle: "Review your assigned patients", route: "/my-patients", permission: "view_my_patients" },
    { icon: "file", title: "Patient Records", subtitle: "Browse and access records", route: "/patients", permission: "view_patients" },
    { icon: "lock", title: "My Access", subtitle: "View your permissions and scope", route: "/my-access", permission: "view_own_access" },
    { icon: "book", title: "Audit Log", subtitle: "Review security activity", route: "/audit-log", permission: "view_audit_logs" },
    { icon: "users", title: "Staff & Roles", subtitle: "Manage access and assignments", route: "/staff-roles", permission: "manage_roles" },
    { icon: "person", title: "My Profile", subtitle: "View your access context", route: "/profile" },
];

export default function QuickActions() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const actions = QUICK_ACTIONS.filter((action) => {
        if (action.title === "My Patients" && user?.role === "Administrator") {
            return false;
        }
        return !action.permission || hasPermission(user, action.permission);
    });

    return (
        <section className="panel">
            <h2>Quick Actions</h2>
            <ul className="action-list">
                {actions.map((a) => (
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