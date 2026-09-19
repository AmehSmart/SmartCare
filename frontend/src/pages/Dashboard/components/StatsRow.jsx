import Icon from "../../../components/ui/Icon";

export default function StatsRow({ stats, onSelect }) {
    return (
        <div className="stats-row">
            {stats.map((s) => (
                <button
                    type="button"
                    className="stat-card"
                    key={s.label}
                    onClick={() => onSelect?.(s.label)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelect?.(s.label);
                        }
                    }}
                    aria-label={`Open ${s.label}`}
                >
                    <div className="stat-card__top">
                        <span className="stat-card__label">{s.label}</span>
                        <span className={`stat-card__icon stat-card__icon--${s.tint}`}>
                            <Icon name={s.icon} />
                        </span>
                    </div>
                    <div className="stat-card__value">{s.value}</div>
                    <div className="stat-card__note">{s.note}</div>
                </button>
            ))}
        </div>
    );
}