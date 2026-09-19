import Icon from "../../../components/ui/Icon";

export default function ChainBreakBanner({ onViewAffected }) {
    return (
        <div className="al-chain-banner">
            <Icon name="alert" />
            <span>
                1 chain break detected in audit log - possible tampering.{" "}
                <button className="al-chain-banner__link" onClick={onViewAffected}>
                    View affected entries
                </button>
            </span>
        </div>
    );
}