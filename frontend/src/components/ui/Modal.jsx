import { useEffect, useRef } from "react";
import "./Modal.css";
import Icon from "./Icon";

export default function Modal({
    open,
    onClose,
    variant = "default",
    headerIcon,
    title,
    subtitle,
    children,
    footer,
}) {
    const boxRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            boxRef.current?.focus();
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    if (!open) return null;

    const isGlass = variant === "glass";

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                ref={boxRef}
                className={`modal-box${isGlass ? " modal-box--glass" : ""}`}
                tabIndex={-1}
            >
                <div className="modal-header">
                    {headerIcon && (
                        <div className={`modal-header__icon modal-header__icon--${variant}`}>
                            <Icon name={headerIcon} />
                        </div>
                    )}
                    <div className="modal-header__titles">
                        {title && <h2 id="modal-title">{title}</h2>}
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close modal">
                        <Icon name="x" />
                    </button>
                </div>

                <div className="modal-body modal-body--no-top">{children}</div>

                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
