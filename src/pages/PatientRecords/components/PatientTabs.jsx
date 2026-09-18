import Icon from "../../../components/ui/Icon";

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "clinical", label: "Clinical" },
    { id: "appointments", label: "Appointment History" },
    { id: "sensitive", label: "Sensitive", locked: true },
];

export default function PatientTabs({ activeTab, onChange }) {
    return (
        <div className="pr-tabs">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    className={`pr-tabs__item${activeTab === tab.id ? " pr-tabs__item--active" : ""
                        }`}
                    onClick={() => onChange(tab.id)}
                >
                    {tab.label}
                    {tab.locked && <Icon name="lock" className="pr-tabs__lock" />}
                </button>
            ))}
        </div>
    );
}