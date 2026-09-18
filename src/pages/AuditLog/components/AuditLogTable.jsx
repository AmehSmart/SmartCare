import Pill from "../../../components/ui/Pill";

const ACTION_TONE = {
    Login: "blue",
    Logout: "blue",
    "Viewed record": "blue",
    "Field accessed": "teal",
    "Break glass": "warning",
    Emergency: "warning",
    Denied: "red",
    "Failed login": "red",
};

export default function AuditLogTable({ events, onSelect, selectedId }) {
    return (
        <div className="al-table-wrap">
            <table className="al-table">
                <thead>
                    <tr>
                        <th>Date / Time</th>
                        <th>Activity</th>
                        <th>Target</th>
                        <th>Role</th>
                        <th>Chain</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map((e) => (
                        <tr
                            key={e.id}
                            className={`${e.flagged ? "al-row--flagged" : ""}${selectedId === e.id ? " al-row--selected" : ""
                                }`}
                            onClick={() => onSelect(e)}
                        >
                            <td className="al-table__time">
                                {e.date}, {e.time}
                            </td>
                            <td>
                                <div className="al-activity-cell">
                                    <span className="al-activity-cell__actor">{e.actor}</span>
                                    <Pill tone={ACTION_TONE[e.action] || "blue"}>
                                        {e.action}
                                    </Pill>
                                    {e.field && <span className="al-activity-cell__field">{e.field}</span>}
                                </div>
                                {e.flagNote && (
                                    <div className="al-activity-cell__note">⚠ {e.flagNote}</div>
                                )}
                            </td>
                            <td>
                                {e.target !== "—" ? (
                                    <span className="al-table__target">{e.target}</span>
                                ) : (
                                    <span className="al-table__dash">—</span>
                                )}
                            </td>
                            <td className="al-table__role">{e.role}</td>
                            <td>
                                <span
                                    className={`al-chain-dot${e.chainOk === false ? " al-chain-dot--broken" : ""
                                        }`}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}