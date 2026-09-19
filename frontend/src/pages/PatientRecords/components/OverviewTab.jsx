import Icon from "../../../components/ui/Icon";
import Pill from "../../../components/ui/Pill";

export default function OverviewTab({ patient, assignments = [], isAdmin = false, onAssign, onRemove }) {
    const fieldAccess = patient?.fieldAccess || {};
    const activeAssignment = assignments.find((assignment) => assignment.status !== "Removed") || null;

    return (
        <div className="pr-panel-body">
            <section className="pr-section">
                <div className="pr-status-row">
                    <h3>
                        <Icon name="heartbeat" /> Current status
                    </h3>
                    <Pill tone={patient?.status === "Active" ? "green" : "gray"}>{patient?.status || "Unknown"}</Pill>
                </div>
                {isAdmin && (
                    <div className="pr-assignment-box">
                        <div>
                            <span className="pr-assignment-label">Assigned care team</span>
                            {activeAssignment ? (
                                <>
                                    <strong>{activeAssignment.staffName}</strong>
                                    <small>{activeAssignment.assignmentType} · {activeAssignment.ward}</small>
                                </>
                            ) : (
                                <>
                                    <strong>No staff currently assigned</strong>
                                    <small>Use assignment controls to assign a clinician.</small>
                                </>
                            )}
                        </div>
                        <div className="pr-assignment-actions">
                            {activeAssignment && (
                                <button type="button" className="pr-assignment-button pr-assignment-button--secondary" onClick={onRemove}>Remove assignment</button>
                            )}
                            <button type="button" className="pr-assignment-button" onClick={onAssign}>{activeAssignment ? "Reassign staff" : "Assign staff"}</button>
                        </div>
                    </div>
                )}
            </section>

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