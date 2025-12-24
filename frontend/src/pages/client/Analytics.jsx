import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Target,
  Zap,
  Award,
  Coffee,
  Monitor,
  Wifi,
  MapPin,
  Star
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../../components/common';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('month');
  const [selectedTeam, setSelectedTeam] = useState('all');

  // Stats Overview
  const stats = [
    {
      title: 'Active Workforce',
      value: '145',
      subtext: '12 online now',
      change: '+8',
      trend: 'up',
      icon: Users,
      gradient: 'from-primary to-primary-light'
    },
    {
      title: 'Hours This Month',
      value: '5,832',
      subtext: 'Target: 6,000 hrs',
      change: '+12.5%',
      trend: 'up',
      icon: Clock,
      gradient: 'from-secondary to-secondary-light'
    },
    {
      title: 'Productivity Score',
      value: '94.2%',
      subtext: 'Above average',
      change: '+3.2%',
      trend: 'up',
      icon: Target,
      gradient: 'from-accent to-accent-light'
    },
    {
      title: 'Cost Savings',
      value: '$28,450',
      subtext: 'vs in-office',
      change: '+15%',
      trend: 'up',
      icon: DollarSign,
      gradient: 'from-green-500 to-green-400'
    }
  ];

  // Employee activity data
  const weeklyActivity = [
    { day: 'Mon', hours: 1160, target: 1200 },
    { day: 'Tue', hours: 1180, target: 1200 },
    { day: 'Wed', hours: 1220, target: 1200 },
    { day: 'Thu', hours: 1150, target: 1200 },
    { day: 'Fri', hours: 1122, target: 1200 }
  ];

  // Top performers
  const topPerformers = [
    { name: 'Sarah Johnson', role: 'Senior Developer', hours: 42, productivity: 98, avatar: 'SJ', status: 'online' },
    { name: 'Mike Chen', role: 'UI/UX Designer', hours: 40, productivity: 96, avatar: 'MC', status: 'online' },
    { name: 'Emily Davis', role: 'Project Manager', hours: 41, productivity: 95, avatar: 'ED', status: 'away' },
    { name: 'James Wilson', role: 'Backend Developer', hours: 39, productivity: 94, avatar: 'JW', status: 'online' },
    { name: 'Lisa Anderson', role: 'QA Engineer', hours: 38, productivity: 93, avatar: 'LA', status: 'offline' }
  ];

  // Team breakdown
  const teams = [
    { name: 'Development', members: 48, hours: 1920, utilization: 92, color: 'primary' },
    { name: 'Design', members: 24, hours: 960, utilization: 88, color: 'secondary' },
    { name: 'Marketing', members: 32, hours: 1280, utilization: 85, color: 'accent' },
    { name: 'Support', members: 28, hours: 1120, utilization: 90, color: 'info' },
    { name: 'Operations', members: 13, hours: 520, utilization: 87, color: 'success' }
  ];

  // Time distribution
  const timeDistribution = [
    { category: 'Productive Work', percentage: 72, color: 'bg-green-500' },
    { category: 'Meetings', percentage: 15, color: 'bg-blue-500' },
    { category: 'Breaks', percentage: 8, color: 'bg-yellow-500' },
    { category: 'Administrative', percentage: 5, color: 'bg-gray-400' }
  ];

  // Location insights
  const locationData = [
    { city: 'New York', employees: 32, avgHours: 38.5 },
    { city: 'San Francisco', employees: 28, avgHours: 39.2 },
    { city: 'Chicago', employees: 24, avgHours: 37.8 },
    { city: 'Austin', employees: 18, avgHours: 40.1 },
    { city: 'Remote (Other)', employees: 43, avgHours: 38.9 }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Virtual Office Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary-dark to-primary p-6 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute bottom-4 left-20 w-20 h-20 border-4 border-white rounded-full" />
          <div className="absolute top-1/2 right-1/3 w-16 h-16 border-4 border-white rounded-full" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-6 h-6" />
                <span className="text-primary-100 text-sm font-medium">Virtual Office Analytics</span>
              </div>
              <h1 className="text-3xl font-bold font-heading">Workforce Performance</h1>
              <p className="text-primary-100 mt-1">Real-time insights into your remote team's productivity</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">12 Online Now</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Range Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['week', 'month', 'quarter', 'year'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              timeRange === range
                ? 'bg-primary text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden group hover:shadow-xl transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.subtext}</p>
                </div>
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className={`flex items-center gap-1 mt-3 text-sm ${
                stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                <span className="font-semibold">{stat.change}</span>
                <span className="text-gray-400">vs last {timeRange}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Weekly Activity Overview
              </CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-gray-500">Actual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-gray-500">Target</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyActivity.map((day) => {
                const percentage = (day.hours / day.target) * 100;
                const isOverTarget = day.hours >= day.target;
                return (
                  <div key={day.day} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 w-12">{day.day}</span>
                      <span className="text-sm text-gray-500">{day.hours} / {day.target} hrs</span>
                    </div>
                    <div className="relative h-8 bg-gray-100 rounded-xl overflow-hidden">
                      <div className="absolute inset-0 flex items-center">
                        <div
                          className={`h-full rounded-xl transition-all ${
                            isOverTarget
                              ? 'bg-gradient-to-r from-green-500 to-green-400'
                              : 'bg-gradient-to-r from-primary to-primary-light'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                        style={{ left: '100%' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-3">
                        <span className={`text-sm font-bold ${percentage >= 100 ? 'text-white' : 'text-gray-600'}`}>
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Time Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Donut Chart Visualization */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {timeDistribution.reduce((acc, item, index) => {
                  const previousTotal = timeDistribution.slice(0, index).reduce((sum, i) => sum + i.percentage, 0);
                  const circumference = 2 * Math.PI * 35;
                  const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -((previousTotal / 100) * circumference);

                  acc.push(
                    <circle
                      key={item.category}
                      cx="50"
                      cy="50"
                      r="35"
                      fill="none"
                      strokeWidth="12"
                      className={item.color.replace('bg-', 'stroke-')}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  );
                  return acc;
                }, [])}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">72%</p>
                  <p className="text-xs text-gray-500">Productive</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {timeDistribution.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm text-gray-600">{item.category}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teams & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                Team Performance
              </CardTitle>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Teams</option>
                {teams.map(team => (
                  <option key={team.name} value={team.name}>{team.name}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.name} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-${team.color}-100 flex items-center justify-center`}>
                        <Users className={`w-5 h-5 text-${team.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{team.name}</p>
                        <p className="text-sm text-gray-500">{team.members} members</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{team.hours} hrs</p>
                      <p className="text-sm text-gray-500">{team.utilization}% utilized</p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${team.color} rounded-full transition-all`}
                      style={{ width: `${team.utilization}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Top Performers
              </CardTitle>
              <Badge variant="accent">This Week</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <div
                  key={performer.name}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-all hover:bg-gray-50 ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' : ''
                  }`}
                >
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary ${
                      index === 0 ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
                    }`}>
                      {performer.avatar}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(performer.status)}`} />
                    {index === 0 && (
                      <div className="absolute -top-1 -right-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{performer.name}</p>
                      {index < 3 && (
                        <Badge variant={index === 0 ? 'accent' : 'primary'} size="xs">
                          #{index + 1}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{performer.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{performer.hours}h</p>
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Zap className="w-3 h-3" />
                      {performer.productivity}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Remote Workforce Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {locationData.map((location) => (
              <div key={location.city} className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-gray-900">{location.city}</p>
                <p className="text-2xl font-bold text-primary mt-1">{location.employees}</p>
                <p className="text-xs text-gray-500">employees</p>
                <div className="mt-2 text-sm text-gray-600">
                  Avg: {location.avgHours}h/week
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
