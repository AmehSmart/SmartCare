import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import BrandPanel from "./components/BrandPanel";
import LoginForm from "./components/LoginForm";
import DemoCredentials from "./components/DemoCredentials";
import EmergencyAccessButton from "./components/EmergencyAccessButton";
import { useAuth } from "../../context/useAuth";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (credentials) => {
        setSubmitting(true);
        setError("");

        try {
            await login(credentials);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Unable to sign in.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <BrandPanel />

            <main className="login-form-side">
                <div className="login-form-wrap">
                    <h2>Sign in to your account</h2>
                    <p className="login-form-sub">
                        Enter your staff credentials to access the portal.
                    </p>

                    <LoginForm onSubmit={handleSubmit} submitting={submitting} error={error} />
                    <DemoCredentials />
                    <button type="button" className="login-register-link" onClick={() => navigate("/register")}>Register a staff account</button>
                    <EmergencyAccessButton onClick={() => navigate("/emergency-login")} />
                </div>
            </main>
        </div>
    );
}