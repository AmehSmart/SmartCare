const APPOINTMENTS = [
    { date: "8 Jun 2026", type: "Antenatal check-up", provider: "Dr. Adaeze Okonkwo" },
    { date: "12 May 2026", type: "Routine scan", provider: "Dr. Tunde Bakare" },
    { date: "3 Apr 2026", type: "Antenatal check-up", provider: "Dr. Adaeze Okonkwo" },
];

export default function AppointmentHistoryTab() {
    return (
        <div className="pr-panel-body">
            <section className="pr-section">
                <h3>Appointment History</h3>
                <ul className="pr-appointment-list">
                    {APPOINTMENTS.map((a, i) => (
                        <li key={i}>
                            <span className="pr-field-label">{a.date}</span>
                            <div>
                                <strong>{a.type}</strong>
                                <small>{a.provider}</small>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}