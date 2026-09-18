import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import AuditLog from "./pages/AuditLog/AuditLog";
import PatientRecords from "./pages/PatientRecords/PatientRecords";
import StaffRoles from "./pages/StaffRoles/StaffRoles";
import ScopeDenied from "./pages/ScopeDenied/ScopeDenied";
import PatientWorklist from "./pages/PatientWorklist/PatientWorklist";
import AuditEventDetail from "./pages/AuditEventDetail/AuditEventDetail";
import EmergencyLogin, { EmergencyPatientAccess } from "./pages/EmergencyLogin/EmergencyLogin";
import Profile from "./pages/Profile/Profile";
import Registration from "./pages/Registration/Registration";
import { BreakGlass, EmergencySummary, Passport, PassportQR, Scan, PassportConsent, AuditQueue, AuditVerify, AdminRoster, AdminTOTP } from "./pages/AdditionalPages";
import MyPatients from "./pages/MyPatients/MyPatients";
import MyAccess from "./pages/MyAccess/MyAccess";
import { useAuth } from "./context/useAuth";
import { hasPermission, isAdministrator } from "./services/api/roleService";
import "./App.css";

function NotFound() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      gap: "16px",
      fontFamily: "var(--font-sans)",
      color: "var(--color-text-2)",
    }}>
      <span style={{ fontSize: 64, fontWeight: 800, color: "var(--color-text-3)" }}>404</span>
      <p>Page not found.</p>
      <a href="/dashboard" style={{ color: "var(--color-action)" }}>Go to Dashboard</a>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function PermissionRoute({ permission, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(user, permission)) {
    return <Navigate to={isAdministrator(user) ? "/dashboard" : "/my-patients"} replace />;
  }

  return children;
}

function EmergencyRoute({ children, activeOnly = false }) {
  const { isAuthenticated, hasEmergencyAccess, hasActiveEmergencyAccess } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasEmergencyAccess || (activeOnly && !hasActiveEmergencyAccess)) {
    return <Navigate to="/emergency-login" replace />;
  }

  return children;
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/register/staff" element={<Registration initialType="staff" />} />
      <Route path="/register/admin" element={<Registration initialType="admin" />} />
      <Route path="/emergency-login" element={<EmergencyLogin />} />
      <Route path="/emergency/search" element={<EmergencyRoute><EmergencyLogin step="patient" /></EmergencyRoute>} />
      <Route path="/emergency/reason" element={<EmergencyRoute><EmergencyLogin step="reason" /></EmergencyRoute>} />
      <Route path="/emergency/patients/:patientId" element={<EmergencyRoute activeOnly><EmergencyPatientAccess /></EmergencyRoute>} />

      {/* Clinical staff views */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/my-patients" element={<ProtectedRoute><PermissionRoute permission="view_my_patients"><MyPatients /></PermissionRoute></ProtectedRoute>} />
      <Route path="/my-access" element={<ProtectedRoute><PermissionRoute permission="view_own_access"><MyAccess /></PermissionRoute></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute><PermissionRoute permission="view_patients"><PatientWorklist /></PermissionRoute></ProtectedRoute>} />
      <Route path="/patients/:patientId" element={<ProtectedRoute><PermissionRoute permission="view_patients"><PatientRecords /></PermissionRoute></ProtectedRoute>} />
      <Route path="/patient-records" element={<Navigate to="/patients" replace />} />
      <Route path="/patients/:patientId/denied" element={<ProtectedRoute><PermissionRoute permission="view_patients"><ScopeDenied /></PermissionRoute></ProtectedRoute>} />
      <Route path="/patients/:patientId/breakglass" element={<ProtectedRoute><PermissionRoute permission="view_patients"><BreakGlass /></PermissionRoute></ProtectedRoute>} />
      <Route path="/patients/:patientId/emergency-summary" element={<ProtectedRoute><EmergencySummary /></ProtectedRoute>} />

      {/* Audit */}
      <Route path="/audit-log" element={<ProtectedRoute><PermissionRoute permission="view_audit_logs"><AuditLog /></PermissionRoute></ProtectedRoute>} />
      <Route path="/audit/queue" element={<ProtectedRoute><PermissionRoute permission="view_security_alerts"><AuditQueue /></PermissionRoute></ProtectedRoute>} />
      <Route path="/audit/verify" element={<ProtectedRoute><PermissionRoute permission="view_audit_logs"><AuditVerify /></PermissionRoute></ProtectedRoute>} />
      <Route path="/audit/events/:id" element={<ProtectedRoute><PermissionRoute permission="view_audit_logs"><AuditEventDetail /></PermissionRoute></ProtectedRoute>} />
      <Route path="/audit-logs" element={<Navigate to="/audit-log" replace />} />
      <Route path="/security" element={<Navigate to="/audit/queue" replace />} />

      {/* Admin */}
      <Route path="/staff-roles" element={<ProtectedRoute><PermissionRoute permission="manage_roles"><StaffRoles /></PermissionRoute></ProtectedRoute>} />
      <Route path="/assignments" element={<ProtectedRoute><PermissionRoute permission="manage_assignments"><StaffRoles /></PermissionRoute></ProtectedRoute>} />
      <Route path="/admin/roster" element={<ProtectedRoute><PermissionRoute permission="assign_roles"><AdminRoster /></PermissionRoute></ProtectedRoute>} />
      <Route path="/staff" element={<Navigate to="/staff-roles" replace />} />
      <Route path="/roles" element={<Navigate to="/staff-roles" replace />} />
      <Route path="/permissions" element={<Navigate to="/staff-roles" replace />} />
      <Route path="/emergency-access" element={<Navigate to="/admin/roster" replace />} />
      <Route path="/admin-settings" element={<Navigate to="/admin/totp" replace />} />
      <Route path="/admin/totp" element={<ProtectedRoute><AdminTOTP /></ProtectedRoute>} />

      {/* Patient passport (PWA) */}
      <Route path="/passport" element={<ProtectedRoute><Passport /></ProtectedRoute>} />
      <Route path="/passport/qr" element={<ProtectedRoute><PassportQR /></ProtectedRoute>} />
      <Route path="/passport/consent" element={<ProtectedRoute><PassportConsent /></ProtectedRoute>} />

      {/* Clinician scan */}
      <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
