import Icon from "../../../components/ui/Icon";

export default function PermissionsPanel({ permissions }) {
    return (
        <section className="panel">
            <div className="panel__header panel__header--icon">
                <Icon name="shield" />
                <h2>Your Permissions</h2>
            </div>
            <ul className="permission-list">
                {permissions.map((p) => (
                    <li key={p}>
                        <span>{p}</span>
                        <span className="permission-check">
                            <Icon name="check" />
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}