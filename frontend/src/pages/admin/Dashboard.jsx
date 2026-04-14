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
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, StatCard, Badge, Button, Avatar, RefreshButton } from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';
import supportTicketService from '../../services/supportTicket.service';

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
  const [tickets, setTickets] = useState([]);
  const [unapprovedOT, setUnapprovedOT] = useState(null);
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
      const [statsRes, activityRes, actionsRes, clientsRes, payrollRes, unapprovedOTRes, ticketsRes] = await Promise.all([
        adminPortalService.getDashboardStats(),
        adminPortalService.getRecentActivity(5),
        adminPortalService.getPendingActions(),
        adminPortalService.getClientOverview(),
        adminPortalService.getPayrollReadiness(),
        adminPortalService.getClientWiseUnapprovedOT(),
        supportTicketService.getTickets({ status: 'OPEN,IN_PROGRESS', limit: 5 }),
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
      if (unapprovedOTRes?.success && unapprovedOTRes.data.totalCount > 0) {
        setUnapprovedOT(unapprovedOTRes.data);
      } else {
        setUnapprovedOT(null);
      }
      if (ticketsRes?.success) {
        setTickets(ticketsRes.data?.tickets || []);
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
          <RefreshButton onClick={fetchDashboardData} />
          {/* <Button variant="primary">Quick Actions</Button> */}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-700">{stats.totalEmployees}</p>
            <p className="text-xs text-blue-600">Employees</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Building className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-indigo-700">{stats.totalClients}</p>
            <p className="text-xs text-indigo-600">Clients</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-yellow-700">{stats.pendingApprovals}</p>
            <p className="text-xs text-yellow-600">Pending Approvals</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-purple-700">{stats.openTickets}</p>
            <p className="text-xs text-purple-600">Open Tickets</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-teal-700">{formatCurrency(stats.weeklyRevenue)}</p>
            <p className="text-xs text-teal-600">Weekly Revenue</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-700">{formatCurrency(stats.monthlyRevenue)}</p>
            <p className="text-xs text-green-600">Monthly Revenue</p>
          </div>
        </div>
      </div>

      {/* Client-wise Unapproved OT Warning */}
      {unapprovedOT && unapprovedOT.clients.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-full flex-shrink-0 mt-0.5">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-red-800">
                Unapproved Overtime — {unapprovedOT.totalCount} {unapprovedOT.totalCount === 1 ? 'Entry' : 'Entries'} Pending
              </h3>
              <p className="text-red-700 mt-1 text-sm">
                Employees have worked overtime without prior approval. These hours affect billing and cannot be processed until clients approve or deny.
              </p>
              <div className="mt-3 space-y-2">
                {unapprovedOT.clients.slice(0, 3).map((client) => (
                  <div key={client.clientId} className="bg-white/70 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-red-900 text-sm">{client.clientName}</span>
                      <span className="text-sm font-bold text-red-700">{client.totalHours} — {client.count} {client.count === 1 ? 'entry' : 'entries'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {client.employees.slice(0, 5).map((emp, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                          {emp.name} — {emp.hours}
                        </span>
                      ))}
                      {client.employees.length > 5 && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded-full">
                          +{client.employees.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {unapprovedOT.clients.length > 3 && (
                  <p className="text-sm text-red-700 font-medium">
                    +{unapprovedOT.clients.length - 3} more client{unapprovedOT.clients.length - 3 > 1 ? 's' : ''} with unapproved OT
                  </p>
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="danger"
                  size="sm"
                  icon={AlertCircle}
                  onClick={() => navigate('/admin/approvals?type=autoOvertime')}
                >
                  Review All Unapproved OT
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            {clientOverview.some((c) => c.issueCount > 0) && (
              <Button className="view-all-btn" variant="ghost" size="sm" onClick={() => navigate('/admin/approvals')}>View All</Button>
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
                      className="text-sm text-primary font-medium hover:text-primary-dark flex-shrink-0 ml-4 cursor-pointer"
                      onClick={() => navigate(`/admin/approvals?clientId=${client.id}`)}
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

        {/* Support Tickets */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Support Tickets</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/support')}>View All</Button>
          </div>
          <div className="space-y-3">
            {tickets.length > 0 ? (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/support?ticket=${ticket.id}`)}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    ticket.priority === 'URGENT' ? 'bg-red-100' :
                    ticket.priority === 'HIGH' ? 'bg-orange-100' :
                    ticket.priority === 'MEDIUM' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    <MessageSquare className={`w-4 h-4 ${
                      ticket.priority === 'URGENT' ? 'text-red-600' :
                      ticket.priority === 'HIGH' ? 'text-orange-600' :
                      ticket.priority === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-500">
                      {ticket.employee?.firstName} {ticket.employee?.lastName}
                      {' · '}
                      {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ticket.status === 'OPEN' ? 'warning' :
                      ticket.status === 'IN_PROGRESS' ? 'info' :
                      ticket.status === 'RESOLVED' ? 'success' : 'default'
                    }
                    size="sm"
                  >
                    {ticket.status === 'IN_PROGRESS' ? 'In Progress' : ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No open tickets</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
