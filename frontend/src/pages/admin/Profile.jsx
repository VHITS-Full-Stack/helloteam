import { useState, useRef } from 'react';
import { User, Mail, Phone, Shield, Briefcase, Save, Lock, Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Card, Button, Badge, Avatar, PhoneInput } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/auth.service';

const Profile = () => {
  const { user: authUser } = useAuth();

  const [activeTab, setActiveTab] = useState('personal');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile data - initialized from auth context (no extra API call needed)
  const [profile, setProfile] = useState(authUser);

  // Form data for editing - initialized from auth context
  const [formData, setFormData] = useState(() => {
    const admin = authUser?.admin;
    return {
      firstName: admin?.firstName || '',
      lastName: admin?.lastName || '',
      countryCode: admin?.countryCode || '+1',
      phone: admin?.phone || '',
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
        if (response.data.admin) {
          const admin = response.data.admin;
          setFormData({
            firstName: admin.firstName || '',
            lastName: admin.lastName || '',
            phone: admin.phone || '',
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

  const getRoleBadgeVariant = (role) => {
    const roleVariants = {
      SUPER_ADMIN: 'danger',
      ADMIN: 'primary',
      OPERATIONS: 'info',
      HR: 'success',
      FINANCE: 'warning',
      SUPPORT: 'secondary',
    };
    return roleVariants[role] || 'default';
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Admin',
      OPERATIONS: 'Operations',
      HR: 'Human Resources',
      FINANCE: 'Finance',
      SUPPORT: 'Support',
    };
    return roleNames[role] || role;
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'account', label: 'Account' },
    { id: 'security', label: 'Security' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const admin = profile?.admin;
  const user = profile;
  const fullName = admin ? `${admin.firstName} ${admin.lastName}` : user?.email || 'Admin';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-gray-500">Manage your personal information and account settings</p>
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
          <Avatar name={fullName} size="xl" />
          <div className="text-center md:text-left flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{fullName}</h3>
            <p className="text-gray-500">{user?.email}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
              <Badge variant={getRoleBadgeVariant(user?.role)}>
                {getRoleDisplayName(user?.role)}
              </Badge>
              {admin?.department && (
                <Badge variant="secondary">{admin.department}</Badge>
              )}
              <Badge variant={user?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {user?.status || 'Unknown'}
              </Badge>
            </div>
          </div>
          {activeTab === 'personal' && (
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
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      name="firstName"
                      className="input"
                      style={{ paddingLeft: '2.5rem' }}
                      value={formData.firstName}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    className="input"
                    value={formData.lastName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="email"
                    className="input bg-gray-50"
                    style={{ paddingLeft: '2.5rem' }}
                    value={user?.email || ''}
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Contact super admin to change email</p>
              </div>
              <PhoneInput
                phone={formData.phone}
                countryCode={formData.countryCode}
                onPhoneChange={(val) => setFormData(prev => ({ ...prev, phone: val }))}
                onCountryCodeChange={(code) => setFormData(prev => ({ ...prev, countryCode: code }))}
                label="Phone Number"
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Information</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Role</span>
                </div>
                <Badge variant={getRoleBadgeVariant(user?.role)}>
                  {getRoleDisplayName(user?.role)}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Department</span>
                </div>
                <span className="font-medium text-gray-900">{admin?.department || 'Not assigned'}</span>
              </div>
              <div className="p-4 bg-primary-50 rounded-xl">
                <p className="text-sm text-primary-600 font-medium">Role Permissions</p>
                <p className="text-sm text-gray-600 mt-1">
                  Your role determines what actions you can perform in the system.
                  Contact a super admin to request permission changes.
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
                  <Shield className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Role</span>
                </div>
                <Badge variant={getRoleBadgeVariant(user?.role)}>
                  {getRoleDisplayName(user?.role)}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Admin ID</span>
                </div>
                <span className="font-medium text-gray-900 text-sm">
                  {admin?.id?.slice(0, 8) || 'N/A'}...
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Role level</span>
                  <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
                    {getRoleDisplayName(user?.role)}
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
