import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Bell,
  Shield,
  Globe,
  CreditCard,
  Database,
  Save,
  Key,
  Mail,
  Lock,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Card, Button, Badge, Modal } from '../../components/common';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionGate } from '../../components/auth';
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_CATEGORIES } from '../../config/permissions';
import rolesService from '../../services/roles.service';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { isSuperAdmin, isAdmin } = usePermissions();

  // Role management state
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState(null);
  const [availablePermissions, setAvailablePermissions] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: []
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'users', label: 'Admin Users', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Lock, permission: PERMISSIONS.SETTINGS.ROLES_MANAGE },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing Rates', icon: CreditCard },
    { id: 'integrations', label: 'Integrations', icon: Database },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter(tab => {
    if (!tab.permission) return true;
    if (isSuperAdmin) return true;
    return false;
  });

  // Fetch roles from database
  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      setRolesError(null);
      const response = await rolesService.getRoles();
      if (response.length) {
        setRoles(response);
      } else {
        console.log(response);
        setRolesError(response.error || 'Failed to load roles');
      }
    } catch (err) {
      setRolesError(err.error || 'Failed to load roles');
    } finally {
      setLoadingRoles(false);
    }
  };

  // Fetch available permissions
  const fetchAvailablePermissions = async () => {
    try {
      const response = await rolesService.getAvailablePermissions();
      if (response.success) {
        setAvailablePermissions(response.data);
      }
    } catch (err) {
      console.error('Failed to load available permissions:', err);
    }
  };

  // Fetch roles when roles tab is active
  useEffect(() => {
    if (activeTab === 'roles' && roles.length === 0) {
      fetchRoles();
      fetchAvailablePermissions();
    }
  }, [activeTab]);

  // Open modal to create new role
  const handleCreateRole = () => {
    setSelectedRole(null);
    setRoleFormData({
      name: '',
      displayName: '',
      description: '',
      permissions: []
    });
    setIsRoleModalOpen(true);
  };

  // Open modal to edit role
  const handleEditRole = (role) => {
    setSelectedRole(role);
    setRoleFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setIsRoleModalOpen(true);
  };

  // Handle permission toggle
  const handlePermissionToggle = (permission) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  // Toggle all permissions in a category
  const handleCategoryToggle = (categoryPermissions) => {
    const allSelected = categoryPermissions.every(p => roleFormData.permissions.includes(p));
    if (allSelected) {
      setRoleFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermissions.includes(p))
      }));
    } else {
      setRoleFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])]
      }));
    }
  };

  // Save role
  const handleSaveRole = async () => {
    try {
      setSavingRole(true);
      let response;
      if (selectedRole) {
        response = await rolesService.updateRole(selectedRole.id, {
          displayName: roleFormData.displayName,
          description: roleFormData.description,
          permissions: roleFormData.permissions
        });
      } else {
        response = await rolesService.createRole({
          name: roleFormData.name,
          displayName: roleFormData.displayName,
          description: roleFormData.description,
          permissions: roleFormData.permissions
        });
      }

      if (response) {
        setIsRoleModalOpen(false);
        fetchRoles();
      } else {
        alert(response.error || 'Failed to save role');
      }
    } catch (err) {
      alert(err.error || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  // Delete role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      const response = await rolesService.deleteRole(roleToDelete.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        setRoleToDelete(null);
        fetchRoles();
      } else {
        alert(response.error || 'Failed to delete role');
      }
    } catch (err) {
      alert(err.error || 'Failed to delete role');
    }
  };

  const adminUsers = [
    { name: 'Admin User', email: 'admin@helloteam.com', role: 'Super Admin', status: 'active', lastLogin: '2025-12-18 9:00 AM' },
    { name: 'Sarah Admin', email: 'sarah.admin@helloteam.com', role: 'Admin', status: 'active', lastLogin: '2025-12-18 8:30 AM' },
    { name: 'Mike Support', email: 'mike.support@helloteam.com', role: 'Support', status: 'active', lastLogin: '2025-12-17 6:00 PM' },
  ];

  const billingRates = [
    { client: 'ABC Corporation', standardRate: 45.00, overtimeRate: 67.50, holidayRate: 90.00 },
    { client: 'XYZ Industries', standardRate: 42.00, overtimeRate: 63.00, holidayRate: 84.00 },
    { client: 'Tech Solutions', standardRate: 48.00, overtimeRate: 72.00, holidayRate: 96.00 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500">Manage system configuration and preferences</p>
        </div>
        <Button variant="primary" icon={Save}>
          Save Changes
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <Card padding="sm">
            <nav className="space-y-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors
                    ${activeTab === tab.id
                      ? 'bg-primary-50 text-primary font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Company Name</label>
                  <input type="text" className="input" defaultValue="Hello Team" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Default Timezone</label>
                    <select className="input">
                      <option>America/New_York (ET)</option>
                      <option>America/Chicago (CT)</option>
                      <option>America/Denver (MT)</option>
                      <option>America/Los_Angeles (PT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date Format</label>
                    <select className="input">
                      <option>MM/DD/YYYY</option>
                      <option>DD/MM/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Work Week Start</label>
                    <select className="input">
                      <option>Sunday</option>
                      <option>Monday</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Default Overtime Threshold</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input w-24" defaultValue={40} />
                      <span className="text-gray-500">hours/week</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label">Payroll Periods</label>
                  <select className="input">
                    <option>Bi-weekly (1st-15th, 16th-End)</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'users' && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Admin Users</h3>
                <Button variant="primary" size="sm">
                  Add Admin
                </Button>
              </div>
              <div className="space-y-3">
                {adminUsers.map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge variant={user.role === 'Super Admin' ? 'primary' : 'default'}>
                          {user.role}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">Last: {user.lastLogin}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              {/* Role Management */}
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Role Management</h3>
                    <p className="text-sm text-gray-500 mt-1">Create and manage roles with custom permissions</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchRoles}>
                      Refresh
                    </Button>
                    <Button variant="primary" size="sm" icon={Plus} onClick={handleCreateRole}>
                      Create Role
                    </Button>
                  </div>
                </div>

                {loadingRoles ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-gray-500">Loading roles...</span>
                  </div>
                ) : rolesError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                    {rolesError}
                  </div>
                ) : roles.length > 0 ? (
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{role.displayName}</p>
                              {role.isSystem && (
                                <Badge variant="default" size="sm">System</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{role.description}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {role.permissions?.length || 0} permissions • {role.userCount || 0} users
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            onClick={() => handleEditRole(role)}
                          >
                            Edit
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setRoleToDelete(role);
                                setIsDeleteModalOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No roles found. Create your first role to get started.
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Role Edit/Create Modal */}
          {isRoleModalOpen && (
            <Modal
              isOpen={isRoleModalOpen}
              onClose={() => setIsRoleModalOpen(false)}
              title={selectedRole ? `Edit Role: ${selectedRole.displayName}` : 'Create New Role'}
              size="xl"
            >
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!selectedRole && (
                    <div>
                      <label className="label">Role Name (identifier)</label>
                      <input
                        type="text"
                        className="input"
                        value={roleFormData.name}
                        onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., MANAGER"
                      />
                      <p className="text-xs text-gray-400 mt-1">This will be converted to uppercase</p>
                    </div>
                  )}
                  <div className={selectedRole ? 'md:col-span-2' : ''}>
                    <label className="label">Display Name</label>
                    <input
                      type="text"
                      className="input"
                      value={roleFormData.displayName}
                      onChange={(e) => setRoleFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="e.g., Manager"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={roleFormData.description}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this role's responsibilities"
                  />
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="label mb-0">Permissions</label>
                    <span className="text-sm text-gray-500">
                      {roleFormData.permissions.length} selected
                    </span>
                  </div>
                  <div className="border rounded-xl max-h-96 overflow-y-auto">
                    {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                      const allSelected = permissions.every(p => roleFormData.permissions.includes(p));
                      const someSelected = permissions.some(p => roleFormData.permissions.includes(p));
                      return (
                        <div key={category} className="border-b last:border-b-0">
                          <div
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleCategoryToggle(permissions)}
                          >
                            <span className="font-medium text-gray-700">{category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {permissions.filter(p => roleFormData.permissions.includes(p)).length}/{permissions.length}
                              </span>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={el => el && (el.indeterminate = someSelected && !allSelected)}
                                onChange={() => handleCategoryToggle(permissions)}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            {permissions.map(permission => (
                              <label
                                key={permission}
                                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  checked={roleFormData.permissions.includes(permission)}
                                  onChange={() => handlePermissionToggle(permission)}
                                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">
                                  {PERMISSION_LABELS[permission] || permission}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveRole}
                    disabled={savingRole || (!selectedRole && !roleFormData.name) || !roleFormData.displayName}
                  >
                    {savingRole ? 'Saving...' : selectedRole ? 'Update Role' : 'Create Role'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Delete Confirmation Modal */}
          {isDeleteModalOpen && roleToDelete && (
            <Modal
              isOpen={isDeleteModalOpen}
              onClose={() => {
                setIsDeleteModalOpen(false);
                setRoleToDelete(null);
              }}
              title="Delete Role"
              size="sm"
            >
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete "{roleToDelete.displayName}"?
                </h3>
                <p className="text-gray-500 mb-6">
                  This action cannot be undone. Users assigned to this role will need to be reassigned.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setRoleToDelete(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteRole}
                  >
                    Delete Role
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">System Notifications</h3>
              <div className="space-y-4">
                {[
                  { label: 'New employee registrations', enabled: true },
                  { label: 'New client signups', enabled: true },
                  { label: 'Overtime alerts', enabled: true },
                  { label: 'Missed clock-outs', enabled: true },
                  { label: 'Payroll processing reminders', enabled: true },
                  { label: 'System health alerts', enabled: true },
                  { label: 'Daily summary reports', enabled: false },
                  { label: 'Weekly analytics digest', enabled: true },
                ].map((setting, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">{setting.label}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked={setting.enabled} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Password Policy</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">Minimum password length</span>
                    <select className="input w-24">
                      <option>8</option>
                      <option>10</option>
                      <option>12</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">Require special characters</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">Password expiry (days)</span>
                    <select className="input w-24">
                      <option>30</option>
                      <option>60</option>
                      <option>90</option>
                      <option>Never</option>
                    </select>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Session Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">Session timeout (minutes)</span>
                    <select className="input w-24">
                      <option>15</option>
                      <option>30</option>
                      <option>60</option>
                      <option>120</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">Enforce 2FA for admins</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'billing' && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Client Billing Rates</h3>
                <Button variant="outline" size="sm">
                  Add Rate
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Client</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Standard</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Overtime (1.5x)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Holiday (2x)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingRates.map((rate, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-4 px-4 font-medium text-gray-900">{rate.client}</td>
                        <td className="py-4 px-4 text-right">${rate.standardRate.toFixed(2)}/hr</td>
                        <td className="py-4 px-4 text-right text-orange-600">${rate.overtimeRate.toFixed(2)}/hr</td>
                        <td className="py-4 px-4 text-right text-purple-600">${rate.holidayRate.toFixed(2)}/hr</td>
                        <td className="py-4 px-4 text-right">
                          <Button variant="ghost" size="sm">Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Integrations</h3>
              <div className="space-y-4">
                {[
                  { name: 'Slack', description: 'Send notifications to Slack channels', connected: true },
                  { name: 'QuickBooks', description: 'Sync payroll data with QuickBooks', connected: true },
                  { name: 'Google Calendar', description: 'Sync schedules with Google Calendar', connected: false },
                  { name: 'Zapier', description: 'Connect with 5000+ apps via Zapier', connected: false },
                ].map((integration, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <Database className="w-6 h-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{integration.name}</p>
                        <p className="text-sm text-gray-500">{integration.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {integration.connected ? (
                        <>
                          <Badge variant="success">Connected</Badge>
                          <Button variant="ghost" size="sm">Configure</Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm">Connect</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
