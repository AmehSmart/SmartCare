import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import Icon from "../../components/ui/Icon";
import Pill from "../../components/ui/Pill";
import { CURRENT_USER, NAV_ITEMS } from "../../components/layout/navConfig";
import "./ScopedChart.css";

const PATIENT = { name: "Ngozi Nnadi", id: "PT-2024-0561", ward: "Maternity", age: 25, gender: "Female", dob: "08 Jul 2001" };

export default function ScopedChart() {
    const { id } = useParams();
    const [revealed, setRevealed] = useState(false);
    return <div className="chart-page">
        <Sidebar navItems={NAV_ITEMS} user={CURRENT_USER} />
        <div className="chart-main"><Topbar /><main className="chart-content">
            <Link className="chart-back" to="/patients"><Icon name="chevron-left" /> Back to patients</Link>
            <header className="chart-header"><div className="chart-avatar">NN</div><div><p className="chart-eyebrow">Scoped chart · {id || PATIENT.id}</p><h1>{PATIENT.name}</h1><p>{PATIENT.age} years · {PATIENT.gender} · {PATIENT.ward}</p></div><Pill tone="green"><Icon name="shield" /> In scope</Pill></header>
            <div className="chart-grid">
                <div className="chart-column"><section className="chart-card"><div className="chart-card__title"><h2>Patient identity</h2><Pill tone="green">Hospital-verified</Pill></div><dl className="chart-details"><div><dt>Patient ID</dt><dd className="mono">{PATIENT.id}</dd></div><div><dt>Date of birth</dt><dd>{PATIENT.dob}</dd></div><div><dt>Assigned ward</dt><dd>{PATIENT.ward}</dd></div><div><dt>Care team</dt><dd>Internal Medicine</dd></div></dl></section><section className="chart-card"><div className="chart-card__title"><h2>Allergies and reactions</h2><Pill tone="green">Hospital-verified</Pill></div><div className="chart-alert"><Icon name="alert" /><div><strong>Latex</strong><span>Mild skin reaction · documented 08 Jun 2026</span></div></div></section></div>
                <div className="chart-column"><section className="chart-card"><div className="chart-card__title"><h2>Current medications</h2><Pill tone="blue">Recently updated</Pill></div><div className="chart-list"><div><strong>Folic acid</strong><span>5 mg · once daily</span></div><div><strong>Paracetamol</strong><span>500 mg · as needed</span></div></div></section><section className="chart-card"><div className="chart-card__title"><h2>Sensitive fields</h2><Pill tone="warning">Reveal is logged</Pill></div>{revealed ? <div className="chart-sensitive"><Icon name="check" /><div><strong>Consent and sensitive clinical data revealed</strong><span>Access recorded for {CURRENT_USER.name} · just now</span></div></div> : <div className="chart-locked"><Icon name="lock" /><div><strong>Hidden by default</strong><span>This field requires an explicit, audited reveal.</span></div><button onClick={() => setRevealed(true)}><Icon name="eye" /> Reveal - logged</button></div>}</section></div>
            </div>
            <div className="chart-audit"><Icon name="audit" /><span>Every permitted field access is recorded in the tamper-evident audit chain.</span><Link to="/audit-log">View audit log</Link></div>
        </main></div>
    </div>;
}