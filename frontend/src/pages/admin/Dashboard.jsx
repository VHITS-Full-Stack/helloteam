import {
  Users,
  Building,
  Clock,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Activity,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { Card, StatCard, Badge, Button, Avatar } from '../../components/common';

const AdminDashboard = () => {
  const stats = {
    totalEmployees: 48,
    totalClients: 12,
    activeNow: 32,
    pendingApprovals: 15,
    pendingLeave: 8,
    openTickets: 5,
    weeklyHours: 1840,
    monthlyRevenue: '$156,000',
  };

  const recentActivity = [
    { id: 1, type: 'approval', message: 'Client ABC approved 8 hours for John Doe', time: '5 min ago' },
    { id: 2, type: 'clock-in', message: 'Jane Smith clocked in', time: '12 min ago' },
    { id: 3, type: 'leave', message: 'Mike Johnson requested 2 days leave', time: '30 min ago' },
    { id: 4, type: 'ticket', message: 'New support ticket from Sarah Williams', time: '1 hour ago' },
    { id: 5, type: 'client', message: 'New client XYZ Corp added', time: '2 hours ago' },
  ];

  const pendingActions = [
    { id: 1, type: 'payroll', title: 'Payroll Deadline', description: 'Weekly payroll cutoff in 2 days', priority: 'high' },
    { id: 2, type: 'approval', title: '15 Pending Approvals', description: 'From 5 different clients', priority: 'medium' },
    { id: 3, type: 'leave', title: '8 Leave Requests', description: 'Awaiting final approval', priority: 'medium' },
    { id: 4, type: 'ticket', title: '5 Open Tickets', description: 'Employee support requests', priority: 'low' },
  ];

  const clientOverview = [
    { id: 1, name: 'ABC Corporation', employees: 8, activeNow: 6, pendingApprovals: 3, status: 'healthy' },
    { id: 2, name: 'XYZ Tech', employees: 12, activeNow: 10, pendingApprovals: 5, status: 'warning' },
    { id: 3, name: 'Global Services', employees: 6, activeNow: 4, pendingApprovals: 0, status: 'healthy' },
    { id: 4, name: 'Startup Inc', employees: 4, activeNow: 3, pendingApprovals: 2, status: 'healthy' },
  ];

  const getActivityIcon = (type) => {
    switch (type) {
      case 'approval': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'clock-in': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'leave': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'ticket': return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'client': return <Building className="w-4 h-4 text-primary" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operations Dashboard</h2>
          <p className="text-gray-500">System-wide overview and management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">Generate Report</Button>
          <Button variant="primary">Quick Actions</Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <StatCard title="Employees" value={stats.totalEmployees} icon={Users} />
        <StatCard title="Clients" value={stats.totalClients} icon={Building} />
        <StatCard title="Active Now" value={stats.activeNow} icon={Activity} />
        <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={AlertCircle} />
        <StatCard title="Leave Requests" value={stats.pendingLeave} icon={Clock} />
        <StatCard title="Open Tickets" value={stats.openTickets} icon={MessageSquare} />
        <StatCard title="Weekly Hours" value={stats.weeklyHours} icon={Clock} />
        <StatCard title="Monthly Revenue" value={stats.monthlyRevenue} icon={DollarSign} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Actions */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Required</h3>
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className={`p-4 rounded-lg border-l-4 ${
                  action.priority === 'high' ? 'border-red-500 bg-red-50' :
                  action.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{action.title}</p>
                    <p className="text-sm text-gray-500">{action.description}</p>
                  </div>
                  <Badge
                    variant={
                      action.priority === 'high' ? 'danger' :
                      action.priority === 'medium' ? 'warning' : 'info'
                    }
                    size="sm"
                  >
                    {action.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Client Overview */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Client Overview</h3>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
          <div className="space-y-3">
            {clientOverview.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <p className="text-sm text-gray-500">{client.employees} employees</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="font-semibold text-green-600">{client.activeNow}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className={`font-semibold ${client.pendingApprovals > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {client.pendingApprovals}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    client.status === 'healthy' ? 'bg-green-500' :
                    client.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity & Payroll Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="p-2 bg-gray-100 rounded-lg">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Payroll Status */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Readiness</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">Approved Hours</span>
                <span className="font-semibold text-green-600">1,640h</span>
              </div>
              <div className="w-full h-2 bg-green-200 rounded-full">
                <div className="w-4/5 h-full bg-green-500 rounded-full" />
              </div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">Pending Approval</span>
                <span className="font-semibold text-yellow-600">200h</span>
              </div>
              <div className="w-full h-2 bg-yellow-200 rounded-full">
                <div className="w-1/5 h-full bg-yellow-500 rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Payroll Cutoff</p>
                <p className="text-sm text-gray-500">Friday, Dec 20, 2025 at 6:00 PM</p>
              </div>
              <Badge variant="warning">2 Days Left</Badge>
            </div>
            <Button variant="primary" fullWidth>
              Process Payroll
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
