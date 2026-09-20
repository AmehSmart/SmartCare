import { useCallback, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { loginStaff } from "../services/api/authApi";
import { clearAccessToken, getAccessToken } from "../services/api/httpClient";

const USER_KEY = "smartcare-user";

// Rehydrate the signed-in user on reload. The bearer token is already persisted
// in sessionStorage (httpClient); persisting the profile alongside it keeps the
// user logged in across a page refresh instead of bouncing them to /login.
function loadPersistedUser() {
    try {
        if (!getAccessToken()) return null;
        const raw = sessionStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function persistUser(user) {
    try {
        if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        else sessionStorage.removeItem(USER_KEY);
    } catch {
        // sessionStorage may be unavailable; in-memory state still works.
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(loadPersistedUser);
    const [emergencySession, setEmergencySession] = useState(null);

    const login = useCallback(async (credentials) => {
        const profile = await loginStaff(credentials);
        setUser(profile);
        persistUser(profile);
        return profile;
    }, []);

    const logout = useCallback(() => {
        clearAccessToken();
        persistUser(null);
        setUser(null);
        setEmergencySession(null);
    }, []);

    const startEmergencySession = useCallback((session) => {
        setEmergencySession({ ...session, previousUser: user });
        setUser(session.user);
    }, [user]);

    const updateEmergencySession = useCallback((updates) => {
        setEmergencySession((current) => current ? { ...current, ...updates } : current);
    }, []);

    const updateUser = useCallback((updates) => {
        setUser((current) => {
            if (!current) return current;
            const next = { ...current, ...updates };
            persistUser(next);
            return next;
        });
    }, []);

    const endEmergencySession = useCallback(() => {
        setUser(emergencySession?.previousUser ?? null);
        setEmergencySession(null);
    }, [emergencySession]);

    const value = useMemo(
        () => ({
            user,
            isAuthenticated: Boolean(user),
            emergencySession,
            hasEmergencyAccess: Boolean(["authenticated", "active"].includes(emergencySession?.status)),
            hasActiveEmergencyAccess: Boolean(emergencySession?.status === "active"),
            login,
            logout,
            startEmergencySession,
            updateEmergencySession,
            updateUser,
            endEmergencySession,
        }),
        [user, emergencySession, login, logout, startEmergencySession, updateEmergencySession, updateUser, endEmergencySession]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
