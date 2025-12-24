import { useState } from 'react';
import {
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Activity,
  Eye
} from 'lucide-react';
import { Card, StatCard, Badge, Button, Avatar } from '../../components/common';

const ClientDashboard = () => {
  const stats = {
    totalEmployees: 12,
    activeNow: 8,
    pendingApprovals: 5,
    weeklyHours: 384,
    monthlyBilling: '$24,500',
  };

  const activeEmployees = [
    { id: 1, name: 'John Doe', role: 'Developer', status: 'working', duration: '4h 32m', productivity: 92 },
    { id: 2, name: 'Jane Smith', role: 'Designer', status: 'working', duration: '3h 15m', productivity: 88 },
    { id: 3, name: 'Mike Johnson', role: 'Developer', status: 'break', duration: '5h 10m', productivity: 95 },
    { id: 4, name: 'Sarah Williams', role: 'QA Engineer', status: 'working', duration: '2h 45m', productivity: 90 },
    { id: 5, name: 'David Brown', role: 'Developer', status: 'working', duration: '4h 00m', productivity: 85 },
  ];

  const pendingItems = [
    { id: 1, type: 'overtime', employee: 'John Doe', hours: 4, date: '2025-12-18' },
    { id: 2, type: 'time-entry', employee: 'Jane Smith', hours: 8, date: '2025-12-17' },
    { id: 3, type: 'leave', employee: 'Mike Johnson', days: 2, date: '2025-12-20 - 2025-12-21' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back!</h2>
          <p className="text-gray-500">Here's what's happening with your team today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={Eye}>View Reports</Button>
          <Button variant="primary" icon={CheckCircle}>Approve All</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon={Users}
        />
        <StatCard
          title="Active Now"
          value={stats.activeNow}
          icon={Activity}
          description="Currently working"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={AlertCircle}
          description="Action required"
        />
        <StatCard
          title="Weekly Hours"
          value={stats.weeklyHours}
          icon={Clock}
          description="Total logged"
        />
        <StatCard
          title="Monthly Billing"
          value={stats.monthlyBilling}
          icon={DollarSign}
          description="Estimated"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Workforce */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Active Workforce</h3>
              <Button variant="ghost" size="sm">View All</Button>
            </div>
            <div className="space-y-3">
              {activeEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={employee.name}
                      status={employee.status === 'working' ? 'online' : employee.status === 'break' ? 'away' : 'offline'}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{employee.name}</p>
                      <p className="text-sm text-gray-500">{employee.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Today</p>
                      <p className="font-semibold text-gray-900">{employee.duration}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Productivity</p>
                      <p className={`font-semibold ${
                        employee.productivity >= 90 ? 'text-green-600' :
                        employee.productivity >= 80 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {employee.productivity}%
                      </p>
                    </div>
                    <Badge
                      variant={employee.status === 'working' ? 'success' : 'warning'}
                      dot
                    >
                      {employee.status === 'working' ? 'Working' : 'On Break'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Pending Actions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Actions</h3>
            <Badge variant="danger">{pendingItems.length}</Badge>
          </div>
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="p-4 border border-gray-100 rounded-lg hover:border-primary-200 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Badge
                      variant={
                        item.type === 'overtime' ? 'warning' :
                        item.type === 'leave' ? 'info' : 'default'
                      }
                      size="sm"
                    >
                      {item.type === 'overtime' ? 'Overtime' :
                       item.type === 'leave' ? 'Leave Request' : 'Time Entry'}
                    </Badge>
                  </div>
                </div>
                <p className="font-medium text-gray-900">{item.employee}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {item.hours ? `${item.hours} hours` : `${item.days} days`} - {item.date}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button variant="primary" size="sm" fullWidth>Approve</Button>
                  <Button variant="ghost" size="sm" fullWidth>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Weekly Overview */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Hours Overview</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-gray-500">Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-gray-500">Pending</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-4">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
            const approved = [64, 72, 68, 70, 0, 0, 0][index];
            const pending = [0, 0, 8, 4, 72, 0, 0][index];
            const total = approved + pending;
            const maxHours = 96; // 12 employees * 8 hours

            return (
              <div key={day} className="text-center">
                <p className="text-sm text-gray-500 mb-2">{day}</p>
                <div className="h-32 bg-gray-100 rounded-lg relative overflow-hidden">
                  {total > 0 && (
                    <>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary transition-all"
                        style={{ height: `${(approved / maxHours) * 100}%` }}
                      />
                      <div
                        className="absolute left-0 right-0 bg-yellow-400 transition-all"
                        style={{
                          bottom: `${(approved / maxHours) * 100}%`,
                          height: `${(pending / maxHours) * 100}%`
                        }}
                      />
                    </>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 mt-2">{total}h</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default ClientDashboard;
