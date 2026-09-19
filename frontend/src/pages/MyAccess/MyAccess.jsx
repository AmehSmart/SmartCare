import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Pill from "../../components/ui/Pill";
import { useAuth } from "../../context/useAuth";
import { NAV_ITEMS } from "../../components/layout/navConfig";
import { getUserPermissions } from "../../services/api/roleService";

const ACCESS_RULES = {
    Nurse: [
        "View assigned patient records",
        "View demographics",
        "View diagnosis/notes",
        "View medications/labs",
    ],
    "Attending Doctor": [
        "Full patient demographics",
        "Full diagnosis and notes",
        "Full medications and labs",
        "Full sensitive flags",
    ],
    "Records Clerk": [
        "View demographics",
        "View patient administrative record",
        "No clinical diagnosis access",
    ],
    "Visiting/Locum Doctor": [
        "Full demographics",
        "Time-boxed clinical access",
        "Full medications/labs",
        "Redacted sensitive fields",
    ],
    "Lab/Pharmacy Staff": [
        "Order-relevant information",
        "Own-order scope",
        "No unnecessary deep history",
    ],
};

export default function MyAccess() {
    const { user } = useAuth();
    const permissions = getUserPermissions(user);

    return (
        <div className="worklist-page">
            <Sidebar navItems={NAV_ITEMS} user={user} />
            <div className="worklist-main">
                <Topbar initials={user?.initials} />
                <main className="worklist-content">
                    <div className="worklist-heading">
                        <div>
                            <p className="worklist-eyebrow">Access summary</p>
                            <h1>My Access</h1>
                            <p>Only your authenticated staff scope is shown here.</p>
                        </div>
                        <Pill tone="blue">{user?.role || "Role"}</Pill>
                    </div>

                    <section className="profile-card my-access-card" style={{ marginTop: 20 }}>
                        <div className="profile-card-heading">
                            <div>
                                <h2>Current access context</h2>
                                <p>Role, ward, shift, and permission scope.</p>
                            </div>
                        </div>
                        <div className="profile-form-grid my-access-grid">
                            <div className="profile-field"><span>Role</span><strong>{user?.role || "Not assigned"}</strong></div>
                            <div className="profile-field"><span>Department</span><strong>{user?.department || "Not assigned"}</strong></div>
                            <div className="profile-field"><span>Ward</span><strong>{user?.ward || "Not assigned"}</strong></div>
                            <div className="profile-field"><span>Shift</span><strong>{user?.shift || "Not assigned"}</strong></div>
                            <div className="profile-field"><span>Patient scope</span><strong>Assigned patients / authorized ward</strong></div>
                        </div>
                    </section>

                    <section className="profile-card my-access-card" style={{ marginTop: 20 }}>
                        <div className="profile-card-heading">
                            <div>
                                <h2>Permissions</h2>
                                <p>These are the actions currently available to your account.</p>
                            </div>
                        </div>
                        <div className="profile-permissions access-permissions">
                            {permissions.length ? permissions.map((permission) => <span key={permission}>{permission.replace(/_/g, " ")}</span>) : <span>No permissions assigned</span>}
                        </div>
                    </section>

                    <section className="profile-card my-access-card" style={{ marginTop: 20 }}>
                        <div className="profile-card-heading">
                            <div>
                                <h2>Access profile</h2>
                                <p>Clinical visibility for your role.</p>
                            </div>
                        </div>
                        <ul className="action-list my-access-list">
                            {(ACCESS_RULES[user?.role] || ACCESS_RULES.Nurse).map((rule) => (
                                <li key={rule} className="action-list__item my-access-item">
                                    <span className="action-list__icon"><span>✓</span></span>
                                    <div>
                                        <strong>{rule}</strong>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                </main>
            </div>
        </div>
    );
}
