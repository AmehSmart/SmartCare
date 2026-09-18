import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Registration.css";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import { registerAdministrator, registerStaff } from "../../services/api/authApi";

const initialForm = { staffId: "", name: "", department: "", ward: "", pin: "", confirmPin: "" };
const adminInitialForm = { email: "", password: "", confirmPassword: "", invitationCode: "" };
const STAFF_ID_PATTERN = /^[A-Z]{2,4}\d{3,5}$/i;

export default function Registration({ initialType = "selection" }) {
    const navigate = useNavigate();

    if (initialType === "selection") {
        return <AccountTypeSelection onChoose={(type) => navigate(type === "staff" ? "/register/staff" : "/register/admin")} />;
    }

    if (initialType === "staff") {
        return <StaffRegistration />;
    }

    return <AdminRegistration />;
}

function AccountTypeSelection({ onChoose }) {
    return (
        <main className="registration-page">
            <div className="registration-topline" />
            <section className="registration-card registration-selection">
                <div className="registration-brand-icon"><Icon name="shield" /></div>
                <p className="registration-eyebrow">SmartCare access</p>
                <h1>Create your SmartCare account</h1>
                <p className="registration-selection__intro">Choose the account type that applies to you.</p>

                <div className="registration-choice-grid">
                    <button type="button" className="registration-choice" onClick={() => onChoose("staff")}>
                        <span className="registration-choice__badge">Hospital Staff</span>
                        <strong>Continue as Staff</strong>
                        <small>For doctors, nurses, laboratory staff, pharmacy staff, records staff and other authorized healthcare personnel.</small>
                    </button>

                    <button type="button" className="registration-choice registration-choice--admin" onClick={() => onChoose("admin")}>
                        <span className="registration-choice__badge registration-choice__badge--admin">Administrator</span>
                        <strong>Continue as Administrator</strong>
                        <small>For authorized personnel responsible for staff management, access control, security and system administration.</small>
                    </button>
                </div>

                <p className="registration-footer registration-footer--centered">Already have an account? <Link to="/login">Sign in</Link></p>
            </section>
        </main>
    );
}

function StaffRegistration() {
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [showConfirmPin, setShowConfirmPin] = useState(false);

    const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const validate = () => {
        const nextErrors = {};
        const staffId = form.staffId.trim();
        const name = form.name.trim();
        const department = form.department.trim();
        const ward = form.ward.trim();

        if (!staffId) {
            nextErrors.staffId = "Staff ID is required.";
        } else if (!STAFF_ID_PATTERN.test(staffId)) {
            nextErrors.staffId = "Use a valid staff ID such as AD001 or N8002.";
        }

        if (!name) nextErrors.name = "Full name is required.";
        if (!department) nextErrors.department = "Department is required.";
        if (!ward) nextErrors.ward = "Ward or unit is required.";
        if (!/^\d{6}$/.test(form.pin)) nextErrors.pin = "Set a 6-digit PIN.";
        if (!form.confirmPin) nextErrors.confirmPin = "Please confirm your PIN.";
        else if (form.pin !== form.confirmPin) nextErrors.confirmPin = "PINs do not match.";

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
            await registerStaff({
                staffId: form.staffId,
                name: form.name,
                department: form.department,
                ward: form.ward,
                pin: form.pin,
            });
            setSuccess(true);
        } catch (error) {
            setServerError(error.message || "Unable to create your account.");
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <main className="registration-page">
                <div className="registration-topline" />
                <section className="registration-card registration-success">
                    <div className="registration-success-icon"><Icon name="check" /></div>
                    <p className="registration-eyebrow">Account request submitted</p>
                    <h1>Account pending approval</h1>
                    <p>Your SmartCare staff account has been created and is awaiting administrator review. Once approved, you can sign in and access the portal with your assigned clinical scope.</p>
                    <Button onClick={() => navigate("/login", { replace: true })}>Return to sign in <Icon name="arrow-right" /></Button>
                </section>
            </main>
        );
    }

    return (
        <main className="registration-page">
            <div className="registration-topline" />
            <section className="registration-card">
                <Link className="registration-back" to="/register"><Icon name="chevron-left" /> Back to account type</Link>

                <div className="registration-heading">
                    <div className="registration-brand-icon"><Icon name="shield" /></div>
                    <p className="registration-eyebrow">Hospital staff</p>
                    <h1>Register your account</h1>
                    <p>Request access to the secure clinical portal. Final role assignment remains under administrator review.</p>
                </div>

                <div className="registration-notice">
                    <Icon name="lock" />
                    <span>New staff accounts are created as pending access and are reviewed before they receive full operational privileges.</span>
                </div>

                <form onSubmit={submit} noValidate>
                    <div className="registration-sections">
                        <section className="registration-section">
                            <div className="registration-section__header"><h2>Account information</h2></div>
                            <div className="registration-grid">
                                <Field label="Full name" value={form.name} onChange={(value) => setField("name", value)} error={errors.name} placeholder="Your full name" autoComplete="name" />
                                <Field label="Staff ID" value={form.staffId} onChange={(value) => setField("staffId", value.toUpperCase())} error={errors.staffId} placeholder="e.g. N8002" autoComplete="off" />
                            </div>
                        </section>

                        <section className="registration-section">
                            <div className="registration-section__header"><h2>Professional information</h2></div>
                            <div className="registration-grid">
                                <Field label="Department" value={form.department} onChange={(value) => setField("department", value)} error={errors.department} placeholder="e.g. Internal Medicine" autoComplete="organization" />
                                <Field label="Ward or unit" value={form.ward} onChange={(value) => setField("ward", value)} error={errors.ward} placeholder="e.g. Ward B" autoComplete="street-address" />
                            </div>
                        </section>

                        <section className="registration-section">
                            <div className="registration-section__header"><h2>Account security</h2></div>
                            <div className="registration-grid">
                                <Field label="6-digit PIN" type={showPin ? "text" : "password"} value={form.pin} onChange={(value) => setField("pin", value.replace(/\D/g, "").slice(0, 6))} error={errors.pin} placeholder="Create a PIN" autoComplete="new-password" showToggle isVisible={showPin} onToggle={() => setShowPin((current) => !current)} />
                                <Field label="Confirm PIN" type={showConfirmPin ? "text" : "password"} value={form.confirmPin} onChange={(value) => setField("confirmPin", value.replace(/\D/g, "").slice(0, 6))} error={errors.confirmPin} placeholder="Repeat your PIN" autoComplete="new-password" showToggle isVisible={showConfirmPin} onToggle={() => setShowConfirmPin((current) => !current)} />
                            </div>
                            <p className="registration-requirement">PIN requirements: 6 digits only, confirmed before submission.</p>
                        </section>
                    </div>

                    {serverError && <p className="registration-error" role="alert"><Icon name="alert" /> {serverError}</p>}

                    <Button type="submit" variant="glass" full disabled={submitting}>
                        {submitting ? "Creating account..." : "Create account"}
                        <Icon name="arrow-right" />
                    </Button>
                </form>

                <p className="registration-footer">Already registered? <Link to="/login">Sign in</Link></p>
            </section>
        </main>
    );
}

