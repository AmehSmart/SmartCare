import Icon from "../../../components/ui/Icon";

export default function RecentAccessLog({ entries }) {
    return (
        <section className="pr-access-log">
            <h3>Recent Access to This Record</h3>
            <ul>
                {entries.map((e, i) => (
                    <li key={i}>
                        <span className="pr-field-label">{e.time}</span>
                        <span className="pr-access-log__user">{e.user}</span>
                        <span className="pr-access-log__action">
                            {e.action}
                            {e.detail && <em> ({e.detail})</em>}
                        </span>
                        {e.flagged && (
                            <span className="pr-access-log__flag">
                                <Icon name="lock" />
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}