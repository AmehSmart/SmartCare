import "./Topbar.css";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";

export default function Topbar({ initials, onSearch }) {
    const navigate = useNavigate();

    return (
        <header className="dash-topbar">
            <div className="dash-search">
                <Icon name="search" />
                <input
                    type="text"
                    aria-label="Search patients and records"
                    placeholder="Search patients, records..."
                    onChange={(e) => onSearch?.(e.target.value)}
                />
            </div>
            <div className="dash-topbar__right">
                <button type="button" className="icon-btn" onClick={() => navigate("/audit/queue")} aria-label="Open audit queue">
                    <Icon name="bell" />
                    <span className="icon-btn__dot" />
                </button>
                <Avatar initials={initials} />
            </div>
        </header>
    );
}