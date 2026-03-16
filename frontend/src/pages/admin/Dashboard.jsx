import { useState, useEffect, useRef } from 'react';
import {
  Users,
  Building,
  Clock,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Activity,
  TrendingUp,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, StatCard, Badge, Button, Avatar } from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalClients: 0,
    activeNow: 0,
    pendingApprovals: 0,
    pendingLeaveRequests: 0,
    openTickets: 0,
    weeklyHours: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [clientOverview, setClientOverview] = useState([]);
  const [payrollReadiness, setPayrollReadiness] = useState({
    approvedHours: 0,
    pendingHours: 0,
    approvedPercentage: 0,
    payrollCutoff: '',
    daysUntilCutoff: 0,
  });

  const fetchingRef = useRef(false);

  const fetchDashboardData = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const [statsRes, activityRes, actionsRes, clientsRes, payrollRes] = await Promise.all([
        adminPortalService.getDashboardStats(),
        adminPortalService.getRecentActivity(5),
        adminPortalService.getPendingActions(),
        adminPortalService.getClientOverview(),
        adminPortalService.getPayrollReadiness(),
      ]);

      if (statsRes?.success) {
        setStats(statsRes.data);
      }
      if (activityRes?.success) {
        setRecentActivity(activityRes.data);
      }
      if (actionsRes?.success) {
        setPendingActions(actionsRes.data);
      }
      if (clientsRes?.success) {
        setClientOverview(clientsRes.data);
      }
      if (payrollRes?.success) {
        setPayrollReadiness(payrollRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operations Dashboard</h2>
          <p className="text-gray-500">System-wide overview and management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchDashboardData} icon={RefreshCw}>
            Refresh
          </Button>
          {/* <Button variant="primary">Quick Actions</Button> */}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats.totalEmployees}</p>
            <p className="text-xs text-gray-500">Employees</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl flex-shrink-0">
            <Building className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats.totalClients}</p>
            <p className="text-xs text-gray-500">Clients</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-yellow-50 rounded-xl flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats.pendingApprovals}</p>
            <p className="text-xs text-gray-500">Pending Approvals</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats.openTickets}</p>
            <p className="text-xs text-gray-500">Open Tickets</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-xl flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.weeklyRevenue)}</p>
            <p className="text-xs text-gray-500">Weekly Revenue</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl flex-shrink-0">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.monthlyRevenue)}</p>
            <p className="text-xs text-gray-500">Monthly Revenue</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Actions */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Required</h3>
          <div className="space-y-3">
            {pendingActions.length > 0 ? (
              pendingActions.map((action) => (
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
              ))
            ) : (
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-700">All caught up!</p>
              </div>
            )}
          </div>
        </Card>

        {/* Client Overview */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Client Overview</h3>
            {clientOverview.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/approvals')}>View All</Button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {clientOverview.length > 0 ? (
              clientOverview.slice(0, 5).map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      client.severity === 'red' ? 'bg-red-500' :
                      client.severity === 'yellow' ? 'bg-yellow-500' :
                      client.severity === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <span className="font-semibold text-gray-900">{client.name}</span>
                      {client.issues ? (
                        <span className="text-sm text-gray-500"> — {client.issues}</span>
                      ) : (
                        <span className="text-sm text-gray-400"> — No issues</span>
                      )}
                    </div>
                  </div>
                  {client.issueCount > 0 && (
                    <button
                      className="text-sm text-primary font-medium hover:text-primary-dark flex-shrink-0 ml-4"
                      onClick={() => navigate(`/admin/approvals`)}
                    >
                      View →
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-500">
                <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No clients found</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity & Payroll Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/time-records')}>View All</Button>
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
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
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </Card>

        {/* Payroll Status */}
        {/* <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Readiness</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">Approved Hours</span>
                <span className="font-semibold text-green-600">{payrollReadiness.approvedHours.toLocaleString()}h</span>
              </div>
              <div className="w-full h-2 bg-green-200 rounded-full">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${payrollReadiness.approvedPercentage}%` }}
                />
              </div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">Pending Approval</span>
                <span className="font-semibold text-yellow-600">{payrollReadiness.pendingHours.toLocaleString()}h</span>
              </div>
              <div className="w-full h-2 bg-yellow-200 rounded-full">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{ width: `${100 - payrollReadiness.approvedPercentage}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Payroll Cutoff</p>
                <p className="text-sm text-gray-500">
                  {payrollReadiness.payrollCutoff
                    ? new Date(payrollReadiness.payrollCutoff).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Not set'}
                </p>
              </div>
              <Badge variant={payrollReadiness.daysUntilCutoff <= 1 ? 'danger' : 'warning'}>
                {payrollReadiness.daysUntilCutoff} Day{payrollReadiness.daysUntilCutoff !== 1 ? 's' : ''} Left
              </Badge>
            </div>
            <Button variant="primary" fullWidth>
              Process Payroll
            </Button>
          </div>
        </Card> */}
      </div>
    </div>
  );
};

export default AdminDashboard;
