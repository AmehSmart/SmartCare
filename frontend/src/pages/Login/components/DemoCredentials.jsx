const DEMO_CREDENTIALS = [
    { id: "DR001", name: "Dr. Adaeze Okonkwo", pin: "123456" },
    { id: "N8002", name: "Nurse Emeka Nwosu", pin: "246810" },
    { id: "RC003", name: "Chioma Eze", pin: "135790" },
    { id: "AD001", name: "Admin John Doe", pin: "987654" },
];

export default function DemoCredentials() {
    return (
        <div className="demo-box">
            <p className="demo-box__title">DEMO CREDENTIALS</p>
            <ul>
                {DEMO_CREDENTIALS.map((c) => (
                    <li key={c.id}>
                        <span className="demo-box__id">{c.id}</span>
                        <span className="demo-box__name">{c.name}</span>
                        <span className="demo-box__pin">{c.pin}</span>

                    </li>
                ))}
            </ul>
        </div>
    );
}