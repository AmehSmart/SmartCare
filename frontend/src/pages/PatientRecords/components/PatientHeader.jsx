import Avatar from "../../../components/ui/Avatar";
import Pill from "../../../components/ui/Pill";

export default function PatientHeader({ patient }) {
    return (
        <div className="pr-header">
            <Avatar initials={patient.initials} size="lg" />
            <div className="pr-header__info">
                <div className="pr-header__name-row">
                    <strong>{patient.name}</strong>
                    <Pill tone="blue">{patient.tag}</Pill>
                </div>
                <small>
                    {patient.gender} · Age {patient.age}
                </small>
                <small className="pr-header__admitted">
                    Admitted {patient.admitted}
                </small>
            </div>
            <span className="pr-header__code">{patient.code}</span>
        </div>
    );
}