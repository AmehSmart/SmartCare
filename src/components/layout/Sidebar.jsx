import { NavLink, useNavigate } from "react-router-dom";
import "./Sidebar.css";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { hasPermission } from "../../services/api/roleService";

const ROUTE_MAP = {
    dashboard: "/dashboard",
    "my-patients": "/my-patients",
    records: "/patients",
    "my-access": "/my-access",
    audit: "/audit-log",
    "audit-queue": "/audit/queue",
    staff: "/staff-roles",
    roster: "/admin/roster",
    totp: "/admin/totp",
};

export default function Sidebar({ navItems, user }) {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const { logout, user: authenticatedUser } = useAuth();
    const displayUser = authenticatedUser || user;

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setCollapsed(true);
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, []);

    const handleSignOut = () => {
        logout();
        navigate("/login", { replace: true });
    };

    return (
        <>
            {collapsed && (
                <button
                    type="button"
                    className="sidebar-mobile-trigger"
                    onClick={() => setCollapsed(false)}
                    aria-label="Open sidebar"
                >
                    <Icon name="menu" />
                </button>
            )}
            {/* Mobile overlay */}
            {!collapsed && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setCollapsed(true)}
                    aria-label="Close navigation menu"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setCollapsed(true);
                        }
                    }}
                />
            )}

            <aside className={`dash-sidebar${collapsed ? " dash-sidebar--collapsed" : ""}`}>
                <div className="dash-brand">
                    <span className="dash-brand__icon">
                        <Icon name="shield" />
                    </span>
                    <span className="dash-brand__name">SmartCare</span>
                    <button
                        className="dash-brand__toggle"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <Icon name={collapsed ? "chevron" : "chevron-left"} />
                    </button>
                </div>

                <nav className="dash-nav" aria-label="Main navigation">
                    {navItems
                        .filter((item) => item.key !== "my-patients" || displayUser?.role !== "Administrator")
                        .filter((item) => !item.permission || hasPermission(displayUser, item.permission))
                        .map((item) => {
                            const to = ROUTE_MAP[item.key];
                            if (!to) return null;
                            return (
                                <NavLink
                                    key={item.key}
                                    to={to}
                                    className={({ isActive }) =>
                                        `dash-nav__item${isActive ? " dash-nav__item--active" : ""}`
                                    }
                                    title={item.label}
                                >
                                    <Icon name={item.icon} />
                                    <span className="dash-nav__label">{item.label}</span>
                                </NavLink>
                            );
                        })}
                </nav>

                <div className="dash-sidebar__footer">
                    <button type="button" className="dash-sidebar__user" onClick={() => navigate("/profile")} aria-label="Open profile">
                        <Avatar initials={displayUser.initials} size="sm" />
                        <div className="dash-sidebar__user-info">
                            <strong>{displayUser.shortName}</strong>
                            <small>{displayUser.id}</small>
                        </div>
                    </button>
                    <button
                        className="dash-signout"
                        onClick={handleSignOut}
                        aria-label="Sign out"
                    >
                        <Icon name="logout" />
                        <span className="dash-nav__label">Sign out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}