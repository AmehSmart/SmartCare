import "./Avatar.css";

export default function Avatar({ initials, size = "md", muted = false, tone = "blue" }) {
    const sizeClass = size === "sm" ? " avatar--sm" : size === "lg" ? " avatar--lg" : "";
    const mutedClass = muted ? " avatar--muted" : "";
    const toneClass = tone !== "blue" ? ` avatar--${tone}` : "";
    return <span className={`avatar${sizeClass}${mutedClass}${toneClass}`}>{initials}</span>;
}