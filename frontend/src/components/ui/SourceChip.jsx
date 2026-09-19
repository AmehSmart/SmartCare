import "./SourceChip.css";
import Icon from "./Icon";

const VARIANTS = {
    hospital: { cls: "source-chip--hospital", icon: "shield", label: "Hospital-verified" },
    document: { cls: "source-chip--document", icon: "file", label: "Document-backed" },
    patient:  { cls: "source-chip--patient",  icon: "person", label: "Patient-entered" },
    recent:   { cls: "source-chip--recent",   icon: "clock",  label: null },
};

export default function SourceChip({ variant = "hospital", label, timestamp }) {
    const v = VARIANTS[variant] || VARIANTS.hospital;
    const text = label ?? v.label ?? (variant === "recent" && timestamp ? `Updated ${timestamp}` : "");

    return (
        <span className={`source-chip ${v.cls}`}>
            <Icon name={v.icon} />
            {text}
        </span>
    );
}
