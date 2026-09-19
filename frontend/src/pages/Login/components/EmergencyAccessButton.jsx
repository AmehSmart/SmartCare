import Icon from "../../../components/ui/Icon";

export default function EmergencyAccessButton({ onClick }) {
    return (
        <button type="button" className="emergency-btn" onClick={onClick}>
            <Icon name="alert" />
            Emergency Access
        </button>
    );
}