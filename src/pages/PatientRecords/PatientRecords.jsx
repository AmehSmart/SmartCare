import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./PatientRecords.css";
import Sidebar from "../../components/layout/Sidebar";
import Icon from "../../components/ui/Icon";
import { NAV_ITEMS, CURRENT_USER } from "../../components/layout/navConfig";
import { getPatientById, getPatientFieldAccess } from "../../services/api/patientApi";
import PatientHeader from "./components/PatientHeader";
import PatientTabs from "./components/PatientTabs";
import OverviewTab from "./components/OverviewTab";
import ClinicalTab from "./components/ClinicalTab";
import AppointmentHistoryTab from "./components/AppointmentHistoryTab";
import SensitiveTab from "./components/SensitiveTab";
import RecentAccessLog from "./components/RecentAccessLog";
import { useAuth } from "../../context/useAuth";

const ACCESS_LOG = [
    { time: "08:29", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "allergies" },
    { time: "08:29", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "vitals" },
    { time: "08:29", user: "Nurse Emeka Nwosu", action: "FIELD ACCESS", detail: "demographics" },
    { time: "08:27", user: "Nurse Emeka Nwosu", action: "EMERGENCY LOGIN", flagged: true },
];

const VITALS = [
    { label: "Blood Pressure", value: "110/72", unit: "mmHg", tone: "blue" },
    { label: "Heart Rate", value: "84", unit: "bpm", tone: "red" },
    { label: "Temperature", value: "37.0", unit: "°C", tone: "amber" },
    { label: "Oxygen Saturation", value: "99", unit: "%", tone: "teal" },
    { label: "Weight", value: "71", unit: "kg", tone: "purple" },
];

export default function PatientRecords() {
    const { patientId } = useParams();
    const { user } = useAuth();
    const currentUser = user || CURRENT_USER;
    const [activeTab, setActiveTab] = useState("overview");
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadPatient() {
            try {
                if (!patientId) {
                    return;
                }

                const nextPatient = await getPatientById(patientId);
                if (mounted) {
                    setPatient({
                        initials: nextPatient.initials,
                        name: nextPatient.name,
                        gender: nextPatient.gender,
                        age: nextPatient.age,
                        tag: nextPatient.ward,
                        admitted: "8 Jun 2026",
                        code: nextPatient.id,
                        dob: nextPatient.demographics?.dob || "Not available",
                        address: nextPatient.demographics?.address || "Not available",
                        phone: nextPatient.demographics?.phone || "Not available",
                        vitals: VITALS,
                        allergies: ["Latex (mild)"],
                        fieldAccess: getPatientFieldAccess(nextPatient, currentUser.role),
                    });
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadPatient();

        return () => {
            mounted = false;
        };
    }, [patientId, currentUser.role]);

    const renderTab = () => {
        if (!patient) return null;

        switch (activeTab) {
            case "overview":
                return <OverviewTab patient={patient} />;
            case "clinical":
                return <ClinicalTab patient={patient} />;
            case "appointments":
                return <AppointmentHistoryTab />;
            case "sensitive":
                return <SensitiveTab patient={patient} />;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="pr-page">
                <Sidebar navItems={NAV_ITEMS} activeKey="records" user={currentUser} />
                <div className="pr-main">
                    <div className="pr-topstrip" />
                    <div className="pr-page-title">
                        <div className="pr-page-title__inner">
                            <h1>Patient Records</h1>
                            <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                    <div className="pr-content">
                        <div className="pr-card">
                            <p className="pr-loading">Loading patient record...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="pr-page">
                <Sidebar navItems={NAV_ITEMS} activeKey="records" user={currentUser} />
                <div className="pr-main">
                    <div className="pr-topstrip" />
                    <div className="pr-page-title">
                        <div className="pr-page-title__inner">
                            <h1>Patient Records</h1>
                            <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                    <div className="pr-content">
                        <div className="pr-card">
                            <p className="pr-loading">Patient record not found.</p>
                            <Link className="pr-back-link" to="/patients">Back to patient list</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pr-page">
            <Sidebar
                navItems={NAV_ITEMS}
                activeKey="records"
                onSelect={() => { }}
                user={currentUser}
            />

            <div className="pr-main">
                <div className="pr-topstrip" />
                <div className="pr-page-title">
                    <div className="pr-page-title__inner">
                        <h1>Patient Records</h1>
                        <Link className="pr-header-back" to="/patients">Back to patient list</Link>
                    </div>
                </div>

                <div className="pr-content">
                    <div className="pr-breadcrumb">
                        <Link to="/patients" className="pr-breadcrumb__link">
                            <Icon name="chevron" className="pr-breadcrumb__back" />
                            <span>Patients</span>
                        </Link>
                        <span className="pr-breadcrumb__sep">/</span>
                        <strong>Patient Details</strong>
                    </div>

                    <div className="pr-card">
                        <PatientHeader patient={patient} />
                        <PatientTabs activeTab={activeTab} onChange={setActiveTab} />
                        {renderTab()}
                    </div>

                    <div className="pr-card">
                        <RecentAccessLog entries={ACCESS_LOG} />
                    </div>
                </div>
            </div>
        </div>
    );
}