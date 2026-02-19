// Permission constants for granular RBAC
// Sprint 1.6: Granular RBAC & Permissions System

export const PERMISSIONS = {
  // Employee Management
  EMPLOYEES: {
    VIEW: 'employees.view',
    CREATE: 'employees.create',
    EDIT: 'employees.edit',
    DELETE: 'employees.delete',
    ASSIGN: 'employees.assign',
  },

  // Client Management
  CLIENTS: {
    VIEW: 'clients.view',
    CREATE: 'clients.create',
    EDIT: 'clients.edit',
    DELETE: 'clients.delete',
    MANAGE_EMPLOYEES: 'clients.manage_employees',
  },

  // Time Records
  TIME_RECORDS: {
    VIEW: 'time_records.view',
    VIEW_ALL: 'time_records.view_all',
    APPROVE: 'time_records.approve',
    ADJUST: 'time_records.adjust',
    EXPORT: 'time_records.export',
  },

  // Reports & Analytics
  REPORTS: {
    VIEW: 'reports.view',
    EXPORT: 'reports.export',
    ANALYTICS: 'reports.analytics',
  },

  // Payroll
  PAYROLL: {
    VIEW: 'payroll.view',
    PROCESS: 'payroll.process',
    EXPORT: 'payroll.export',
  },

  // Settings
  SETTINGS: {
    VIEW: 'settings.view',
    EDIT: 'settings.edit',
    ROLES_MANAGE: 'settings.roles_manage',
  },

  // Support Tickets
  SUPPORT: {
    VIEW: 'support.view',
    RESPOND: 'support.respond',
    ESCALATE: 'support.escalate',
  },

  // Dashboard
  DASHBOARD: {
    VIEW: 'dashboard.view',
    VIEW_STATS: 'dashboard.view_stats',
  },

  // Approvals
  APPROVALS: {
    VIEW: 'approvals.view',
    APPROVE_LEAVE: 'approvals.approve_leave',
    APPROVE_TIME: 'approvals.approve_time',
    APPROVE_OVERTIME: 'approvals.approve_overtime',
  },

  // Schedules
  SCHEDULES: {
    VIEW: 'schedules.view',
    CREATE: 'schedules.create',
    EDIT: 'schedules.edit',
    DELETE: 'schedules.delete',
  },

  // Groups
  GROUPS: {
    VIEW: 'groups.view',
    CREATE: 'groups.create',
    EDIT: 'groups.edit',
    DELETE: 'groups.delete',
    MANAGE_EMPLOYEES: 'groups.manage_employees',
  },

  // Tasks
  TASKS: {
    VIEW: 'tasks.view',
    CREATE: 'tasks.create',
    EDIT: 'tasks.edit',
    DELETE: 'tasks.delete',
  },
} as const;

// Flatten permissions for easy iteration
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap(
  (category) => Object.values(category)
);

// Permission type
export type Permission = typeof ALL_PERMISSIONS[number];

