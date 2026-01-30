import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../../components/common';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('month');

  // Stats Overview
  const stats = [
    {
      title: 'Total Employees',
      value: '1,247',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'primary'
    },
    {
      title: 'Active Clients',
      value: '89',
      change: '+8.2%',
      trend: 'up',
      icon: Building2,
      color: 'secondary'
    },
    {
      title: 'Hours Logged',
      value: '45,832',
      change: '+15.3%',
      trend: 'up',
      icon: Clock,
      color: 'accent'
    },
    {
      title: 'Payroll Total',
      value: '$892,450',
      change: '+5.8%',
      trend: 'up',
      icon: DollarSign,
      color: 'success'
    }
  ];

  // Monthly data for chart
  const monthlyData = [
    { month: 'Jan', hours: 3200, employees: 980, revenue: 68000 },
    { month: 'Feb', hours: 3450, employees: 1020, revenue: 72000 },
    { month: 'Mar', hours: 3800, employees: 1080, revenue: 78000 },
    { month: 'Apr', hours: 3600, employees: 1120, revenue: 75000 },
    { month: 'May', hours: 4100, employees: 1180, revenue: 85000 },
    { month: 'Jun', hours: 4350, employees: 1200, revenue: 89000 },
    { month: 'Jul', hours: 4200, employees: 1220, revenue: 87000 },
    { month: 'Aug', hours: 4500, employees: 1240, revenue: 92000 },
    { month: 'Sep', hours: 4300, employees: 1230, revenue: 88000 },
    { month: 'Oct', hours: 4600, employees: 1245, revenue: 94000 },
    { month: 'Nov', hours: 4450, employees: 1247, revenue: 91000 },
    { month: 'Dec', hours: 4700, employees: 1250, revenue: 96000 }
  ];

  const maxHours = Math.max(...monthlyData.map(d => d.hours));

  // Department breakdown
  const departments = [
    { name: 'Engineering', employees: 320, hours: 12800, percentage: 28 },
    { name: 'Sales', employees: 180, hours: 7200, percentage: 16 },
    { name: 'Marketing', employees: 120, hours: 4800, percentage: 10 },
    { name: 'Operations', employees: 280, hours: 11200, percentage: 24 },
    { name: 'Support', employees: 200, hours: 8000, percentage: 17 },
    { name: 'HR & Admin', employees: 60, hours: 2400, percentage: 5 }
  ];

  // Client performance
  const topClients = [
    { name: 'ABC Corporation', employees: 145, hours: 5800, revenue: '$125,000', trend: 'up' },
    { name: 'Tech Solutions Inc', employees: 98, hours: 3920, revenue: '$89,000', trend: 'up' },
    { name: 'Global Services Ltd', employees: 76, hours: 3040, revenue: '$72,000', trend: 'down' },
    { name: 'Innovation Labs', employees: 65, hours: 2600, revenue: '$58,000', trend: 'up' },
    { name: 'Digital Dynamics', employees: 52, hours: 2080, revenue: '$48,000', trend: 'up' }
  ];

  // Approval metrics
  const approvalMetrics = {
    pending: 45,
    approved: 892,
    rejected: 23,
    avgTime: '4.2 hrs'
  };

  // Attendance overview
  const attendanceData = [
    { day: 'Mon', present: 1180, absent: 45, late: 22 },
    { day: 'Tue', present: 1195, absent: 32, late: 20 },
    { day: 'Wed', present: 1200, absent: 28, late: 19 },
    { day: 'Thu', present: 1175, absent: 52, late: 20 },
    { day: 'Fri', present: 1150, absent: 72, late: 25 }
  ];

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
          {['week', 'month', 'quarter', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                timeRange === range
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
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
                    <span className="text-gray-400">vs last {timeRange}</span>
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
                Hours Logged Trend
              </CardTitle>
              <Badge variant="primary">+15.3% growth</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-64">
              {monthlyData.map((data) => (
                <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{(data.hours / 1000).toFixed(1)}k</span>
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary-light rounded-t-lg transition-all hover:from-primary-dark hover:to-primary cursor-pointer relative group"
                      style={{ height: `${(data.hours / maxHours) * 180}px` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {data.hours.toLocaleString()} hrs
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{data.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-secondary" />
              Department Distribution
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
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[index]} rounded-full transition-all`}
                        style={{ width: `${dept.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{dept.employees} employees</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent" />
                Top Performing Clients
              </CardTitle>
              <Button variant="ghost" size="sm">View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topClients.map((client, index) => (
                <div key={client.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                    <p className="text-sm text-gray-500">{client.employees} employees • {client.hours.toLocaleString()} hrs</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{client.revenue}</p>
                    <div className={`flex items-center justify-end gap-1 text-xs ${
                      client.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {client.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {client.trend === 'up' ? '+5.2%' : '-2.1%'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Approval Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Approval Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <p className="text-3xl font-bold text-green-700">{approvalMetrics.approved}</p>
                <p className="text-sm text-green-600 mt-1">93% approval rate</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                <div className="flex items-center gap-2 text-yellow-600 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <p className="text-3xl font-bold text-yellow-700">{approvalMetrics.pending}</p>
                <p className="text-sm text-yellow-600 mt-1">Needs attention</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Rejected</span>
                </div>
                <p className="text-3xl font-bold text-red-700">{approvalMetrics.rejected}</p>
                <p className="text-sm text-red-600 mt-1">2.4% rejection rate</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">Avg. Time</span>
                </div>
                <p className="text-3xl font-bold text-blue-700">{approvalMetrics.avgTime}</p>
                <p className="text-sm text-blue-600 mt-1">Response time</p>
              </div>
            </div>

            {/* Approval Trend */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Weekly Trend</p>
              <div className="flex items-end gap-1 h-20">
                {[65, 78, 82, 70, 88, 92, 85].map((value, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t transition-all hover:from-green-600 hover:to-green-500"
                      style={{ height: `${value}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Attendance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Weekly Attendance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Day</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Present</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Absent</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Late</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((day) => {
                    const total = day.present + day.absent + day.late;
                    const rate = ((day.present / total) * 100).toFixed(1);
                    return (
                      <tr key={day.day} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{day.day}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="success">{day.present}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="danger">{day.absent}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="warning">{day.late}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-12">{rate}%</span>
                          </div>
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
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-600">Avg. Hours/Employee</p>
                    <p className="text-2xl font-bold text-primary-700">36.8 hrs</p>
                  </div>
                  <Target className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-secondary-50 to-secondary-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary-600">Overtime Hours</p>
                    <p className="text-2xl font-bold text-secondary-700">2,450 hrs</p>
                  </div>
                  <Clock className="w-8 h-8 text-secondary" />
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-accent-50 to-accent-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-accent-600">Active Projects</p>
                    <p className="text-2xl font-bold text-accent-700">127</p>
                  </div>
                  <Briefcase className="w-8 h-8 text-accent" />
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Productivity Score</p>
                    <p className="text-2xl font-bold text-green-700">94.2%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
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
