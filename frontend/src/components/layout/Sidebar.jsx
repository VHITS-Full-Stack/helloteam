import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  FileText,
  MessageSquare,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  CreditCard,
  BarChart3,
  CheckSquare,
  Briefcase
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';

const Sidebar = ({
  portalType = 'employee',
  user,
  onLogout
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission, hasAnyPermission, loading: permissionsLoading } = usePermissions();

  const employeeLinks = [
    { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/employee/time-clock', icon: Clock, label: 'Time Clock' },
    { to: '/employee/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/employee/time-records', icon: FileText, label: 'Time Records' },
    { to: '/employee/leave', icon: Calendar, label: 'Leave Requests' },
    { to: '/employee/support', icon: MessageSquare, label: 'Support' },
    { to: '/employee/profile', icon: User, label: 'Profile' },
  ];

  const clientLinks = [
    { to: '/client/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/client/workforce', icon: Users, label: 'Workforce' },
    { to: '/client/approvals', icon: CheckSquare, label: 'Approvals' },
    { to: '/client/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/client/time-records', icon: Clock, label: 'Time Records' },
    { to: '/client/billing', icon: CreditCard, label: 'Billing' },
    { to: '/client/profile', icon: User, label: 'Profile' },
    { to: '/client/settings', icon: Settings, label: 'Settings' },
  ];

  // Admin links with permission requirements
  const adminLinksConfig = [
    {
      to: '/admin/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      permission: PERMISSIONS.DASHBOARD.VIEW
    },
    {
      to: '/admin/employees',
      icon: Users,
      label: 'Employees',
      permission: PERMISSIONS.EMPLOYEES.VIEW
    },
    {
      to: '/admin/clients',
      icon: Building2,
      label: 'Clients',
      permission: PERMISSIONS.CLIENTS.VIEW
    },
    {
      to: '/admin/analytics',
      icon: BarChart3,
      label: 'Analytics',
      permission: PERMISSIONS.REPORTS.VIEW
    },
    {
      to: '/admin/time-records',
      icon: Clock,
      label: 'Time Records',
      permission: PERMISSIONS.TIME_RECORDS.VIEW
    },
    {
      to: '/admin/approvals',
      icon: CheckSquare,
      label: 'Approvals',
      permission: PERMISSIONS.APPROVALS.VIEW
    },
    {
      to: '/admin/payroll',
      icon: Briefcase,
      label: 'Payroll',
      permission: PERMISSIONS.PAYROLL.VIEW
    },
    {
      to: '/admin/settings',
      icon: Settings,
      label: 'Settings',
      permission: PERMISSIONS.SETTINGS.VIEW
    },
    {
      to: '/admin/profile',
      icon: User,
      label: 'Profile',
      permission: null // All admins can access their profile
    },
  ];

  // Filter admin links based on permissions
  const adminLinks = useMemo(() => {
    if (permissionsLoading) {
      // Show all links while loading (will be filtered once permissions load)
      return adminLinksConfig;
    }
    return adminLinksConfig.filter(link => {
      // If no permission required, show the link
      if (!link.permission) return true;
      // Check if user has the required permission
      return hasPermission(link.permission);
    });
  }, [permissionsLoading, hasPermission]);

  const links = {
    employee: employeeLinks,
    client: clientLinks,
    admin: adminLinks,
  }[portalType];

  const portalConfig = {
    employee: {
      title: 'Employee Portal',
      subtitle: 'Your Workspace',
    },
    client: {
      title: 'Client Portal',
      subtitle: 'Workforce Management',
    },
    admin: {
      title: 'Admin Portal',
      subtitle: 'System Control',
    },
  };

  const config = portalConfig[portalType];

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen
        bg-gradient-to-b from-primary-900 via-primary-800 to-primary-700
        transition-all duration-300 z-40
        ${collapsed ? 'w-20' : 'w-64'}
      `}
      style={{ boxShadow: '4px 0 15px rgba(16, 42, 67, 0.3)' }}
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center justify-center px-4 border-b border-primary-600/30">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-lg">
              <img
                src="/logo.png"
                alt="Hello Team"
                className="h-10 w-auto"
              />
            </div>
            <div>
              <h1 className="font-bold text-white font-heading text-lg">Hello Team</h1>
              <p className="text-xs text-primary-300">{config.subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-2 rounded-xl shadow-lg">
            <img
              src="/logo.png"
              alt="Hello Team"
              className="h-8 w-auto"
            />
          </div>
        )}
      </div>

      {/* Portal Indicator with Orange Accent */}
      {!collapsed && (
        <div className="mx-4 mt-4 mb-2 px-4 py-3 rounded-xl bg-secondary/10 border-l-4 border-secondary">
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">
            {config.title}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-260px)] scrollbar-thin">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl
              transition-all duration-200 group
              ${isActive
                ? 'bg-secondary text-primary-900 shadow-lg font-semibold'
                : 'text-primary-200 hover:bg-primary-600/50 hover:text-white'
              }
              ${collapsed ? 'justify-center px-3' : ''}
            `}
            title={collapsed ? link.label : ''}
          >
            <link.icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
            {!collapsed && <span className="font-medium">{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Section & Collapse Button */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-primary-600/30 bg-primary-900/50 backdrop-blur-sm">
        {/* User Info */}
        <div className={`p-4 ${collapsed ? 'px-2' : ''}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            {user?.avatar ? (
              <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden ring-2 ring-secondary shadow-lg">
                <img
                  src={user.avatar}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary shadow-lg">
                <span className="font-bold text-primary-900">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-primary-300 truncate">
                  {user?.email || 'user@email.com'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Logout & Collapse */}
        <div className={`flex ${collapsed ? 'flex-col' : ''} border-t border-primary-600/30`}>
          <button
            onClick={onLogout}
            className={`
              flex items-center gap-2 p-3 text-primary-300 hover:text-white hover:bg-red-500/20
              transition-all duration-200 flex-1 group
              ${collapsed ? 'justify-center' : 'px-4'}
            `}
            title="Logout"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-3 text-primary-400 hover:text-secondary hover:bg-primary-600/30 transition-all duration-200 group"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
            ) : (
              <ChevronLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
