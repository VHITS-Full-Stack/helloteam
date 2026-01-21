import { useState } from 'react';
import { Building2, Users, Bell, Shield, Globe, Mail, Clock, Save } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('company');

  const companyInfo = {
    name: 'ABC Corporation',
    industry: 'Technology',
    size: '50-100 employees',
    timezone: 'America/New_York',
    address: '123 Business Ave, Suite 500, New York, NY 10001',
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'team', label: 'Team Access', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Globe },
  ];

  const teamMembers = [
    { name: 'John Admin', email: 'john@abccorp.com', role: 'Admin', status: 'active' },
    { name: 'Sarah Manager', email: 'sarah@abccorp.com', role: 'Manager', status: 'active' },
    { name: 'Mike Approver', email: 'mike@abccorp.com', role: 'Approver', status: 'pending' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500">Manage your organization settings and preferences</p>
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
                <div>
                  <label className="label">Company Name</label>
                  <input type="text" className="input" defaultValue={companyInfo.name} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Industry</label>
                    <select className="input" defaultValue={companyInfo.industry}>
                      <option>Technology</option>
                      <option>Healthcare</option>
                      <option>Finance</option>
                      <option>Manufacturing</option>
                      <option>Retail</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Company Size</label>
                    <select className="input" defaultValue={companyInfo.size}>
                      <option>1-10 employees</option>
                      <option>11-50 employees</option>
                      <option>50-100 employees</option>
                      <option>100-500 employees</option>
                      <option>500+ employees</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <select className="input" defaultValue={companyInfo.timezone}>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Business Address</label>
                  <textarea
                    className="input min-h-[80px] resize-none"
                    defaultValue={companyInfo.address}
                  />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'team' && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Team Access</h3>
                <Button variant="primary" size="sm">
                  Invite Member
                </Button>
              </div>
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={member.role === 'Admin' ? 'primary' : 'default'}>
                        {member.role}
                      </Badge>
                      <Badge variant={member.status === 'active' ? 'success' : 'warning'}>
                        {member.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: 'New time entry submissions', description: 'Get notified when employees submit time entries', enabled: true },
                  { label: 'Overtime alerts', description: 'Get alerted when overtime is recorded', enabled: true },
                  { label: 'Leave request notifications', description: 'Get notified of new leave requests', enabled: true },
                  { label: 'Weekly summary reports', description: 'Receive weekly workforce summary', enabled: false },
                  { label: 'Invoice notifications', description: 'Get notified when new invoices are generated', enabled: true },
                ].map((setting, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{setting.label}</p>
                      <p className="text-sm text-gray-500">{setting.description}</p>
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

          {activeTab === 'preferences' && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">System Preferences</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Date Format</label>
                  <select className="input">
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="label">Time Format</label>
                  <select className="input">
                    <option>12-hour (AM/PM)</option>
                    <option>24-hour</option>
                  </select>
                </div>
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
                    <span className="text-gray-500">hours per week</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
