import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Building2,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  RefreshCw,
  PieChart,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Target,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await adminPortalService.getAdminAnalytics();
      if (response.success) {
        setData(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { stats, monthlyData, topClients, approvalMetrics, departments, attendanceData } = data;
  const maxHours = Math.max(...monthlyData.map(d => d.hours), 1);

  const statIcons = {
    'Total Employees': Users,
    'Active Clients': Building2,
    'Active Now': Clock,
    'Monthly Revenue': DollarSign
  };

  const getColorClass = (color) => {
    const colors = {
      primary: 'bg-primary text-white',
      secondary: 'bg-secondary text-gray-900',
      accent: 'bg-accent text-gray-900',
      success: 'bg-success text-white'
    };
    return colors[color] || colors.primary;
  };

  const getBgLight = (color) => {
    const colors = {
      primary: 'bg-primary-50',
      secondary: 'bg-secondary-50',
      accent: 'bg-accent-50',
      success: 'bg-green-50'
    };
    return colors[color] || colors.primary;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Comprehensive overview of your workforce metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            icon={RefreshCw} 
            onClick={fetchAnalytics}
            loading={loading}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = statIcons[stat.title] || TrendingUp;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>{stat.change}</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${getBgLight(stat.color)}`}>
                  <Icon className={`w-6 h-6 ${
                    stat.color === 'primary' ? 'text-primary' :
                    stat.color === 'secondary' ? 'text-secondary-600' :
                    stat.color === 'accent' ? 'text-accent-600' : 'text-green-600'
                  }`} />
                </div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${getColorClass(stat.color)}`} />
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hours Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Workforce Productivity Trend
              </CardTitle>
              <Badge variant="primary">Last 12 Months</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-64">
              {monthlyData.map((data) => (
                <div key={`${data.month}-${data.year}`} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-[10px] text-gray-400 mb-1">{data.hours > 1000 ? `${(data.hours/1000).toFixed(1)}k` : data.hours}</span>
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary-light rounded-t-lg transition-all hover:from-primary-dark hover:to-primary cursor-pointer relative group"
                      style={{ height: `${(data.hours / maxHours) * 180}px`, minHeight: '2px' }}
                    >
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">
                        <div className="font-bold">{data.month} {data.year}</div>
                        <div>Hours: {data.hours.toLocaleString()}</div>
                        <div>Revenue: ${data.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{data.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-secondary" />
              Group Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departments.map((dept, index) => {
                const colors = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-info', 'bg-success', 'bg-warning'];
                return (
                  <div key={dept.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                      <span className="text-sm text-gray-500">{dept.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${colors[index % colors.length]} h-full rounded-full transition-all duration-1000`}
                        style={{ width: `${dept.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {departments.length === 0 && (
                <div className="py-12 text-center text-gray-500 text-sm italic">
                  No groups defined.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              Top Clients (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent padding="none">
            <div className="divide-y divide-gray-100">
              {topClients.map((client) => (
                <div key={client.name} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-bold text-gray-900 truncate">{client.name}</p>
                    <p className="text-xs text-gray-500">{client.employees} active employees</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">${client.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{client.hours} Hours</p>
                  </div>
                </div>
              ))}
              {topClients.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No client activity recorded this month.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Approval Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Approval Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <div className="flex items-center gap-2 text-orange-600 mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Pending</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{approvalMetrics.pending}</p>
                <p className="text-[10px] text-gray-500 mt-1">Awaiting review</p>
              </div>
              <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Approved</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{approvalMetrics.approved}</p>
                <p className="text-[10px] text-gray-500 mt-1">Total processed</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Clock className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Avg Time</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{approvalMetrics.avgTime}</p>
                <p className="text-[10px] text-gray-500 mt-1">Response time</p>
              </div>
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <XCircle className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Rejected</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{approvalMetrics.rejected}</p>
                <p className="text-[10px] text-gray-500 mt-1">Quality metric</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Attendance Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Weekly Attendance Pattern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Day</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Present</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Late</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Absent</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attendanceData.map((day) => {
                    const total = day.present + day.absent;
                    const rate = total > 0 ? ((day.present / total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={day.day} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-900">{day.day}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="success">{day.present}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="warning">{day.late}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="danger">{day.absent}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-sm font-bold ${Number(rate) > 90 ? 'text-green-600' : 'text-orange-600'}`}>{rate}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Performance Scoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-600">Utilization Rate</p>
                    <p className="text-2xl font-bold text-primary-700">92.4%</p>
                  </div>
                  <Target className="w-8 h-8 text-primary/40" />
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-secondary-50 to-secondary-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary-600">Punctuality Score</p>
                    <p className="text-2xl font-bold text-secondary-700">88.5%</p>
                  </div>
                  <Clock className="w-8 h-8 text-secondary/40" />
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-accent-50 to-accent-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-accent-600">Engagement</p>
                    <p className="text-2xl font-bold text-accent-700">95.0%</p>
                  </div>
                  <Briefcase className="w-8 h-8 text-accent/40" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