// Role-Permission Mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS, // Full access to everything

  ADMIN: [
    // Employees - Full access
    PERMISSIONS.EMPLOYEES.VIEW,
    PERMISSIONS.EMPLOYEES.CREATE,
    PERMISSIONS.EMPLOYEES.EDIT,
    PERMISSIONS.EMPLOYEES.DELETE,
    PERMISSIONS.EMPLOYEES.ASSIGN,

    // Clients - Full access
    PERMISSIONS.CLIENTS.VIEW,
    PERMISSIONS.CLIENTS.CREATE,
    PERMISSIONS.CLIENTS.EDIT,
    PERMISSIONS.CLIENTS.DELETE,
    PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES,

    // Time Records - Full access
    PERMISSIONS.TIME_RECORDS.VIEW,
    PERMISSIONS.TIME_RECORDS.VIEW_ALL,
    PERMISSIONS.TIME_RECORDS.APPROVE,
    PERMISSIONS.TIME_RECORDS.ADJUST,
    PERMISSIONS.TIME_RECORDS.EXPORT,

    // Reports - Full access
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.EXPORT,
    PERMISSIONS.REPORTS.ANALYTICS,

    // Payroll - View and export only
    PERMISSIONS.PAYROLL.VIEW,
    PERMISSIONS.PAYROLL.EXPORT,

    // Settings - View and edit (no role management)
    PERMISSIONS.SETTINGS.VIEW,
    PERMISSIONS.SETTINGS.EDIT,

    // Support - Full access
    PERMISSIONS.SUPPORT.VIEW,
    PERMISSIONS.SUPPORT.RESPOND,
    PERMISSIONS.SUPPORT.ESCALATE,

    // Dashboard - Full access
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.DASHBOARD.VIEW_STATS,

    // Approvals - Full access
    PERMISSIONS.APPROVALS.VIEW,
    PERMISSIONS.APPROVALS.APPROVE_LEAVE,
    PERMISSIONS.APPROVALS.APPROVE_TIME,
    PERMISSIONS.APPROVALS.APPROVE_OVERTIME,

    // Schedules - Full access
    PERMISSIONS.SCHEDULES.VIEW,
    PERMISSIONS.SCHEDULES.CREATE,
    PERMISSIONS.SCHEDULES.EDIT,
    PERMISSIONS.SCHEDULES.DELETE,

    // Groups - Full access
    PERMISSIONS.GROUPS.VIEW,
    PERMISSIONS.GROUPS.CREATE,
    PERMISSIONS.GROUPS.EDIT,
    PERMISSIONS.GROUPS.DELETE,
    PERMISSIONS.GROUPS.MANAGE_EMPLOYEES,

    // Tasks - View only (read-only across all clients)
    PERMISSIONS.TASKS.VIEW,
  ],

  OPERATIONS: [
    // Employees - View, edit, assign (no create/delete)
    PERMISSIONS.EMPLOYEES.VIEW,
    PERMISSIONS.EMPLOYEES.EDIT,
    PERMISSIONS.EMPLOYEES.ASSIGN,

    // Clients - View and edit (no create/delete)
    PERMISSIONS.CLIENTS.VIEW,
    PERMISSIONS.CLIENTS.EDIT,
    PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES,

    // Time Records - Full access
    PERMISSIONS.TIME_RECORDS.VIEW,
    PERMISSIONS.TIME_RECORDS.VIEW_ALL,
    PERMISSIONS.TIME_RECORDS.APPROVE,
    PERMISSIONS.TIME_RECORDS.ADJUST,
    PERMISSIONS.TIME_RECORDS.EXPORT,

    // Reports - View and export
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.EXPORT,

    // Dashboard
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.DASHBOARD.VIEW_STATS,

    // Approvals - Full access
    PERMISSIONS.APPROVALS.VIEW,
    PERMISSIONS.APPROVALS.APPROVE_LEAVE,
    PERMISSIONS.APPROVALS.APPROVE_TIME,
    PERMISSIONS.APPROVALS.APPROVE_OVERTIME,

    // Schedules - Full access
    PERMISSIONS.SCHEDULES.VIEW,
    PERMISSIONS.SCHEDULES.CREATE,
    PERMISSIONS.SCHEDULES.EDIT,
    PERMISSIONS.SCHEDULES.DELETE,

    // Support - View and respond
    PERMISSIONS.SUPPORT.VIEW,
    PERMISSIONS.SUPPORT.RESPOND,

    // Groups - Full access
    PERMISSIONS.GROUPS.VIEW,
    PERMISSIONS.GROUPS.CREATE,
    PERMISSIONS.GROUPS.EDIT,
    PERMISSIONS.GROUPS.DELETE,
    PERMISSIONS.GROUPS.MANAGE_EMPLOYEES,

    // Tasks - View only (read-only across all clients)
    PERMISSIONS.TASKS.VIEW,
  ],

  HR: [
    // Employees - Full access except delete
    PERMISSIONS.EMPLOYEES.VIEW,
    PERMISSIONS.EMPLOYEES.CREATE,
    PERMISSIONS.EMPLOYEES.EDIT,
    PERMISSIONS.EMPLOYEES.ASSIGN,

    // Clients - View only
    PERMISSIONS.CLIENTS.VIEW,

    // Time Records - View and approve
    PERMISSIONS.TIME_RECORDS.VIEW,
    PERMISSIONS.TIME_RECORDS.VIEW_ALL,
    PERMISSIONS.TIME_RECORDS.APPROVE,

    // Reports - View
    PERMISSIONS.REPORTS.VIEW,

    // Dashboard
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.DASHBOARD.VIEW_STATS,

    // Approvals - Leave only
    PERMISSIONS.APPROVALS.VIEW,
    PERMISSIONS.APPROVALS.APPROVE_LEAVE,

    // Schedules - View and edit
    PERMISSIONS.SCHEDULES.VIEW,
    PERMISSIONS.SCHEDULES.CREATE,
    PERMISSIONS.SCHEDULES.EDIT,

    // Support - View
    PERMISSIONS.SUPPORT.VIEW,

    // Groups - View, create, edit, manage (no delete)
    PERMISSIONS.GROUPS.VIEW,
    PERMISSIONS.GROUPS.CREATE,
    PERMISSIONS.GROUPS.EDIT,
    PERMISSIONS.GROUPS.MANAGE_EMPLOYEES,
  ],

  FINANCE: [
    // Employees - View only
    PERMISSIONS.EMPLOYEES.VIEW,

    // Clients - View only
    PERMISSIONS.CLIENTS.VIEW,

    // Time Records - View and export
    PERMISSIONS.TIME_RECORDS.VIEW,
    PERMISSIONS.TIME_RECORDS.VIEW_ALL,
    PERMISSIONS.TIME_RECORDS.EXPORT,

    // Reports - Full access
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.EXPORT,
    PERMISSIONS.REPORTS.ANALYTICS,

    // Payroll - Full access
    PERMISSIONS.PAYROLL.VIEW,
    PERMISSIONS.PAYROLL.PROCESS,
    PERMISSIONS.PAYROLL.EXPORT,

    // Dashboard
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.DASHBOARD.VIEW_STATS,

    // Approvals - View only
    PERMISSIONS.APPROVALS.VIEW,
  ],

  SUPPORT: [
    // Employees - View only
    PERMISSIONS.EMPLOYEES.VIEW,

    // Clients - View only
    PERMISSIONS.CLIENTS.VIEW,

    // Dashboard - View only
    PERMISSIONS.DASHBOARD.VIEW,

    // Support - Full access
    PERMISSIONS.SUPPORT.VIEW,
    PERMISSIONS.SUPPORT.RESPOND,
    PERMISSIONS.SUPPORT.ESCALATE,

    // Approvals - View only
    PERMISSIONS.APPROVALS.VIEW,
  ],

  // Client portal permissions
  CLIENT: [
    PERMISSIONS.EMPLOYEES.VIEW, // View their assigned employees
    PERMISSIONS.TIME_RECORDS.VIEW,
    PERMISSIONS.TIME_RECORDS.APPROVE,
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.APPROVALS.VIEW,
    PERMISSIONS.APPROVALS.APPROVE_TIME,
    PERMISSIONS.GROUPS.VIEW,
    PERMISSIONS.GROUPS.CREATE,
    PERMISSIONS.GROUPS.EDIT,
    PERMISSIONS.GROUPS.DELETE,
    PERMISSIONS.GROUPS.MANAGE_EMPLOYEES,

    // Tasks - Full CRUD on own tasks
    PERMISSIONS.TASKS.VIEW,
    PERMISSIONS.TASKS.CREATE,
    PERMISSIONS.TASKS.EDIT,
    PERMISSIONS.TASKS.DELETE,
  ],

  // Employee portal permissions
  EMPLOYEE: [
    PERMISSIONS.TIME_RECORDS.VIEW, // View own time records
    PERMISSIONS.SCHEDULES.VIEW, // View own schedule
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.SUPPORT.VIEW, // Create/view support tickets
    PERMISSIONS.TASKS.VIEW, // View assigned tasks
    PERMISSIONS.TASKS.CREATE, // Create personal tasks
    PERMISSIONS.TASKS.EDIT, // Edit assigned task details
    PERMISSIONS.TASKS.DELETE, // Delete personal tasks
  ],
};

