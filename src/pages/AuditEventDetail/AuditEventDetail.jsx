import { Link, useParams } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import { CURRENT_USER, NAV_ITEMS } from "../../components/layout/navConfig";
import "./AuditEventDetail.css";

export default function AuditEventDetail() {
    const { id = "EVT200" } = useParams();
    return <div className="event-page"><Sidebar navItems={NAV_ITEMS} user={CURRENT_USER} /><main className="event-main"><div className="event-topstrip" /><div className="event-content"><Link className="event-back" to="/audit-log"><Icon name="chevron-left" /> Back to audit log</Link><div className="event-heading"><div><p className="event-eyebrow">Audit event detail</p><h1>{id}</h1><p>Immutable record from the SmartCare access decision trail.</p></div><Pill tone="red"><Icon name="alert" /> Chain link requires review</Pill></div><section className="event-card"><h2>Decision context</h2><dl className="event-details"><div><dt>Actor</dt><dd>Dr. Adaeze Okonkwo <small>DR001 · Attending Doctor</small></dd></div><div><dt>Patient</dt><dd>Fatima Abdullahi <small>PT-000184</small></dd></div><div><dt>Decision</dt><dd><Pill tone="green">Permitted</Pill></dd></div><div><dt>Purpose of use</dt><dd>Treatment</dd></div><div><dt>Accessed field</dt><dd>HIV Status</dd></div><div><dt>Timestamp</dt><dd>08 Sep 2026 · 08:43</dd></div></dl></section><section className="event-card"><h2>Hash-chain linkage</h2><div className="event-hash"><span>Previous hash</span><code>e07398470a57308a03d398a03d39830</code></div><div className="event-hash event-hash--danger"><span>Current hash</span><code>0295ba692c795a2c25f5ba2c25f5ba69</code><Pill tone="red">Does not match expected link</Pill></div></section></div></main></div>;
}