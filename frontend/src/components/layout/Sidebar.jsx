import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Clock,
  Calendar,
  CalendarDays,
  FileText,
  MessageSquare,
  MessageCircle,
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
  Briefcase,
  FolderOpen,
  ClipboardList,
  TrendingUp,
  FileCheck,
  Wallet,
  Timer,
  Gift,
  ClipboardCheck,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../config/permissions";
import clientPortalService from "../../services/clientPortal.service";
import overtimeService from "../../services/overtime.service";
import adminPortalService from "../../services/adminPortal.service";

const Sidebar = ({ portalType = "employee", user, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingBonusRaiseCount, setPendingBonusRaiseCount] = useState(0);

  // Fetch pending approval counts for sidebar badge
  const fetchPendingCounts = useCallback(async () => {
    if (portalType === "client") {
      try {
        const [approvalsRes, otSummaryRes] = await Promise.all([
          clientPortalService.getApprovals({
            status: "pending",
            type: "leave",
          }),
          overtimeService.getOvertimeSummary({}),
        ]);
        let total = 0;
        if (approvalsRes.success) {
          total += approvalsRes.data?.summary?.pending || 0;
        }
        if (otSummaryRes.success) {
          total += otSummaryRes.data?.pending || 0;
        }
        setPendingApprovalCount(total);
      } catch (e) {
        console.error("Failed to fetch pending counts:", e);
      }
    } else if (portalType === "admin") {
      try {
        const res = await adminPortalService.getPendingActions();
        if (res.success && res.counts) {
          setPendingApprovalCount(
            (res.counts.pendingLeave || 0) + (res.counts.pendingOvertime || 0),
          );
        }
      } catch (e) {
        console.error("Failed to fetch admin pending counts:", e);
      }
      try {
        const raiseRes = await adminPortalService.getRaiseRequests({ status: "PENDING" });
        if (raiseRes.success) {
          setPendingBonusRaiseCount((raiseRes.data?.requests || []).length);
        }
      } catch (e) {
        console.error("Failed to fetch admin raise counts:", e);
      }
    }
  }, [portalType]);

  useEffect(() => {
    fetchPendingCounts();
    // Re-fetch when approvals are updated
    const handleUpdate = () => fetchPendingCounts();
    window.addEventListener("approvals-updated", handleUpdate);
    return () => window.removeEventListener("approvals-updated", handleUpdate);
  }, [fetchPendingCounts]);

  const employeeLinks = [
    { group: "Overview" },
    { to: "/employee/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { group: "Work" },
    { to: "/employee/schedule", icon: Calendar, label: "Schedule" },
    { to: "/employee/time-records", icon: FileText, label: "Time Records" },
    // { to: "/employee/overtime-requests", icon: Clock, label: "Overtime Requests" },
    { to: "/employee/leave", icon: Calendar, label: "Leave Requests" },
    { to: "/employee/tasks", icon: ClipboardList, label: "Tasks" },
    { group: "Finance" },
    { to: "/employee/payslips", icon: Wallet, label: "Payslips" },
    { group: "" },
    { to: "/employee/chat", icon: MessageCircle, label: "Chat" },
    { to: "/employee/support", icon: MessageSquare, label: "Support" },
    { to: "/employee/profile", icon: User, label: "Profile" },
  ];

  const clientLinks = [
    { group: "Overview" },
    { to: "/client/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/client/workforce", icon: Users, label: "Workforce" },
    { group: "Management" },
    { to: "/client/time-records", icon: Clock, label: "Time Records" },
    { to: "/client/add-overtime", icon: Timer, label: "Add Overtime" },
    { to: "/client/bonuses-raises", icon: Gift, label: "Bonuses & Raises" },
    {
      to: "/client/approvals",
      icon: CheckSquare,
      label: "Approvals",
      badge: pendingApprovalCount,
    },
    { group: "Billing" },
    { to: "/client/billing", icon: CreditCard, label: "Billing & Invoices" },
    { to: "/client/rate-history", icon: TrendingUp, label: "Rate History" },
    { group: "Team" },
    { to: "/client/chat", icon: MessageCircle, label: "Chat" },
    { to: "/client/tasks", icon: ClipboardList, label: "Tasks" },
    { to: "/client/support", icon: MessageSquare, label: "Support Tickets" },
    { group: "" },
    { to: "/client/profile", icon: User, label: "Profile" },
    { to: "/client/settings", icon: Settings, label: "Settings" },
  ];

  // Admin links with permission requirements
  const adminLinksConfig = [
    { group: "Operations" },
    {
      to: "/admin/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      permission: PERMISSIONS.DASHBOARD.VIEW,
    },
    {
      to: "/admin/employees",
      icon: Users,
      label: "Employees",
      permission: PERMISSIONS.EMPLOYEES.VIEW,
    },
    {
      to: "/admin/clients",
      icon: Building2,
      label: "Clients",
      permission: PERMISSIONS.CLIENTS.VIEW,
    },
    {
      to: "/admin/groups",
      icon: FolderOpen,
      label: "Groups",
      permission: PERMISSIONS.GROUPS.VIEW,
    },
    { group: "Management" },
    {
      to: "/admin/time-records",
      icon: Clock,
      label: "Time Records",
      permission: PERMISSIONS.TIME_RECORDS.VIEW,
    },
    {
      to: "/admin/schedules",
      icon: CalendarDays,
      label: "Schedules",
      permission: PERMISSIONS.SCHEDULES.VIEW,
    },
    {
      to: "/admin/approvals",
      icon: CheckSquare,
      label: "Approvals",
      permission: PERMISSIONS.APPROVALS.VIEW,
      badge: pendingApprovalCount,
    },
    {
      to: "/admin/raise-requests",
      icon: Gift,
      label: "Bonuses & Raises",
      permission: PERMISSIONS.APPROVALS.VIEW,
      badge: pendingBonusRaiseCount,
    },
    {
      to: "/admin/tasks",
      icon: ClipboardList,
      label: "Tasks",
      permission: PERMISSIONS.TASKS.VIEW,
    },
    {
      to: "/admin/support",
      icon: MessageSquare,
      label: "Support Tickets",
    },
    { group: "Billing & Payroll" },
    {
      to: "/admin/invoices",
      icon: FileText,
      label: "Billing & Invoices",
      permission: PERMISSIONS.PAYROLL.VIEW,
    },

    {
      to: "/admin/billing-history",
      icon: TrendingUp,
      label: "Billing History",
      permission: PERMISSIONS.EMPLOYEES.VIEW,
    },
    {
      to: "/admin/payroll",
      icon: Briefcase,
      label: "Payroll",
      permission: PERMISSIONS.PAYROLL.VIEW,
      end: true,
    },
    {
      to: "/admin/payroll/audit-logs",
      icon: ClipboardCheck,
      label: " Audit Logs",
      permission: PERMISSIONS.PAYROLL.VIEW,
    },
    { group: "Settings" },
    {
      to: "/admin/settings",
      icon: Settings,
      label: "Settings",
      permission: PERMISSIONS.SETTINGS.VIEW,
    },
    {
      to: "/admin/profile",
      icon: User,
      label: "Profile",
      permission: null,
    },
    {
      to: "/admin/document-types",
      icon: FileCheck,
      label: "Document Types",
      permission: PERMISSIONS.SETTINGS.EDIT,
    },
  ];

  // Filter admin links based on permissions
  const adminLinks = useMemo(() => {
    if (permissionsLoading) {
      // Show all links while loading (will be filtered once permissions load)
      return adminLinksConfig;
    }
    return adminLinksConfig.filter((link) => {
      // Always show group headers
      if (link.group !== undefined) return true;
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
      title: "Employee Portal",
      subtitle: "Your Workspace",
    },
    client: {
      title: "Client Portal",
      subtitle: "Workforce Management",
    },
    admin: {
      title: "Admin Portal",
      subtitle: "System Control",
    },
  };

  const config = portalConfig[portalType];

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen
        bg-gradient-to-b from-primary-900 via-primary-800 to-primary-700
        transition-all duration-300 z-40
        ${collapsed ? "w-20" : "w-64"}
      `}
      style={{ boxShadow: "4px 0 15px rgba(16, 42, 67, 0.3)" }}
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center justify-center px-4 border-b border-primary-600/30">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-lg">
              <img src="/logo.png" alt="Hello Team" className="h-10 w-auto" />
            </div>
            <div>
              <h1 className="font-bold text-white font-heading text-lg">
                Hello Team
              </h1>
              <p className="text-xs text-primary-300">{config.subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-2 rounded-xl shadow-lg">
            <img src="/logo.png" alt="Hello Team" className="h-8 w-auto" />
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
        {links.map((link, idx) =>
          link.group !== undefined ? (
            link.group && !collapsed ? (
              <div key={`group-${idx}`} className="pt-4 pb-1 px-4 first:pt-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400/70">
                  {link.group}
                </p>
              </div>
            ) : link.group && collapsed ? (
              <div
                key={`group-${idx}`}
                className="pt-3 pb-1 flex justify-center"
              >
                <div className="w-6 border-t border-primary-600/40" />
              </div>
            ) : (
              <div
                key={`group-${idx}`}
                className={collapsed ? "pt-2" : "pt-3"}
              />
            )
          ) : (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end || false}
              className={({ isActive }) => `
                relative flex items-center gap-3 px-4 py-3 rounded-xl
                transition-all duration-200 group
                ${
                  isActive
                    ? "bg-secondary text-primary-900 shadow-lg font-semibold"
                    : "text-primary-200 hover:bg-primary-600/50 hover:text-white"
                }
                ${collapsed ? "justify-center px-3" : ""}
              `}
              title={collapsed ? link.label : ""}
            >
              <link.icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && (
                <>
                  <span className="font-medium flex-1">{link.label}</span>
                  {link.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[20px] text-center">
                      {link.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && link.badge > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </NavLink>
          ),
        )}
      </nav>

      {/* User Section & Collapse Button */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-primary-600/30 bg-primary-900/50 backdrop-blur-sm">
        {/* User Info */}
        <div className={`p-4 ${collapsed ? "px-2" : ""}`}>
          <div
            className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
          >
            {user?.avatar ? (
              <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden ring-2 ring-secondary shadow-lg">
                <img
                  src={user.avatar}
                  alt={user?.name || "User"}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary shadow-lg">
                <span className="font-bold text-primary-900">
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-primary-300 truncate">
                  {user?.email || "user@email.com"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Logout & Collapse */}
        <div
          className={`flex ${collapsed ? "flex-col" : ""} border-t border-primary-600/30`}
        >
          <button
            onClick={onLogout}
            className={`
              flex items-center gap-2 p-3 text-primary-300 hover:text-white hover:bg-red-500/20
              transition-all duration-200 flex-1 group
              ${collapsed ? "justify-center" : "px-4"}
            `}
            title="Logout"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-3 text-primary-400 hover:text-secondary hover:bg-primary-600/30 transition-all duration-200 group"
            title={collapsed ? "Expand" : "Collapse"}
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
