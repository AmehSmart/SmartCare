import "./Button.css";

export default function Button({
    variant = "primary",
    size = "md",
    full = false,
    disabled = false,
    type = "button",
    onClick,
    children,
    className = "",
    ...props
}) {
    const cls = [
        "btn",
        `btn--${variant}`,
        size !== "md" ? `btn--${size}` : "",
        full ? "btn--full" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button type={type} className={cls} disabled={disabled} onClick={onClick} {...props}>
            {children}
        </button>
    );
}
