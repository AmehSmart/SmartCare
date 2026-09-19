import { useEffect, useState } from "react";
import "./Notifications.css";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import Button from "../../components/ui/Button";
import { NAV_ITEMS, CURRENT_USER } from "../../components/layout/navConfig";
import { useAuth } from "../../context/useAuth";
import { getNotifications, markNotificationRead } from "../../services/api/notificationApi";

const TYPE_LABELS = {
    BREAK_GLASS_ACCESS: { label: "Emergency access", tone: "warning", icon: "shield" },
    SENSITIVE_FIELD_REVEAL: { label: "Sensitive reveal", tone: "amber", icon: "lock" },
    PASSPORT_USED: { label: "Passport used", tone: "blue", icon: "key" },
    DEFAULT: { label: "Notification", tone: "blue", icon: "bell" },
};

function formatWhen(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Notifications() {
    const { user } = useAuth();
    const displayUser = user || CURRENT_USER;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        getNotifications()
            .then((data) => {
                if (mounted) setItems(data);
            })
            .catch((err) => {
                if (mounted) setError(err.message || "Unable to load notifications.");
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            setItems((current) =>
                current.map((item) => (item.id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item))
            );
        } catch (err) {
            setError(err.message || "Unable to update notification.");
        }
    };

    const unreadCount = items.filter((item) => !item.read).length;

    return (
        <div className="dash">
            <Sidebar navItems={NAV_ITEMS} user={displayUser} />

            <div className="dash-main">
                <Topbar initials={displayUser.initials} />

                <main className="dash-content">
                    <div className="dash-content__header">
                        <div>
                            <h1>Notifications</h1>
                            <p>Access alerts on records you are responsible for.</p>
                        </div>
                        {unreadCount > 0 && (
                            <div className="date-pill">
                                <Icon name="bell" />
                                {unreadCount} unread
                            </div>
                        )}
                    </div>

                    <div className="notifications-list" aria-live="polite">
                        {loading && <p className="notifications-state">Loading notifications...</p>}
                        {!loading && error && <p className="notifications-state notifications-state--error">{error}</p>}
                        {!loading && !error && items.length === 0 && (
                            <p className="notifications-state">You have no notifications.</p>
                        )}
                        {!loading && !error && items.map((item) => {
                            const meta = TYPE_LABELS[item.type] || TYPE_LABELS.DEFAULT;
                            return (
                                <article
                                    key={item.id}
                                    className={`notification-card${item.read ? "" : " notification-card--unread"}`}
                                >
                                    <span className={`notification-card__icon notification-card__icon--${meta.tone}`}>
                                        <Icon name={meta.icon} />
                                    </span>
                                    <div className="notification-card__body">
                                        <div className="notification-card__top">
                                            <Pill tone={meta.tone}>{meta.label}</Pill>
                                            <span className="notification-card__time">{formatWhen(item.createdAt)}</span>
                                        </div>
                                        <strong className="notification-card__title">{item.title}</strong>
                                        {Object.keys(item.metadata || {}).length > 0 && (
                                            <p className="notification-card__meta">
                                                {Object.entries(item.metadata)
                                                    .map(([key, value]) => `${key}: ${value}`)
                                                    .join(" · ")}
                                            </p>
                                        )}
                                    </div>
                                    {!item.read && (
                                        <Button type="button" size="sm" variant="secondary" onClick={() => handleMarkRead(item.id)}>
                                            Mark read
                                        </Button>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
