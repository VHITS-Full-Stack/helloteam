import { useState, useRef } from 'react';
import { Building2, User, Mail, Phone, MapPin, Globe, Shield, Camera, Save, Bell, Lock, Eye, EyeOff, AlertCircle, Check, Clock, Loader2, Trash2 } from 'lucide-react';
import { Card, Button, Badge, PhoneInput } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/auth.service';

const Profile = () => {
  const { user: authUser } = useAuth();

  const [activeTab, setActiveTab] = useState('company');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Profile data - initialized from auth context (no extra API call needed)
  const [profile, setProfile] = useState(authUser);

  // Form data for editing - initialized from auth context
  const [formData, setFormData] = useState(() => {
    const client = authUser?.client;
    return {
      companyName: client?.companyName || '',
      contactPerson: client?.contactPerson || '',
      countryCode: client?.countryCode || '+1',
      phone: client?.phone || '',
      address: client?.address || '',
      timezone: client?.timezone || 'America/New_York',
    };
  });

  // Password change form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification preferences (local state for now)
  const [notifications, setNotifications] = useState({
    timeEntrySubmissions: true,
    overtimeAlerts: true,
    leaveRequests: true,
    weeklySummary: false,
    invoiceNotifications: true,
  });

  const fetchingRef = useRef(false);

  // Only used to refresh after profile updates, not on mount
  const fetchProfile = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setLoading(true);
      const response = await authService.getProfile();
      if (response.success && response.data) {
        setProfile(response.data);
        if (response.data.client) {
          const client = response.data.client;
          setFormData({
            companyName: client.companyName || '',
            contactPerson: client.contactPerson || '',
            phone: client.phone || '',
            address: client.address || '',
            timezone: client.timezone || 'America/New_York',
          });
        }
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await authService.updateProfile(formData);

      if (response.success) {
        setSuccess('Profile updated successfully');
        setProfile(response.data);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (response.success) {
        setPasswordSuccess('Password changed successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setTimeout(() => setPasswordSuccess(''), 3000);
      } else {
        setPasswordError(response.error || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError(err.error || err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleNotificationToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed types: JPEG, PNG, WebP, GIF');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB');
      return;
    }

    try {
      setUploadingLogo(true);
      setError('');
      const response = await authService.uploadClientLogo(file);
      if (response.success) {
        setSuccess('Company logo uploaded successfully');
        // Refresh profile to get new logo URL
        fetchProfile();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to upload logo');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteLogo = async () => {
    if (!window.confirm('Are you sure you want to delete the company logo?')) {
      return;
    }

    try {
      setUploadingLogo(true);
      setError('');
      const response = await authService.deleteClientLogo();
      if (response.success) {
        setSuccess('Company logo deleted successfully');
        // Refresh profile
        fetchProfile();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to delete logo');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const tabs = [
    { id: 'company', label: 'Company Info' },
    { id: 'account', label: 'Account' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security' },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const client = profile?.client;
  const user = profile;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-gray-500">Manage your company profile and account settings</p>
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

      {/* Profile Header Card */}
      <Card>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            {client?.logoUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary-200">
                <img
                  src={client.logoUrl}
                  alt={client?.companyName || 'Company'}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-primary" />
              </div>
            )}
            {uploadingLogo ? (
              <div className="absolute bottom-0 right-0 p-2 bg-gray-400 text-white rounded-full shadow-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
            {client?.logoUrl && !uploadingLogo && (
              <button
                onClick={handleDeleteLogo}
                className="absolute bottom-0 left-0 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
            />
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{client?.companyName || 'Company'}</h3>
            <p className="text-gray-500">{user?.email}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
              <Badge variant={user?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {user?.status || 'Unknown'}
              </Badge>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Globe className="w-4 h-4" />
                {client?.timezone || 'UTC'}
              </span>
            </div>
          </div>
          {activeTab === 'company' && (
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'company' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="text"
                    name="companyName"
                    className="input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={formData.companyName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div>
                <label className="label">Contact Person</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="text"
                    name="contactPerson"
                    className="input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={formData.contactPerson}
                    onChange={handleInputChange}
                    placeholder="Primary contact name"
                  />
                </div>
              </div>
              <PhoneInput
                phone={formData.phone}
                countryCode={formData.countryCode}
                onPhoneChange={(val) => setFormData(prev => ({ ...prev, phone: val }))}
                onCountryCodeChange={(code) => setFormData(prev => ({ ...prev, countryCode: code }))}
                label="Phone Number"
              />
              <div>
                <label className="label">Business Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                  <textarea
                    name="address"
                    className="input min-h-[80px] resize-none"
                    style={{ paddingLeft: '2.5rem' }}
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter business address"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Timezone Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Timezone</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <select
                    name="timezone"
                    className="input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={formData.timezone}
                    onChange={handleInputChange}
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This timezone will be used for all time tracking and reporting
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Current local time</p>
                <p className="font-medium text-gray-900 mt-1">
                  {new Date().toLocaleString('en-US', {
                    timeZone: formData.timezone,
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Email</span>
                </div>
                <span className="font-medium text-gray-900">{user?.email || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Account Type</span>
                </div>
                <span className="font-medium text-gray-900">{user?.role || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Client ID</span>
                </div>
                <span className="font-medium text-gray-900 text-sm">
                  {client?.id || 'N/A'}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Activity</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Account Created</p>
                <p className="font-medium text-gray-900 mt-1">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Last Login</p>
                <p className="font-medium text-gray-900 mt-1">
                  {user?.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString()
                    : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Account Status</p>
                <div className="mt-1">
                  <Badge variant={user?.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {user?.status || 'Unknown'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            {[
              { key: 'timeEntrySubmissions', label: 'New time entry submissions', description: 'Get notified when employees submit time entries' },
              { key: 'overtimeAlerts', label: 'Overtime alerts', description: 'Get alerted when overtime is recorded' },
              { key: 'leaveRequests', label: 'Leave request notifications', description: 'Get notified of new leave requests' },
              { key: 'weeklySummary', label: 'Weekly summary reports', description: 'Receive weekly workforce summary' },
              { key: 'invoiceNotifications', label: 'Invoice notifications', description: 'Get notified when new invoices are generated' },
            ].map((pref) => (
              <div key={pref.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-900">{pref.label}</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-8 mt-1">{pref.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications[pref.key]}
                    onChange={() => handleNotificationToggle(pref.key)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700">{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="password"
                    className="input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Enter new password (min 8 characters)"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="password"
                    className="input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={changingPassword}
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Two-Factor Authentication</h3>
            <div className="p-4 bg-yellow-50 rounded-xl mb-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Not Enabled</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full" disabled>
              Enable 2FA (Coming Soon)
            </Button>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Security Status</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last login</span>
                  <span className="text-gray-900">
                    {user?.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account status</span>
                  <Badge variant={user?.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                    {user?.status || 'Unknown'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Profile;
