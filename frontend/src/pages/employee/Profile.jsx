import { useState } from 'react';
import { User, Mail, Phone, MapPin, Building2, Calendar, Shield, Camera, Save, Bell, Lock, Eye, EyeOff } from 'lucide-react';
import { Card, Button, Badge, Avatar } from '../../components/common';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('personal');
  const [showPassword, setShowPassword] = useState(false);

  const user = {
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main Street, New York, NY 10001',
    department: 'Engineering',
    position: 'Software Developer',
    employeeId: 'EMP-2024-001',
    startDate: '2024-01-15',
    client: 'ABC Corporation',
    manager: 'Jane Smith',
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'employment', label: 'Employment' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-gray-500">Manage your personal information and preferences</p>
      </div>

      {/* Profile Header Card */}
      <Card>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            <Avatar name={user.name} size="xl" />
            <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{user.name}</h3>
            <p className="text-gray-500">{user.position}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
              <Badge variant="primary">{user.department}</Badge>
              <Badge variant="success">Active</Badge>
              <span className="text-sm text-gray-500">ID: {user.employeeId}</span>
            </div>
          </div>
          <Button variant="primary" icon={Save}>
            Save Changes
          </Button>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" className="input pl-10" defaultValue={user.name} />
                </div>
              </div>
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" className="input pl-10" defaultValue={user.email} />
                </div>
              </div>
              <div>
                <label className="label">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="tel" className="input pl-10" defaultValue={user.phone} />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea className="input pl-10 min-h-[80px] resize-none" defaultValue={user.address} />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Contact Name</label>
                <input type="text" className="input" placeholder="Emergency contact name" />
              </div>
              <div>
                <label className="label">Relationship</label>
                <select className="input">
                  <option>Spouse</option>
                  <option>Parent</option>
                  <option>Sibling</option>
                  <option>Friend</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input type="tel" className="input" placeholder="Emergency contact phone" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'employment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Details</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Department</span>
                </div>
                <span className="font-medium text-gray-900">{user.department}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Position</span>
                </div>
                <span className="font-medium text-gray-900">{user.position}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Start Date</span>
                </div>
                <span className="font-medium text-gray-900">{user.startDate}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Employee ID</span>
                </div>
                <span className="font-medium text-gray-900">{user.employeeId}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h3>
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 rounded-xl">
                <p className="text-sm text-primary-600 font-medium">Current Client</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{user.client}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Reporting Manager</p>
                <p className="font-medium text-gray-900 mt-1">{user.manager}</p>
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
              { label: 'Email notifications for schedule changes', enabled: true },
              { label: 'SMS alerts for shift reminders', enabled: true },
              { label: 'Email notifications for leave approvals', enabled: true },
              { label: 'Push notifications for messages', enabled: false },
              { label: 'Weekly summary email', enabled: true },
            ].map((pref, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-700">{pref.label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={pref.enabled} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
            <div className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" placeholder="Enter new password" />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" placeholder="Confirm new password" />
              </div>
              <Button variant="primary" className="w-full">
                Update Password
              </Button>
            </div>
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
            <Button variant="outline" className="w-full">
              Enable 2FA
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Profile;
