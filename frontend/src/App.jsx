import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import { DashboardLayout } from './components/layout';

// Auth Components
import { ProtectedRoute } from './components/auth';

// Auth Pages
import { Login, ForgotPassword, ResetPassword } from './pages/auth';

// Employee Pages
import {
  EmployeeDashboard,
  TimeClock,
  Schedule,
  TimeRecords,
  LeaveRequests,
  Support,
  Profile
} from './pages/employee';

// Client Pages
import {
  ClientDashboard,
  Workforce,
  Approvals,
  ClientAnalytics,
  ClientTimeRecords,
  Billing,
  ClientSettings,
  ClientProfile
} from './pages/client';

// Admin Pages
import {
  AdminDashboard,
  Employees,
  Clients,
  ClientDetail,
  AdminAnalytics,
  AdminTimeRecords,
  AdminApprovals,
  Payroll,
  AdminSettings
} from './pages/admin';

// Employee Layout Wrapper with Auth
const EmployeeLayout = () => {
  const { user, logout } = useAuth();

  const displayUser = {
    name: user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email || 'Employee',
    email: user?.email || '',
    role: 'Employee',
    avatar: user?.employee?.profilePhoto || null
  };

  return (
    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
      <DashboardLayout
        portalType="employee"
        user={displayUser}
        onLogout={logout}
      />
    </ProtectedRoute>
  );
};

// Client Layout Wrapper with Auth
const ClientLayout = () => {
  const { user, logout } = useAuth();

  const displayUser = {
    name: user?.client?.companyName || user?.email || 'Client',
    email: user?.email || '',
    role: 'Client Admin',
    avatar: user?.client?.logoUrl || null
  };

  return (
    <ProtectedRoute allowedRoles={['CLIENT']}>
      <DashboardLayout
        portalType="client"
        user={displayUser}
        onLogout={logout}
      />
    </ProtectedRoute>
  );
};

// Admin Layout Wrapper with Auth
const AdminLayout = () => {
  const { user, logout } = useAuth();

  const displayUser = {
    name: user?.admin ? `${user.admin.firstName} ${user.admin.lastName}` : user?.email || 'Admin',
    email: user?.email || '',
    role: user?.role || 'Admin'
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT']}>
      <DashboardLayout
        portalType="admin"
        user={displayUser}
        onLogout={logout}
      />
    </ProtectedRoute>
  );
};

// App Routes Component (needs to be inside Router for useAuth)
const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Employee Portal Routes */}
      <Route path="/employee" element={<EmployeeLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="time-clock" element={<TimeClock />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="time-records" element={<TimeRecords />} />
        <Route path="leave" element={<LeaveRequests />} />
        <Route path="support" element={<Support />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Client Portal Routes */}
      <Route path="/client" element={<ClientLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ClientDashboard />} />
        <Route path="workforce" element={<Workforce />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="analytics" element={<ClientAnalytics />} />
        <Route path="time-records" element={<ClientTimeRecords />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<ClientSettings />} />
        <Route path="profile" element={<ClientProfile />} />
      </Route>

      {/* Admin Portal Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="time-records" element={<AdminTimeRecords />} />
        <Route path="approvals" element={<AdminApprovals />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="reports" element={<AdminAnalytics />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
