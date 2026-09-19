import Avatar from "../../../components/ui/Avatar";
import Pill from "../../../components/ui/Pill";
import Icon from "../../../components/ui/Icon";

export default function EventDetailPanel({ event, onClose, onPrev, onNext }) {
    if (!event) return null;

    return (
        <aside className="al-detail">
            <div className="al-detail__header">
                <h3>{event.action}</h3>
                <button className="al-detail__close" onClick={onClose}>
                    <Icon name="x" />
                </button>
            </div>

            <div className="al-detail__who">
                <Avatar initials={event.initials || event.actor.slice(0, 2).toUpperCase()} />
                <div>
                    <strong>{event.actorFullName || event.actor}</strong>
                    <small>
                        {event.date}, {event.time}
                    </small>
                </div>
                <Pill tone="blue">{event.action}</Pill>
            </div>

            <section className="al-detail__section">
                <h4>Overview</h4>
                <dl className="al-detail__list">
                    <div>
                        <dt>Actor ID</dt>
                        <dd>{event.actorId}</dd>
                    </div>
                    <div>
                        <dt>Role</dt>
                        <dd>{event.role}</dd>
                    </div>
                    <div>
                        <dt>IP address</dt>
                        <dd>{event.ip}</dd>
                    </div>
                    <div>
                        <dt>Event ID</dt>
                        <dd>{event.eventId}</dd>
                    </div>
                    {event.target !== "—" && (
                        <div>
                            <dt>Patient</dt>
                            <dd>{event.target}</dd>
                        </div>
                    )}
                    {event.field && (
                        <div>
                            <dt>Field</dt>
                            <dd>{event.field}</dd>
                        </div>
                    )}
                    <div>
                        <dt>Status</dt>
                        <dd>{event.chainOk === false ? "Broken" : "Valid"}</dd>
                    </div>
                </dl>
            </section>

            <section className="al-detail__section">
                <h4>Hash Chain</h4>
                <div className="al-detail__hash">
                    <span className="al-detail__hash-label">← This event</span>
                    <code>{event.hash}</code>
                </div>
                <div className="al-detail__hash">
                    <span className="al-detail__hash-label">Prev hash</span>
                    <code>{event.prevHash}</code>
                </div>
            </section>

            <div className="al-detail__nav">
                <button onClick={onPrev} disabled={!onPrev}>
                    <Icon name="chevron-left" /> Previous event
                </button>
                <button onClick={onNext} disabled={!onNext}>
                    Next event <Icon name="chevron-right" />
                </button>
            </div>
        </aside>
    );
}