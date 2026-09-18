import { useNavigate, useParams } from "react-router-dom";
import "./ScopeDenied.css";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";

export default function ScopeDenied() {
    const navigate = useNavigate();
    const { id = "PT-2024-0561" } = useParams();

    return (
        <div className="sd-page">
            <div className="sd-card" role="main">
                <div className="sd-icon-wrap" aria-hidden="true">
                    <Icon name="lock" />
                </div>

                <h1>Access Denied</h1>

                <div className="sd-reason" role="alert" aria-live="polite">
                    <Icon name="alert" />
                    <span>
                        <strong>Out of scope.</strong> This patient is assigned to Ward B.
                        You are currently on duty in Ward A — Day Shift.
                        Your active role does not include cross-ward access.
                    </span>
                </div>

                <p className="sd-sub">
                    All access attempts are logged. If this is a clinical emergency,
                    you may request temporary override access using the Break-Glass protocol.
                    This action will notify your supervisor immediately.
                </p>

                <div className="sd-actions">
                    <Button
                        variant="breakglass"
                        full
                        onClick={() => navigate(`/patients/${id}/breakglass`)}
                    >
                        <Icon name="alert" />
                        Request Emergency Access (Break-Glass)
                    </Button>

                    <button className="sd-back" onClick={() => navigate(-1)}>
                        <Icon name="chevron-left" />
                        Return to Worklist
                    </button>
                </div>
            </div>
        </div>
    );
}
