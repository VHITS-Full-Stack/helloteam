import { useState, useEffect } from 'react';
import { Building2, Users, Bell, Shield, Globe, Clock, Save, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data from API
  const [companyInfo, setCompanyInfo] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    address: '',
    timezone: 'America/New_York',
    email: '',
    status: '',
  });

  const [policies, setPolicies] = useState({
    allowPaidLeave: false,
    paidLeaveType: null,
    annualPaidLeaveDays: 0,
    allowUnpaidLeave: true,
    requireTwoWeeksNotice: true,
    allowOvertime: true,
    overtimeRequiresApproval: true,
  });

  const [assignedEmployees, setAssignedEmployees] = useState([]);

  // Notification preferences (local state for now)
  const [notifications, setNotifications] = useState({
    timeEntrySubmissions: true,
    overtimeAlerts: true,
    leaveRequests: true,
    weeklySummary: false,
    invoiceNotifications: true,
  });

  // Preferences (local state for now)
  const [preferences, setPreferences] = useState({
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12-hour',
    workWeekStart: 'Sunday',
    overtimeThreshold: 40,
  });

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'team', label: 'Team Access', icon: Users },
    { id: 'policies', label: 'Policies', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Globe },
  ];

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'UTC', label: 'UTC' },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await clientPortalService.getSettings();
      if (response.success && response.data) {
        const { company, policies: policyData, notifications: notificationData, preferences: preferenceData, assignedEmployees: employees } = response.data;

        setCompanyInfo({
          companyName: company.companyName || '',
          contactPerson: company.contactPerson || '',
          phone: company.phone || '',
          address: company.address || '',
          timezone: company.timezone || 'America/New_York',
          email: company.email || '',
          status: company.status || '',
        });

        if (policyData) {
          setPolicies(policyData);
        }

        if (notificationData) {
          setNotifications(notificationData);
        }

        if (preferenceData) {
          setPreferences(preferenceData);
        }

        setAssignedEmployees(employees || []);
      }
    } catch (err) {
      setError('Failed to load settings');
      console.error('Settings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyChange = (field, value) => {
    setPolicies(prev => ({ ...prev, [field]: value }));
  };

  const handleSavePolicies = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await clientPortalService.updateSettings(policies);

      if (response.success) {
        setSuccess('Policies updated successfully');
        if (response.data?.policies) {
          setPolicies(response.data.policies);
        }
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update policies');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update policies');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (key) => {
    const newValue = !notifications[key];
    setNotifications(prev => ({ ...prev, [key]: newValue }));

    try {
      const response = await clientPortalService.updateSettings({
        notifications: { [key]: newValue }
      });
      if (!response.success) {
        // Revert on failure
        setNotifications(prev => ({ ...prev, [key]: !newValue }));
        setError(response.error || 'Failed to update notification setting');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      // Revert on error
      setNotifications(prev => ({ ...prev, [key]: !newValue }));
      setError(err.error || err.message || 'Failed to update notification setting');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const oldValue = preferences[key];
    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      const response = await clientPortalService.updateSettings({
        preferences: { [key]: value }
      });
      if (!response.success) {
        // Revert on failure
        setPreferences(prev => ({ ...prev, [key]: oldValue }));
        setError(response.error || 'Failed to update preference');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: oldValue }));
      setError(err.error || err.message || 'Failed to update preference');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500">Manage your organization settings and preferences</p>
        </div>
        {activeTab === 'policies' && (
          <Button
            variant="primary"
            icon={Save}
            onClick={handleSavePolicies}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <Card padding="sm">
            <nav className="space-y-1">
              {tabs.map((tab) => (
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
          {activeTab === 'company' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Company Information</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Company Name</span>
                  </div>
                  <span className="font-medium text-gray-900">{companyInfo.companyName}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Contact Person</span>
                  </div>
                  <span className="font-medium text-gray-900">{companyInfo.contactPerson || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Email</span>
                  </div>
                  <span className="font-medium text-gray-900">{companyInfo.email}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Timezone</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {timezones.find(tz => tz.value === companyInfo.timezone)?.label || companyInfo.timezone}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Account Status</span>
                  </div>
                  <Badge variant={companyInfo.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {companyInfo.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  To update company information, please go to your <a href="/client/profile" className="text-primary hover:underline">Profile</a> page.
                </p>
              </div>
            </Card>
          )}

          {activeTab === 'team' && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Assigned Employees</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {assignedEmployees.length} employee{assignedEmployees.length !== 1 ? 's' : ''} assigned to your organization
                  </p>
                </div>
              </div>
              {assignedEmployees.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No employees assigned yet</p>
                  <p className="text-sm mt-1">Contact HelloTeam admin to assign employees to your organization</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignedEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="font-semibold text-primary">
                            {employee.firstName?.charAt(0) || employee.name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{employee.name}</p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={employee.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {employee.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'policies' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Workforce Policies</h3>
              <div className="space-y-6">
                {/* Leave Policies */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Leave Policies</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">Allow Paid Leave</p>
                        <p className="text-sm text-gray-500">Enable paid time off for employees</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={policies.allowPaidLeave}
                          onChange={(e) => handlePolicyChange('allowPaidLeave', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>

                    {policies.allowPaidLeave && (
                      <>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Paid Leave Type
                          </label>
                          <select
                            className="input"
                            value={policies.paidLeaveType || ''}
                            onChange={(e) => handlePolicyChange('paidLeaveType', e.target.value || null)}
                          >
                            <option value="">Select type</option>
                            <option value="fixed">Fixed Annual Days</option>
                              <option value="fixed-half-yearly">Fixed Half-Yearly</option>
                            <option value="accrued">Accrued Monthly</option>
                            <option value="milestone">Milestone Based</option>
                          </select>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Annual Paid Leave Days
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input w-24"
                              value={policies.annualPaidLeaveDays}
                              onChange={(e) => handlePolicyChange('annualPaidLeaveDays', parseInt(e.target.value) || 0)}
                              min={0}
                            />
                            <span className="text-gray-500">days per year</span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">Allow Unpaid Leave</p>
                        <p className="text-sm text-gray-500">Allow employees to request unpaid time off</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={policies.allowUnpaidLeave}
                          onChange={(e) => handlePolicyChange('allowUnpaidLeave', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">Require Two Weeks Notice</p>
                        <p className="text-sm text-gray-500">Require advance notice for leave requests</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={policies.requireTwoWeeksNotice}
                          onChange={(e) => handlePolicyChange('requireTwoWeeksNotice', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Overtime Policies */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Overtime Policies</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">Allow Overtime</p>
                        <p className="text-sm text-gray-500">Allow employees to work overtime hours</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={policies.allowOvertime}
                          onChange={(e) => handlePolicyChange('allowOvertime', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>

                    {policies.allowOvertime && (
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-900">Overtime Requires Approval</p>
                          <p className="text-sm text-gray-500">Overtime must be approved before payment</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={policies.overtimeRequiresApproval}
                            onChange={(e) => handlePolicyChange('overtimeRequiresApproval', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { key: 'timeEntrySubmissions', label: 'New time entry submissions', description: 'Get notified when employees submit time entries' },
                  { key: 'overtimeAlerts', label: 'Overtime alerts', description: 'Get alerted when overtime is recorded' },
                  { key: 'leaveRequests', label: 'Leave request notifications', description: 'Get notified of new leave requests' },
                  { key: 'weeklySummary', label: 'Weekly summary reports', description: 'Receive weekly workforce summary' },
                  { key: 'invoiceNotifications', label: 'Invoice notifications', description: 'Get notified when new invoices are generated' },
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{setting.label}</p>
                      <p className="text-sm text-gray-500">{setting.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications[setting.key]}
                        onChange={() => handleNotificationToggle(setting.key)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Changes are automatically saved.
              </p>
            </Card>
          )}

          {activeTab === 'preferences' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">System Preferences</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Date Format</label>
                  <select
                    className="input"
                    value={preferences.dateFormat}
                    onChange={(e) => handlePreferenceChange('dateFormat', e.target.value)}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="label">Time Format</label>
                  <select
                    className="input"
                    value={preferences.timeFormat}
                    onChange={(e) => handlePreferenceChange('timeFormat', e.target.value)}
                  >
                    <option value="12-hour">12-hour (AM/PM)</option>
                    <option value="24-hour">24-hour</option>
                  </select>
                </div>
                <div>
                  <label className="label">Work Week Start</label>
                  <select
                    className="input"
                    value={preferences.workWeekStart}
                    onChange={(e) => handlePreferenceChange('workWeekStart', e.target.value)}
                  >
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                  </select>
                </div>
                <div>
                  <label className="label">Default Overtime Threshold</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input w-24"
                      value={preferences.overtimeThreshold}
                      onBlur={(e) => handlePreferenceChange('overtimeThreshold', parseInt(e.target.value) || 40)}
                      onChange={(e) => setPreferences(prev => ({ ...prev, overtimeThreshold: parseInt(e.target.value) || 40 }))}
                    />
                    <span className="text-gray-500">hours per week</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Changes are automatically saved.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
