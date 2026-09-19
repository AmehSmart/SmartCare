import Icon from "../../../components/ui/Icon";
import Pill from "../../../components/ui/Pill";
import { useNavigate } from "react-router-dom";

export default function RecentActivity({ activity }) {
    const navigate = useNavigate();

    return (
        <section className="panel">
            <div className="panel__header">
                <h2>Recent Activity</h2>
                <button type="button" className="link panel__header-action" onClick={() => navigate("/audit-log")}>
                    Full log <Icon name="chevron" />
                </button>
            </div>
            <ul className="activity-list">
                {activity.map((a, i) => (
                    <li key={i} className="activity-list__item">
                        <Pill tone={a.tagType}>{a.tag}</Pill>
                        <div className="activity-list__body">
                            {a.name && <strong>{a.name}</strong>}
                            <small>{a.time}</small>
                        </div>
                        {a.flagged && (
                            <span className="activity-list__flag">
                                <Icon name="alert" />
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}