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
};

// Flatten permissions for easy iteration
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap(
  (category) => Object.values(category)
);

// Permission labels for UI display
export const PERMISSION_LABELS = {
  'employees.view': 'View Employees',
  'employees.create': 'Create Employees',
  'employees.edit': 'Edit Employees',
  'employees.delete': 'Delete Employees',
  'employees.assign': 'Assign Employees to Clients',

  'clients.view': 'View Clients',
  'clients.create': 'Create Clients',
  'clients.edit': 'Edit Clients',
  'clients.delete': 'Delete Clients',
  'clients.manage_employees': 'Manage Client Employees',

  'time_records.view': 'View Time Records',
  'time_records.view_all': 'View All Time Records',
  'time_records.approve': 'Approve Time Records',
  'time_records.adjust': 'Adjust Time Records',
  'time_records.export': 'Export Time Records',

  'reports.view': 'View Reports',
  'reports.export': 'Export Reports',
  'reports.analytics': 'View Analytics',

  'payroll.view': 'View Payroll',
  'payroll.process': 'Process Payroll',
  'payroll.export': 'Export Payroll',

  'settings.view': 'View Settings',
  'settings.edit': 'Edit Settings',
  'settings.roles_manage': 'Manage Roles',

  'support.view': 'View Support Tickets',
  'support.respond': 'Respond to Tickets',
  'support.escalate': 'Escalate Tickets',

  'dashboard.view': 'View Dashboard',
  'dashboard.view_stats': 'View Statistics',

  'approvals.view': 'View Approvals',
  'approvals.approve_leave': 'Approve Leave Requests',
  'approvals.approve_time': 'Approve Time Records',
  'approvals.approve_overtime': 'Approve Overtime',

  'schedules.view': 'View Schedules',
  'schedules.create': 'Create Schedules',
  'schedules.edit': 'Edit Schedules',
  'schedules.delete': 'Delete Schedules',

  'groups.view': 'View Groups',
  'groups.create': 'Create Groups',
  'groups.edit': 'Edit Groups',
  'groups.delete': 'Delete Groups',
  'groups.manage_employees': 'Manage Group Employees',

  'tasks.view': 'View Tasks',
  'tasks.create': 'Create Tasks',
  'tasks.edit': 'Edit Tasks',
  'tasks.delete': 'Delete Tasks',
};

// Get permission label
export const getPermissionLabel = (permission) => {
  return PERMISSION_LABELS[permission] || permission;
};

// Permission categories for grouping in UI
export const PERMISSION_CATEGORIES = {
  Employees: Object.values(PERMISSIONS.EMPLOYEES),
  Clients: Object.values(PERMISSIONS.CLIENTS),
  'Time Records': Object.values(PERMISSIONS.TIME_RECORDS),
  Reports: Object.values(PERMISSIONS.REPORTS),
  Payroll: Object.values(PERMISSIONS.PAYROLL),
  Settings: Object.values(PERMISSIONS.SETTINGS),
  Support: Object.values(PERMISSIONS.SUPPORT),
  Dashboard: Object.values(PERMISSIONS.DASHBOARD),
  Approvals: Object.values(PERMISSIONS.APPROVALS),
  Schedules: Object.values(PERMISSIONS.SCHEDULES),
  Groups: Object.values(PERMISSIONS.GROUPS),
  Tasks: Object.values(PERMISSIONS.TASKS),
};
