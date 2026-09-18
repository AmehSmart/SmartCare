import Icon from "../../../components/ui/Icon";
import Pill from "../../../components/ui/Pill";

export default function OverviewTab({ patient }) {
    const fieldAccess = patient?.fieldAccess || {};

    return (
        <div className="pr-panel-body">
            <section className="pr-section">
                <h3>
                    <Icon name="id-card" /> Demographics
                </h3>
                {fieldAccess.demographics ? (
                    <div className="pr-grid">
                        <div>
                            <span className="pr-field-label">FULL NAME</span>
                            <span className="pr-field-value">{patient.name}</span>
                        </div>
                        <div>
                            <span className="pr-field-label">GENDER</span>
                            <span className="pr-field-value">{patient.gender}</span>
                        </div>
                        <div>
                            <span className="pr-field-label">AGE</span>
                            <span className="pr-field-value">{patient.age} years</span>
                        </div>
                        <div>
                            <span className="pr-field-label">DATE OF BIRTH</span>
                            <span className="pr-field-value">{patient.dob}</span>
                        </div>
                        <div>
                            <span className="pr-field-label">ADDRESS</span>
                            <span className="pr-field-value">{patient.address}</span>
                        </div>
                        <div>
                            <span className="pr-field-label">PHONE</span>
                            <span className="pr-field-value">{patient.phone}</span>
                        </div>
                    </div>
                ) : (
                    <div className="pr-restricted-banner">
                        <Icon name="lock" />
                        Demographics are restricted for your current role.
                    </div>
                )}
            </section>

            <section className="pr-section">
                <h3>
                    <Icon name="heart" /> Vitals
                </h3>
                {fieldAccess.vitals ? (
                    <div className="pr-chip-row">
                        {patient.vitals.map((v) => (
                            <div className={`pr-chip pr-chip--${v.tone}`} key={v.label}>
                                <strong>
                                    {v.value}
                                    <small>{v.unit}</small>
                                </strong>
                                <span>{v.label}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="pr-restricted-banner">
                        <Icon name="lock" />
                        Vitals are not visible to your current access level.
                    </div>
                )}
            </section>

            <section className="pr-section">
                <h3>
                    <Icon name="alert" /> Allergies
                </h3>
                {fieldAccess.allergies ? (
                    <div className="pr-chip-row">
                        {patient.allergies.map((a) => (
                            <Pill tone="red" key={a}>
                                {a}
                            </Pill>
                        ))}
                    </div>
                ) : (
                    <div className="pr-restricted-banner">
                        <Icon name="lock" />
                        Allergy information is restricted for this role.
                    </div>
                )}
            </section>
        </div>
    );
}