function AdminRegistration() {
    const navigate = useNavigate();
    const [form, setForm] = useState(adminInitialForm);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const validate = () => {
        const nextErrors = {};
        const email = form.email.trim();

        if (!email) nextErrors.email = "Email is required.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Enter a valid email address.";

        if (!form.password) nextErrors.password = "Password is required.";
        else if (form.password.length < 8) nextErrors.password = "Use at least 8 characters.";

        if (!form.confirmPassword) nextErrors.confirmPassword = "Please confirm your password.";
        else if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";

        if (!form.invitationCode.trim()) nextErrors.invitationCode = "An administrator invitation code is required.";

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
            await registerAdministrator({
                email: form.email,
                password: form.password,
                invitationCode: form.invitationCode,
            });
            setSuccess(true);
        } catch (error) {
            setServerError(error.message || "Unable to complete administrator registration.");
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <main className="registration-page">
                <div className="registration-topline" />
                <section className="registration-card registration-success">
                    <div className="registration-success-icon"><Icon name="check" /></div>
                    <p className="registration-eyebrow">Admin registration pending</p>
                    <h1>Administrator access is restricted</h1>
                    <p>Your request has been submitted for backend authorization. Administrator accounts are only created through the authorized SmartCare approval process.</p>
                    <Button onClick={() => navigate("/login", { replace: true })}>Return to sign in <Icon name="arrow-right" /></Button>
                </section>
            </main>
        );
    }

    return (
        <main className="registration-page">
            <div className="registration-topline" />
            <section className="registration-card">
                <Link className="registration-back" to="/register"><Icon name="chevron-left" /> Back to account type</Link>

                <div className="registration-heading">
                    <div className="registration-brand-icon"><Icon name="shield" /></div>
                    <p className="registration-eyebrow">Administrator registration</p>
                    <h1>Restricted administrator access</h1>
                    <p>Administrator accounts are restricted to authorized SmartCare personnel and require backend validation.</p>
                </div>

                <div className="registration-notice">
                    <Icon name="lock" />
                    <span>Frontend role selection is never treated as proof of administrative authority. Only an authorized backend process can create an administrator account.</span>
                </div>

                <form onSubmit={submit} noValidate>
                    <div className="registration-sections">
                        <section className="registration-section">
                            <div className="registration-section__header"><h2>Administrator authorization</h2></div>
                            <div className="registration-grid registration-grid--stacked">
                                <Field label="Email" value={form.email} onChange={(value) => setField("email", value)} error={errors.email} placeholder="admin@smartcare.health" autoComplete="email" />
                                <Field label="Administrator invitation code" value={form.invitationCode} onChange={(value) => setField("invitationCode", value)} error={errors.invitationCode} placeholder="Enter your authorization code" autoComplete="off" />
                                <Field label="Password" type={showPassword ? "text" : "password"} value={form.password} onChange={(value) => setField("password", value)} error={errors.password} placeholder="Create a password" autoComplete="new-password" showToggle isVisible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
                                <Field label="Confirm password" type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={(value) => setField("confirmPassword", value)} error={errors.confirmPassword} placeholder="Repeat your password" autoComplete="new-password" showToggle isVisible={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} />
                            </div>
                        </section>
                    </div>

                    {serverError && <p className="registration-error" role="alert"><Icon name="alert" /> {serverError}</p>}

                    <Button type="submit" variant="glass" full disabled={submitting}>
                        {submitting ? "Submitting request..." : "Create administrator account"}
                        <Icon name="arrow-right" />
                    </Button>
                </form>

                <p className="registration-footer">Already have an account? <Link to="/login">Sign in</Link></p>
            </section>
        </main>
    );
}

function Field({ label, value, onChange, error, type = "text", placeholder, autoComplete = "off", showToggle = false, isVisible = false, onToggle }) {
    return (
        <label className="registration-field">
            <span>{label}</span>
            <div className="registration-input-wrap">
                <input
                    type={type}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${label}-error` : undefined}
                />
                {showToggle && (
                    <button type="button" className="registration-toggle" onClick={onToggle} aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}>
                        <Icon name={isVisible ? "eye-off" : "eye"} />
                    </button>
                )}
            </div>
            {error && <small id={`${label}-error`}>{error}</small>}
        </label>
    );
}
