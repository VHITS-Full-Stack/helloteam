import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Users,
  Clock,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Award,
  Zap,
  Monitor,
  Wifi,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [analyticsData, setAnalyticsData] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getAnalytics({ period: timeRange });
      if (response.success) {
        setAnalyticsData(response.data);
      } else {
        setError(response.error || 'Failed to load analytics');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const overview = analyticsData?.overview || {
    activeWorkforce: 0,
    onlineNow: 0,
    hoursThisPeriod: 0,
    hoursChange: 0,
    productivity: 0,
  };

  const weeklyActivity = analyticsData?.weeklyActivity || [];
  const topPerformers = analyticsData?.topPerformers || [];

  // Stats overview
  const stats = [
    {
      title: 'Active Workforce',
      value: overview.activeWorkforce.toString(),
      subtext: `${overview.onlineNow} online now`,
      change: '+0',
      trend: 'up',
      icon: Users,
      gradient: 'from-primary to-primary-light'
    },
    {
      title: `Hours This ${timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}`,
      value: overview.hoursThisPeriod.toLocaleString(),
      subtext: 'Total work hours',
      change: overview.hoursChange > 0 ? `+${overview.hoursChange}%` : `${overview.hoursChange}%`,
      trend: overview.hoursChange >= 0 ? 'up' : 'down',
      icon: Clock,
      gradient: 'from-secondary to-secondary-light'
    },
    {
      title: 'Productivity Score',
      value: `${overview.productivity}%`,
      subtext: 'Approved hours ratio',
      change: overview.productivity >= 90 ? 'Excellent' : 'Good',
      trend: 'up',
      icon: Target,
      gradient: 'from-accent to-accent-light'
    },
  ];

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
                <span className="text-primary-100 text-sm font-medium">Workforce Analytics</span>
              </div>
              <h1 className="text-3xl font-bold font-heading">Workforce Performance</h1>
              <p className="text-primary-100 mt-1">Real-time insights into your team's productivity</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">{overview.onlineNow} Online Now</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={fetchAnalytics} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              {weeklyActivity.length > 0 ? weeklyActivity.map((day) => {
                const percentage = day.target > 0 ? (day.hours / day.target) * 100 : 0;
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
                      <div className="absolute inset-0 flex items-center justify-end pr-3">
                        <span className={`text-sm font-bold ${percentage >= 50 ? 'text-white' : 'text-gray-600'}`}>
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8 text-gray-500">
                  No activity data available for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Productivity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Productivity Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="35"
                  fill="none"
                  strokeWidth="12"
                  className="stroke-gray-200"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="35"
                  fill="none"
                  strokeWidth="12"
                  className="stroke-green-500"
                  strokeDasharray={`${(overview.productivity / 100) * 220} 220`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{overview.productivity}%</p>
                  <p className="text-xs text-gray-500">Approved</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Total Hours</span>
                <span className="text-sm font-semibold text-gray-900">{overview.hoursThisPeriod}h</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Active Employees</span>
                <span className="text-sm font-semibold text-gray-900">{overview.activeWorkforce}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Currently Online</span>
                <span className="text-sm font-semibold text-green-600">{overview.onlineNow}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Top Performers
            </CardTitle>
            <Badge variant="accent">This {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {topPerformers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {topPerformers.map((performer, index) => (
                <div
                  key={performer.id}
                  className={`flex flex-col items-center p-4 rounded-xl transition-all hover:bg-gray-50 ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' : ''
                  }`}
                >
                  <div className="relative mb-3">
                    <div className={`w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center font-bold text-lg text-primary ${
                      index === 0 ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
                    }`}>
                      {performer.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    {index < 3 && (
                      <div className="absolute -top-1 -right-1">
                        <Badge variant={index === 0 ? 'accent' : 'primary'} size="xs">
                          #{index + 1}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-center truncate w-full">{performer.name}</p>
                  <p className="text-xl font-bold text-primary mt-1">{performer.hours}h</p>
                  <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                    <Zap className="w-3 h-3" />
                    {performer.productivity}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No performer data available for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
