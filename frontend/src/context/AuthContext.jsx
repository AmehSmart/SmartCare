import { useCallback, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { loginStaff } from "../services/api/authApi";
import { clearAccessToken } from "../services/api/httpClient";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [emergencySession, setEmergencySession] = useState(null);

    const login = useCallback(async (credentials) => {
        const profile = await loginStaff(credentials);
        setUser(profile);
        return profile;
    }, []);

    const logout = useCallback(() => {
        clearAccessToken();
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
        setUser((current) => current ? { ...current, ...updates } : current);
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
