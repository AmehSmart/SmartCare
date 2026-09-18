import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Registration.css";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import { registerStaff } from "../../services/api/authApi";

const initialForm = { staffId: "", name: "", department: "", ward: "", pin: "", confirmPin: "" };

export default function Registration() {
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const validate = () => {
        const nextErrors = {};
        if (!form.staffId.trim()) nextErrors.staffId = "Staff ID is required.";
        if (!form.name.trim()) nextErrors.name = "Full name is required.";
        if (!form.department.trim()) nextErrors.department = "Department is required.";
        if (!form.ward.trim()) nextErrors.ward = "Ward or unit is required.";
        if (!/^\d{6}$/.test(form.pin)) nextErrors.pin = "PIN must contain exactly 6 digits.";
        if (form.pin !== form.confirmPin) nextErrors.confirmPin = "PINs do not match.";
        return nextErrors;
    };

    const submit = async (event) => {
        event.preventDefault();
        const nextErrors = validate();
        setErrors(nextErrors);
        setServerError("");
        if (Object.keys(nextErrors).length) return;

        setSubmitting(true);
        try {
            await registerStaff(form);
            setSuccess(true);
        } catch (error) {
            setServerError(error.message || "Unable to create your account.");
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return <main className="registration-page"><div className="registration-topline" /><section className="registration-card registration-success"><div className="registration-success-icon"><Icon name="check" /></div><p className="registration-eyebrow">Account request submitted</p><h1>You're almost there</h1><p>Your staff account has been created with the default Nurse role and is awaiting administrator activation.</p><Button onClick={() => navigate("/login", { replace: true })}>Return to sign in <Icon name="arrow-right" /></Button></section></main>;
    }

    return (
        <main className="registration-page">
            <div className="registration-topline" />
            <section className="registration-card">
                <Link className="registration-back" to="/login"><Icon name="chevron-left" /> Back to sign in</Link>
                <div className="registration-heading"><div className="registration-brand-icon"><Icon name="shield" /></div><p className="registration-eyebrow">SmartCare staff access</p><h1>Register your account</h1><p>Request access to the secure clinical portal. An administrator will assign your final role.</p></div>
                <div className="registration-notice"><Icon name="lock" /> New accounts start with the unprivileged Nurse role until reviewed.</div>
                <form onSubmit={submit} noValidate>
                    <div className="registration-grid">
                        <Field label="Staff ID" value={form.staffId} onChange={(value) => setField("staffId", value.toUpperCase())} error={errors.staffId} placeholder="e.g. N8003" />
                        <Field label="Full name" value={form.name} onChange={(value) => setField("name", value)} error={errors.name} placeholder="Your full name" />
                        <Field label="Department" value={form.department} onChange={(value) => setField("department", value)} error={errors.department} placeholder="e.g. Ward B" />
                        <Field label="Ward or unit" value={form.ward} onChange={(value) => setField("ward", value)} error={errors.ward} placeholder="e.g. Ward B" />
                        <Field label="6-digit PIN" type="password" value={form.pin} onChange={(value) => setField("pin", value.replace(/\D/g, "").slice(0, 6))} error={errors.pin} placeholder="Create a PIN" />
                        <Field label="Confirm PIN" type="password" value={form.confirmPin} onChange={(value) => setField("confirmPin", value.replace(/\D/g, "").slice(0, 6))} error={errors.confirmPin} placeholder="Repeat your PIN" />
                    </div>
                    {serverError && <p className="registration-error" role="alert"><Icon name="alert" /> {serverError}</p>}
                    <Button type="submit" variant="glass" full disabled={submitting}>{submitting ? "Creating account..." : "Create account"} <Icon name="arrow-right" /></Button>
                </form>
                <p className="registration-footer">Already registered? <Link to="/login">Sign in</Link></p>
            </section>
        </main>
    );
}

function Field({ label, value, onChange, error, type = "text", placeholder }) {
    return <label className="registration-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{error && <small>{error}</small>}</label>;
}
