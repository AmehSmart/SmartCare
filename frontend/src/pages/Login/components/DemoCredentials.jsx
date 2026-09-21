const DEMO_CREDENTIALS = [
    { id: "Admin", email: "admin@smartcare.test", pin: "KofaDemo!2026" },
    { id: "DR", email: "doctor1@smartcare.test", pin: "KofaDemo!2026" },
    { id: "Nurse", email: "nurse1@smartcare.test", pin: "KofaDemo!2026" },
    { id: "Audit", email: "zainab@example.test", pin: "KofaDemo!2026" },
    { id: "Clerk", email: "records1@smartcare.test", pin: "KofaDemo!2026" },
];

export default function DemoCredentials({ onSelect, disabled = false }) {
    return (
        <div className="demo-box">
            <p className="demo-box__title">DEMO CREDENTIALS</p>
            <ul>
                {DEMO_CREDENTIALS.map((c) => (
                    <li key={c.id}>
                        <button
                            type="button"
                            className="demo-box__login"
                            onClick={() => onSelect?.({ staffId: c.email, pin: c.pin })}
                            disabled={disabled}
                            aria-label={`Sign in as demo ${c.id}`}
                        >
                            <span className="demo-box__id">{c.id}</span>
                            <span className="demo-box__email">{c.email}</span>
                            <span className="demo-box__pin">{c.pin}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}