import Avatar from "../../../components/ui/Avatar";
import Pill from "../../../components/ui/Pill";

export default function ProfileCard({ doctor }) {
    return (
        <section className="profile-card">
            <h2>Your Profile</h2>
            <div className="profile-card__row">
                <Avatar initials={doctor.initials} size="lg" />
                <div className="profile-card__info">
                    <strong>{doctor.name}</strong>
                    <small>{doctor.id}</small>
                </div>
                <Pill tone="teal">{doctor.role}</Pill>
            </div>
            <div className="profile-card__divider" />
            <div className="profile-card__meta">
                <div>
                    <span className="meta-label">WARD</span>
                    <span className="meta-value">{doctor.ward}</span>
                </div>
                <div>
                    <span className="meta-label">ACCESS CODE</span>
                    <span className="meta-value meta-value--green">
                        {doctor.accessCode}
                    </span>
                </div>
                <div>
                    <span className="meta-label">FIELDS ACCESS</span>
                    <span className="meta-value">{doctor.fieldsAccess}</span>
                </div>
            </div>
        </section>
    );
}