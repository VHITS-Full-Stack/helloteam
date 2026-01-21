import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import { DashboardLayout } from './components/layout';

// Auth Pages
import { Login } from './pages/auth';

// Employee Pages
import {
  EmployeeDashboard,
  TimeClock,
  Schedule,
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
  ClientSettings
} from './pages/client';

// Admin Pages
import {
  AdminDashboard,
  Employees,
  Clients,
  AdminAnalytics,
  AdminTimeRecords,
  AdminApprovals,
  Payroll,
  AdminSettings
} from './pages/admin';

// Employee Layout Wrapper
const EmployeeLayout = () => {
  const user = {
    name: 'John Doe',
    email: 'john.doe@email.com',
    role: 'Employee'
  };

  const handleLogout = () => {
    window.location.href = '/login';
  };

  return (
    <DashboardLayout
      portalType="employee"
      user={user}
      onLogout={handleLogout}
    />
  );
};

// Client Layout Wrapper
const ClientLayout = () => {
  const user = {
    name: 'ABC Corporation',
    email: 'admin@abccorp.com',
    role: 'Client Admin'
  };

  const handleLogout = () => {
    window.location.href = '/login';
  };

  return (
    <DashboardLayout
      portalType="client"
      user={user}
      onLogout={handleLogout}
    />
  );
};

// Admin Layout Wrapper
const AdminLayout = () => {
  const user = {
    name: 'Admin User',
    email: 'admin@helloteam.com',
    role: 'Super Admin'
  };

  const handleLogout = () => {
    window.location.href = '/login';
  };

  return (
    <DashboardLayout
      portalType="admin"
      user={user}
      onLogout={handleLogout}
    />
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />

        {/* Employee Portal Routes */}
        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="time-clock" element={<TimeClock />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="time-history" element={<TimeClock />} />
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
        </Route>

        {/* Admin Portal Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="clients" element={<Clients />} />
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
    </Router>
  );
}

export default App;
