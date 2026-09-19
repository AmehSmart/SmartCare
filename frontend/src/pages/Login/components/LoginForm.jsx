import { useState } from "react";
import Icon from "../../../components/ui/Icon";
import { isBackendEnabled } from "../../../services/api/config";

export default function LoginForm({ onSubmit, submitting = false, error: serverError = "" }) {
    const backendMode = isBackendEnabled();
    const [staffId, setStaffId] = useState("");
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!staffId.trim() || !pin.trim()) {
            setError(backendMode ? "Enter both your email and password." : "Enter both your Staff ID and PIN.");
            return;
        }
        setError("");
        onSubmit?.({ staffId: staffId.trim(), pin: pin.trim() });
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="staffId">
                {backendMode ? "Email" : "Staff ID"}
            </label>
            <input
                id="staffId"
                type={backendMode ? "email" : "text"}
                placeholder={backendMode ? "e.g. aisha@example.test" : "e.g. DR001"}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="field-input"
                autoComplete="username"
            />

            <label className="field-label" htmlFor="pin">
                Password
            </label>
            <div className="field-input-group">
                <input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    placeholder={backendMode ? "Enter your password" : "Enter your PIN"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="field-input"
                    autoComplete="current-password"
                />
                <button
                    type="button"
                    className="field-input-toggle"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                    <Icon name={showPin ? "eye-off" : "eye"} />
                </button>
            </div>

            {(error || serverError) && <p className="field-error">{error || serverError}</p>}

            <button type="submit" className="signin-btn" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
                <Icon name="arrow-right" />
            </button>
        </form>
    );
}