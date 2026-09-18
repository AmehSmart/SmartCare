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
import { useAuth } from "./context/useAuth";
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
      <Route path="/emergency-login" element={<EmergencyLogin />} />
      <Route path="/emergency/search" element={<EmergencyRoute><EmergencyLogin step="patient" /></EmergencyRoute>} />
      <Route path="/emergency/reason" element={<EmergencyRoute><EmergencyLogin step="reason" /></EmergencyRoute>} />
      <Route path="/emergency/patients/:patientId" element={<EmergencyRoute activeOnly><EmergencyPatientAccess /></EmergencyRoute>} />

      {/* Clinical staff views */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute><PatientWorklist /></ProtectedRoute>} />
      <Route path="/patients/:patientId" element={<ProtectedRoute><PatientRecords /></ProtectedRoute>} />
      <Route path="/patient-records" element={<Navigate to="/patients" replace />} />
      <Route path="/patients/:patientId/denied" element={<ProtectedRoute><ScopeDenied /></ProtectedRoute>} />
      <Route path="/patients/:patientId/breakglass" element={<ProtectedRoute><BreakGlass /></ProtectedRoute>} />
      <Route path="/patients/:patientId/emergency-summary" element={<ProtectedRoute><EmergencySummary /></ProtectedRoute>} />

      {/* Audit */}
      <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/audit/queue" element={<ProtectedRoute><AuditQueue /></ProtectedRoute>} />
      <Route path="/audit/verify" element={<ProtectedRoute><AuditVerify /></ProtectedRoute>} />
      <Route path="/audit/events/:id" element={<ProtectedRoute><AuditEventDetail /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/staff-roles" element={<ProtectedRoute><StaffRoles /></ProtectedRoute>} />
      <Route path="/admin/roster" element={<ProtectedRoute><AdminRoster /></ProtectedRoute>} />
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
