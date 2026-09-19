import Icon from "../../../components/ui/Icon";
import Avatar from "../../../components/ui/Avatar";

export default function ActivePatients({ patients, loading, error, onOpen }) {
    return (
        <section className="panel">
            <div className="panel__header">
                <h2>Active Patients</h2>
                <button type="button" className="link panel__header-action" onClick={onOpen}>
                    See all <Icon name="chevron" />
                </button>
            </div>
            <ul className="patient-list">
                {loading && <li className="dashboard-patient-state">Loading active patients...</li>}
                {!loading && error && <li className="dashboard-patient-state dashboard-patient-state--error">{error}</li>}
                {!loading && !error && patients.length === 0 && <li className="dashboard-patient-state">No active patients</li>}
                {!loading && !error && patients.slice(0, 4).map((patient) => (
                    <li key={patient.id} className="patient-list__item" onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }} role="button" tabIndex={0}>
                        <Avatar initials={patient.initials} muted />
                        <div>
                            <strong>{patient.name}</strong>
                            <small>{patient.ward}</small>
                        </div>
                        <Icon name="chevron" />
                    </li>
                ))}
            </ul>
        </section>
    );
}