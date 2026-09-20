import { useState, useMemo, useEffect } from "react";
import "./AuditLog.css";
import Sidebar from "../../components/layout/Sidebar";
import Icon from "../../components/ui/Icon";
import { NAV_ITEMS, CURRENT_USER } from "../../components/layout/navConfig";
import { useAuth } from "../../context/useAuth";
import { getAuditEvents } from "../../services/api/auditApi";
import FilterBar from "./components/FilterBar";
import ChainBreakBanner from "./components/ChainBreakBanner";
import AuditLogTable from "./components/AuditLogTable";
import EventDetailPanel from "./components/EventDetailPanel";

const EVENTS = [
    {
        id: 1, date: "12/09/2026", time: "19:36", actor: "Nurse", actorFullName: "Nurse Emeka Nwosu",
        actorId: "N8002", role: "NURSE", action: "Field accessed", field: "Allergies",
        target: "Fatima Abdullahi", ip: "192.168.1.50", eventId: "EVT320",
        hash: "7a1f32e14a91d4d47a7f32d47a7f32d4", prevHash: "1233d4432033034c1233d4432b3f...", chainOk: true,
    },
    {
        id: 2, date: "12/09/2026", time: "19:36", actor: "Nurse", actorFullName: "Nurse Emeka Nwosu",
        actorId: "N8002", role: "NURSE", action: "Field accessed", field: "Vitals",
        target: "Fatima Abdullahi", ip: "192.168.1.50", eventId: "EVT321",
        hash: "9b2e43f25b02e5e58b8f43e58b8f43e5", prevHash: "7a1f32e14a91d4d47a7f32d47a7f32d4", chainOk: true,
    },
    {
        id: 3, date: "12/09/2026", time: "19:36", actor: "Nurse", actorFullName: "Nurse Emeka Nwosu",
        actorId: "N8002", role: "NURSE", action: "Field accessed", field: "Demographics",
        target: "Fatima Abdullahi", ip: "192.168.1.50", eventId: "EVT322",
        hash: "ac3f54036c13f6f69c9f54f69c9f54f6", prevHash: "9b2e43f25b02e5e58b8f43e58b8f43e5", chainOk: true,
    },
    {
        id: 4, date: "12/09/2026", time: "19:36", actor: "Nurse", actorFullName: "Nurse Emeka Nwosu",
        actorId: "N8002", role: "NURSE", action: "Viewed record", field: null,
        target: "Fatima Abdullahi", ip: "192.168.1.50", eventId: "EVT323",
        hash: "bd4065147d24075d70a065d70a06507", prevHash: "ac3f54036c13f6f69c9f54f69c9f54f6", chainOk: true,
    },
    {
        id: 5, date: "12/09/2026", time: "19:36", actor: "Nurse", actorFullName: "Nurse Emeka Nwosu",
        actorId: "N8002", role: "NURSE", action: "Viewed record", field: null,
        target: "Fatima Abdullahi", ip: "192.168.1.50", eventId: "EVT324",
        hash: "ce5176258e35186e81b176e81b17618", prevHash: "bd4065147d24075d70a065d70a06507", chainOk: true,
    },
    {
        id: 6, date: "12/09/2026", time: "19:30", actor: "Nurse", actorFullName: "Nurse Emeka Nwosu",
        actorId: "N8002", role: "NURSE", action: "Login", field: null,
        target: "-", ip: "192.168.1.50", eventId: "EVT325",
        hash: "df6287369f46297f92c287f92c28729", prevHash: "ce5176258e35186e81b176e81b17618", chainOk: true,
    },
    {
        id: 7, date: "08/09/2026", time: "09:01", actor: "Chioma", actorFullName: "Chioma Eze",
        actorId: "RC003", role: "RECORDS_CLERK", action: "Login", field: null,
        target: "-", ip: "192.168.114.19", eventId: "EVT198",
        hash: "e07398470a57308a03d398a03d39830", prevHash: "df6287369f46297f92c287f92c28729", chainOk: true,
        flagged: true, flagNote: "Concurrent session from 192.168.114.19",
    },
    {
        id: 8, date: "08/09/2026", time: "08:44", actor: "Dr.", actorFullName: "Dr. Adaeze Okonkwo",
        actorId: "DR001", role: "ATTENDING_DOCTOR", action: "Field accessed", field: "HIV Status",
        target: "Fatima Abdullahi", ip: "192.168.1.12", eventId: "EVT199",
        hash: "f184a9581b68419b14e4a9b14e4a958", prevHash: "e07398470a57308a03d398a03d39830", chainOk: true,
    },
    {
        id: 9, date: "08/09/2026", time: "08:43", actor: "Dr.", actorFullName: "Dr. Adaeze Okonkwo",
        actorId: "DR001", role: "ATTENDING_DOCTOR", action: "Viewed record", field: null,
        target: "Fatima Abdullahi", ip: "192.168.1.12", eventId: "EVT200",
        hash: "0295ba692c795a2c25f5ba2c25f5ba69", prevHash: "f184a9581b68419b14e4a9b14e4a958", chainOk: false,
    },
    {
        id: 10, date: "08/09/2026", time: "08:42", actor: "Dr.", actorFullName: "Dr. Adaeze Okonkwo",
        actorId: "DR001", role: "ATTENDING_DOCTOR", action: "Login", field: null,
        target: "-", ip: "192.168.1.12", eventId: "EVT201",
        hash: "13a6cb703d8a6b3d360a6b3d360a6cb7", prevHash: "0295ba692c795a2c25f5ba2c25f5ba69", chainOk: true,
    },
];