// Helper function to check if a role has a permission
export const hasPermission = (role: string, permission: string): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permission);
};

// Helper function to get all permissions for a role
export const getRolePermissions = (role: string): string[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// Helper function to check if a role has any of the given permissions
export const hasAnyPermission = (role: string, permissions: string[]): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  return permissions.some((p) => rolePermissions.includes(p));
};

// Helper function to check if a role has all of the given permissions
export const hasAllPermissions = (role: string, permissions: string[]): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  return permissions.every((p) => rolePermissions.includes(p));
};

// Get permissions grouped by category for UI display
export const getPermissionsByCategory = () => {
  return {
    Employees: Object.entries(PERMISSIONS.EMPLOYEES).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Clients: Object.entries(PERMISSIONS.CLIENTS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    'Time Records': Object.entries(PERMISSIONS.TIME_RECORDS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Reports: Object.entries(PERMISSIONS.REPORTS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Payroll: Object.entries(PERMISSIONS.PAYROLL).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Settings: Object.entries(PERMISSIONS.SETTINGS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Support: Object.entries(PERMISSIONS.SUPPORT).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Dashboard: Object.entries(PERMISSIONS.DASHBOARD).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Approvals: Object.entries(PERMISSIONS.APPROVALS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Schedules: Object.entries(PERMISSIONS.SCHEDULES).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Groups: Object.entries(PERMISSIONS.GROUPS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
    Tasks: Object.entries(PERMISSIONS.TASKS).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
    })),
  };
};
