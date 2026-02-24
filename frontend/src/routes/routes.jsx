import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// Context
import { useAuth } from '../context/AuthContext';
// Layout
import { DashboardLayout } from '../components/layout';
// Auth Components
import { ProtectedRoute } from '../components/auth';
// Auth Pages (lazy)
const Login = lazy(() => import('../pages/auth/Login'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
// Employee Pages (lazy)
const EmployeeDashboard = lazy(() => import('../pages/employee/Dashboard'));
const TimeClock = lazy(() => import('../pages/employee/TimeClock'));
const Schedule = lazy(() => import('../pages/employee/Schedule'));
const TimeRecords = lazy(() => import('../pages/employee/TimeRecords'));
const LeaveRequests = lazy(() => import('../pages/employee/Leave'));
const Support = lazy(() => import('../pages/employee/Support'));
const EmployeeTasks = lazy(() => import('../pages/employee/Tasks'));
const EmployeeChat = lazy(() => import('../pages/employee/Chat'));
const Profile = lazy(() => import('../pages/employee/Profile'));

// Employee Onboarding (lazy)
const EmployeeOnboarding = lazy(() => import('../pages/employee/Onboarding'));

// Client Pages (lazy)
const ClientOnboarding = lazy(() => import('../pages/client/Onboarding'));
const ClientDashboard = lazy(() => import('../pages/client/Dashboard'));
const ClientTasks = lazy(() => import('../pages/client/Tasks'));
const ClientChat = lazy(() => import('../pages/client/Chat'));
const Workforce = lazy(() => import('../pages/client/Workforce'));
const Approvals = lazy(() => import('../pages/client/Approvals'));
const ClientAnalytics = lazy(() => import('../pages/client/Analytics'));
const ClientTimeRecords = lazy(() => import('../pages/client/TimeRecords'));
const Billing = lazy(() => import('../pages/client/Billing'));
const ClientSettings = lazy(() => import('../pages/client/Settings'));
const ClientProfile = lazy(() => import('../pages/client/Profile'));
const ClientGroups = lazy(() => import('../pages/client/group/Groups'));

// Admin Pages (lazy)
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'));
const Employees = lazy(() => import('../pages/admin/employees/Employees'));
const AddEmployee = lazy(() => import('../pages/admin/employees/AddEditEmployee'));
const EmployeeDetail = lazy(() => import('../pages/admin/employees/EmployeeDetail'));
const Clients = lazy(() => import('../pages/admin/clients/Clients'));
const AddClient = lazy(() => import('../pages/admin/clients/AddEditClient'));
const ClientDetail = lazy(() => import('../pages/admin/clients/ClientDetail'));
const ClientEmployees = lazy(() => import('../pages/admin/clients/ClientEmployees'));
const ClientConnectedGroups = lazy(() => import('../pages/admin/clients/ClientConnectedGroups'));
const AdminAnalytics = lazy(() => import('../pages/admin/Analytics'));
const AdminTimeRecords = lazy(() => import('../pages/admin/TimeRecords'));
const AdminApprovals = lazy(() => import('../pages/admin/Approvals'));
const Payroll = lazy(() => import('../pages/admin/Payroll'));
const AdminInvoices = lazy(() => import('../pages/admin/invoices/Invoices'));
const AdminSettings = lazy(() => import('../pages/admin/Settings'));
const AdminProfile = lazy(() => import('../pages/admin/Profile'));
const TimeAdjustments = lazy(() => import('../pages/admin/TimeAdjustments'));
const AuditLog = lazy(() => import('../pages/admin/AuditLog'));
const LeavePolicy = lazy(() => import('../pages/admin/LeavePolicy'));
const ScheduleManagement = lazy(() => import('../pages/admin/ScheduleManagement'));
const Groups = lazy(() => import('../pages/admin/groups/Groups'));
const AdminTasks = lazy(() => import('../pages/admin/Tasks'));
const BillingHistory = lazy(() => import('../pages/admin/BillingHistory'));
const DocumentTypes = lazy(() => import('../pages/admin/DocumentTypes'));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
  </div>
);

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

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Employee Onboarding (standalone, no sidebar) */}
        <Route
          path="/employee/onboarding"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE']}>
              <EmployeeOnboarding />
            </ProtectedRoute>
          }
        />

        {/* Employee Portal Routes */}
        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="time-clock" element={<TimeClock />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="time-records" element={<TimeRecords />} />
          <Route path="leave" element={<LeaveRequests />} />
          <Route path="tasks" element={<EmployeeTasks />} />
          <Route path="chat" element={<EmployeeChat />} />
          <Route path="support" element={<Support />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Client Onboarding (standalone, no sidebar) */}
        <Route
          path="/client/onboarding"
          element={
            <ProtectedRoute allowedRoles={['CLIENT']}>
              <ClientOnboarding />
            </ProtectedRoute>
          }
        />

        {/* Client Portal Routes */}
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="workforce" element={<Workforce />} />
          <Route path="groups" element={<ClientGroups />} />
          <Route path="tasks" element={<ClientTasks />} />
          <Route path="chat" element={<ClientChat />} />
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
          <Route path="employees/add" element={<AddEmployee />} />
          <Route path="employees/:id/edit" element={<AddEmployee />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/add" element={<AddClient />} />
          <Route path="clients/:id/edit" element={<AddClient />} />
          <Route path="clients/:id/employees" element={<ClientEmployees />} />
          <Route path="clients/:id/groups" element={<ClientConnectedGroups />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="groups" element={<Groups />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="time-records" element={<AdminTimeRecords />} />
          <Route path="approvals" element={<AdminApprovals />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="billing-history" element={<BillingHistory />} />
          <Route path="reports" element={<AdminAnalytics />} />
          <Route path="time-adjustments" element={<TimeAdjustments />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="leave-policy" element={<LeavePolicy />} />
          <Route path="schedules" element={<ScheduleManagement />} />
          <Route path="document-types" element={<DocumentTypes />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