export default function AuditLog() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [activeFilter, setActiveFilter] = useState("All");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        let mounted = true;
        getAuditEvents()
            .then((data) => { if (mounted) setEvents(data); })
            .catch((err) => { if (mounted) setLoadError(err.message || "Unable to load the audit log."); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const handleDownload = () => {
        const csvRows = [
            ["Date", "Time", "Actor", "Role", "Action", "Field", "Target", "Event ID"],
            ...events.map((event) => [
                event.date,
                event.time,
                event.actorFullName || event.actor,
                event.role,
                event.action,
                event.field ?? "-",
                event.target,
                event.eventId,
            ]),
        ];

        const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "audit-log.csv";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const filteredEvents = useMemo(() => {
        if (activeFilter === "All") return events;
        if (activeFilter === "Anomalies") return events.filter((e) => e.flagged);
        return events.filter((e) => String(e.action || "").toLowerCase().includes(activeFilter.toLowerCase()));
    }, [activeFilter, events]);

    const hasChainBreak = events.some((e) => e.chainOk === false);
    const selectedIndex = selected ? filteredEvents.findIndex((e) => e.id === selected.id) : -1;

    return (
        <div className="al-page">
            <Sidebar navItems={NAV_ITEMS} user={user || CURRENT_USER} />

            <div className="al-main">
                <div className="al-topstrip" />
                {hasChainBreak && (
                    <div className="al-page-banner">
                        <ChainBreakBanner
                            onViewAffected={() => {
                                const broken = EVENTS.find((e) => e.chainOk === false);
                                if (broken) setSelected(broken);
                            }}
                        />
                    </div>
                )}

                <div className="al-page-title">
                    <h1>Audit Logs</h1>
                </div>

                <div className="al-content">
                    <div className={`al-card${selected ? " al-card--split" : ""}`}>
                        <div className="al-card__main">
                            <div className="al-card__header">
                                <div>
                                    <h2>Audit log</h2>
                                    <p>
                                        {events.length} events · hash-chained in a separate audit store
                                    </p>
                                </div>
                                <button type="button" className="al-download-btn" onClick={handleDownload}>
                                    <Icon name="download" />
                                    Download
                                </button>
                            </div>

                            <FilterBar active={activeFilter} onChange={setActiveFilter} />

                            {loading && <p className="al-state">Loading audit events...</p>}
                            {!loading && loadError && <p className="al-state al-state--error">{loadError}</p>}
                            {!loading && !loadError && filteredEvents.length === 0 && <p className="al-state">No audit events.</p>}
                            {!loading && !loadError && filteredEvents.length > 0 && (
                                <AuditLogTable
                                    events={filteredEvents}
                                    onSelect={setSelected}
                                    selectedId={selected?.id}
                                />
                            )}
                        </div>

                        {selected && (
                            <EventDetailPanel
                                event={selected}
                                onClose={() => setSelected(null)}
                                onPrev={
                                    selectedIndex > 0
                                        ? () => setSelected(filteredEvents[selectedIndex - 1])
                                        : null
                                }
                                onNext={
                                    selectedIndex < filteredEvents.length - 1
                                        ? () => setSelected(filteredEvents[selectedIndex + 1])
                                        : null
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}