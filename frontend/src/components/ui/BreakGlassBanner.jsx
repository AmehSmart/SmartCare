import { useState, useEffect } from "react";
import "./BreakGlassBanner.css";
import Icon from "./Icon";

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export default function BreakGlassBanner({
    actor = "Dr. Adaeze Okonkwo",
    reason = "Emergency access",
    durationSeconds = 900,
    onEnd,
}) {
    const [remaining, setRemaining] = useState(durationSeconds);

    useEffect(() => {
        if (remaining <= 0) {
            onEnd?.();
            return;
        }
        const id = setInterval(() => setRemaining((r) => r - 1), 1000);
        return () => clearInterval(id);
    }, [remaining, onEnd]);

    return (
        <div
            className="bg-banner"
            role="alert"
            aria-live="polite"
            aria-label={`Emergency break-glass access active. ${formatTime(remaining)} remaining.`}
        >
            <span className="bg-banner__icon">
                <Icon name="alert" />
            </span>

            <div className="bg-banner__body">
                <span className="bg-banner__title">⚠ Emergency Access Active</span>
                <span className="bg-banner__detail">
                    <strong>{actor}</strong> · {reason}
                </span>
            </div>

            <div className="bg-banner__timer" aria-label={`Time remaining: ${formatTime(remaining)}`}>
                <Icon name="clock" />
                {formatTime(remaining)}
            </div>

            <button className="bg-banner__end" onClick={onEnd}>
                <Icon name="x" />
                End Access
            </button>
        </div>
    );
}
