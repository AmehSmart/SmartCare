import "./Pill.css";

export default function Pill({ tone = "blue", children }) {
    return <span className={`pill pill--${tone}`}>{children}</span>;
}