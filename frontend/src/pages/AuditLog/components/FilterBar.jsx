const FILTERS = [
    "All",
    "Login",
    "Logout",
    "Viewed record",
    "Field accessed",
    "Break glass",
    "Emergency",
    "Failed login",
    "Denied",
    "Anomalies",
];

export default function FilterBar({ active, onChange }) {
    return (
        <div className="al-filters">
            <span className="al-filters__label">Filter:</span>
            {FILTERS.map((f) => (
                <button
                    key={f}
                    className={`al-filter-chip${active === f ? " al-filter-chip--active" : ""}`}
                    onClick={() => onChange(f)}
                >
                    {f}
                </button>
            ))}
        </div>
    );
}