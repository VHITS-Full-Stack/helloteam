import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  Pause,
  Square,
  Coffee,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  History,
  Timer,
  Sun,
  Sunrise,
  Moon,
  Building2,
  StickyNote,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Modal } from '../../components/common';
import workSessionService from '../../services/workSession.service';
import { playClockInSound, playClockOutSound, playBreakStartSound, playBreakEndSound } from '../../utils/sounds';
import { formatTime12 } from '../../utils/formatDateTime';

const TimeClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [error, setError] = useState(null);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showPostShiftWarning, setShowPostShiftWarning] = useState(false);
  const [showEarlyClockInWarning, setShowEarlyClockInWarning] = useState(false);
  const [showLateArrivalWarning, setShowLateArrivalWarning] = useState(false);
  const [clockInWarningMessage, setClockInWarningMessage] = useState('');

  // Fetch current session and summaries
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use Promise.allSettled to handle partial failures gracefully
      const [sessionResult, todayResult, weeklyResult, historyResult] = await Promise.allSettled([
        workSessionService.getCurrentSession(),
        workSessionService.getTodaySummary(),
        workSessionService.getWeeklySummary(),
        workSessionService.getSessionHistory({ limit: 5 }),
      ]);

      // Handle session data
      if (sessionResult.status === 'fulfilled') {
        setSessionData(sessionResult.value);
      } else {
        console.error('Failed to fetch current session:', sessionResult.reason);
      }

      // Handle today summary
      if (todayResult.status === 'fulfilled' && todayResult.value?.summary) {
        setTodaySummary(todayResult.value.summary);
      } else if (todayResult.status === 'rejected') {
        console.error('Failed to fetch today summary:', todayResult.reason);
      }

      // Handle weekly summary
      if (weeklyResult.status === 'fulfilled' && weeklyResult.value?.summary) {
        setWeeklySummary(weeklyResult.value.summary);
      } else if (weeklyResult.status === 'rejected') {
        console.error('Failed to fetch weekly summary:', weeklyResult.reason);
      }

      // Handle session history
      if (historyResult.status === 'fulfilled') {
        setSessionHistory(historyResult.value?.sessions || []);
      } else {
        console.error('Failed to fetch session history:', historyResult.reason);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch work session data:', err);
      setError('Failed to load work session data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time display
  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '--:--';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatDurationWithSeconds = (startTime, breaks) => {
    if (!startTime) return '00:00:00';
    const start = new Date(startTime);
    const now = new Date();
    let breakSeconds = 0;
    if (breaks && breaks.length > 0) {
      for (const brk of breaks) {
        const brkStart = new Date(brk.startTime);
        if (brk.endTime) {
          breakSeconds += Math.floor((new Date(brk.endTime).getTime() - brkStart.getTime()) / 1000);
        } else {
          // Ongoing break — count time so far
          breakSeconds += Math.floor((now.getTime() - brkStart.getTime()) / 1000);
        }
      }
    }
    const totalSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000) - breakSeconds);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Sunrise };
    if (hour < 17) return { text: 'Good Afternoon', icon: Sun };
    return { text: 'Good Evening', icon: Moon };
  };

  const greeting = getGreeting();

  // Compute live work/break minutes from session data (recalculates every second via currentTime)
  const liveStats = (() => {
    if (!sessionData?.session?.startTime) return { workMinutes: 0, breakMinutes: 0 };
    const start = new Date(sessionData.session.startTime);
    const elapsed = Math.round((currentTime.getTime() - start.getTime()) / 60000);
    let breakMins = 0;
    if (sessionData.session.breaks) {
      for (const brk of sessionData.session.breaks) {
        if (brk.endTime) {
          breakMins += brk.durationMinutes || Math.round((new Date(brk.endTime).getTime() - new Date(brk.startTime).getTime()) / 60000);
        } else {
          breakMins += Math.round((currentTime.getTime() - new Date(brk.startTime).getTime()) / 60000);
        }
      }
    }
    return { workMinutes: Math.max(0, elapsed - breakMins), breakMinutes: breakMins };
  })();

  // Handle clock in
  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      const response = await workSessionService.clockIn();
      if (response.requiresConfirmation) {
        setClockInWarningMessage(response.message || '');
        if (response.confirmationType === 'EARLY_CLOCK_IN') {
          setShowEarlyClockInWarning(true);
        } else if (response.confirmationType === 'LATE_ARRIVAL') {
          setShowLateArrivalWarning(true);
        } else {
          setShowPostShiftWarning(true);
        }
        return;
      }
      playClockInSound();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed early clock-in
  const handleEarlyClockIn = async () => {
    try {
      setActionLoading(true);
      setShowEarlyClockInWarning(false);
      await workSessionService.clockIn({ confirmEarlyClockIn: true });
      playClockInSound();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed post-shift clock-in
  const handlePostShiftClockIn = async () => {
    try {
      setActionLoading(true);
      setShowPostShiftWarning(false);
      await workSessionService.clockIn({ confirmPostShift: true });
      playClockInSound();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed late arrival clock-in
  const handleLateArrivalClockIn = async () => {
    try {
      setActionLoading(true);
      setShowLateArrivalWarning(false);
      await workSessionService.clockIn({ confirmLateArrival: true });
      playClockInSound();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle clock out
  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      await workSessionService.clockOut(clockOutNotes || null);
      playClockOutSound();
      setShowClockOutModal(false);
      setClockOutNotes('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock out');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle start break
  const handleStartBreak = async () => {
    try {
      setActionLoading(true);
      await workSessionService.startBreak();
      playBreakStartSound();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start break');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle end break
  const handleEndBreak = async () => {
    try {
      setActionLoading(true);
      await workSessionService.endBreak();
      playBreakEndSound();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end break');
    } finally {
      setActionLoading(false);
    }
  };

  // Get status info
  const getStatusInfo = () => {
    if (!sessionData?.isWorking) {
      return { status: 'Not Working', color: 'gray', icon: Square };
    }
    if (sessionData?.session?.status === 'ON_BREAK') {
      return { status: 'On Break', color: 'yellow', icon: Coffee };
    }
    return { status: 'Working', color: 'green', icon: Play };
  };

  const statusInfo = getStatusInfo();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Time Clock Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary via-primary-dark to-primary p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Left: Greeting & Status */}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-primary-100 mb-2">
                <greeting.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{greeting.text}</span>
              </div>
              <h1 className="text-3xl font-bold font-heading mb-4">Time Clock</h1>

              {/* Current Status */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${
                  statusInfo.color === 'green' ? 'bg-green-400 animate-pulse' :
                  statusInfo.color === 'yellow' ? 'bg-yellow-400 animate-pulse' :
                  'bg-gray-400'
                }`} />
                <span className="text-lg font-medium">{statusInfo.status}</span>
                {sessionData?.session?.status === 'ACTIVE' && (
                  <Badge variant="success" size="sm">Active Session</Badge>
                )}
              </div>

              {/* Schedule Info */}
              {sessionData?.schedule && (
                <div className="bg-white/10 rounded-lg p-3 inline-block">
                  <p className="text-sm text-primary-100">Today's Schedule</p>
                  <p className="text-lg font-semibold">
                    {formatTime12(sessionData.schedule.startTime)} - {formatTime12(sessionData.schedule.endTime)}
                  </p>
                </div>
              )}
            </div>

            {/* Center: Clock Display */}
            <div className="flex flex-col items-center">
              <p className="text-primary-100 text-sm font-medium mb-1">Current Time</p>
              <p className="text-5xl font-bold font-heading mb-2">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </p>
              <p className="text-primary-200 text-sm">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex flex-col items-center gap-4 min-w-[200px]">
              {sessionData?.isWorking ? (
                <>
                  {/* Live Timer */}
                  <div className="text-center bg-white/10 rounded-xl p-4 w-full">
                    <p className="text-primary-100 text-xs mb-1">Session Duration</p>
                    <p className="text-3xl font-bold font-mono">
                      {sessionData.session?.status === 'ON_BREAK' && sessionData.session?.currentBreak
                        ? formatDurationWithSeconds(sessionData.session.currentBreak.startTime)
                        : formatDurationWithSeconds(sessionData.session?.startTime, sessionData.session?.breaks)}
                    </p>
                  </div>

                  {/* Break Button */}
                  {sessionData.session?.status === 'ON_BREAK' ? (
                    <Button
                      variant="warning"
                      size="lg"
                      onClick={handleEndBreak}
                      loading={actionLoading}
                      icon={Play}
                      className="w-full"
                    >
                      End Break
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleStartBreak}
                      loading={actionLoading}
                      icon={Coffee}
                      className="w-full"
                    >
                      Take Break
                    </Button>
                  )}

                  {/* Clock Out Button */}
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={() => setShowClockOutModal(true)}
                    loading={actionLoading}
                    icon={Square}
                    className="w-full"
                  >
                    Clock Out
                  </Button>
                </>
              ) : (
                <Button
                  variant="success"
                  size="lg"
                  onClick={handleClockIn}
                  loading={actionLoading}
                  icon={Play}
                  className="w-full py-6 text-xl"
                >
                  Clock In
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Work */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary-100">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Today's Work</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(todaySummary?.totalWorkMinutes)}
                </p>
                {todaySummary?.scheduledMinutes > 0 && (
                  <p className="text-xs text-gray-400">
                    of {formatDuration(todaySummary.scheduledMinutes)} scheduled
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Breaks */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100">
                <Coffee className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Today's Breaks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(todaySummary?.totalBreakMinutes)}
                </p>
                <p className="text-xs text-gray-400">
                  {todaySummary?.sessionsCount || 0} session(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Hours */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(weeklySummary?.totalWorkMinutes)}
                </p>
                <p className="text-xs text-gray-400">
                  {weeklySummary?.daysWorked || 0} days worked
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overtime */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <Timer className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Weekly Overtime</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(weeklySummary?.overtimeMinutes)}
                </p>
                {weeklySummary?.scheduledWeeklyMinutes > 0 && (
                  <p className="text-xs text-gray-400">
                    of {formatDuration(weeklySummary.scheduledWeeklyMinutes)} scheduled
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Session Details */}
        {sessionData?.isWorking && sessionData?.session && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Current Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Clock In Time</span>
                  <span className="font-semibold">
                    {new Date(sessionData.session.startTime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Work Duration</span>
                  <span className="font-semibold text-green-600">
                    {formatDuration(liveStats.workMinutes)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Break Time</span>
                  <span className="font-semibold text-yellow-600">
                    {formatDuration(liveStats.breakMinutes)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Status</span>
                  <Badge variant={sessionData.session.status === 'ON_BREAK' ? 'warning' : 'success'}>
                    {sessionData.session.status === 'ON_BREAK' ? 'On Break' : 'Working'}
                  </Badge>
                </div>

                {/* Breaks List */}
                {sessionData.session.breaks && sessionData.session.breaks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">Breaks Today</p>
                    <div className="space-y-2">
                      {sessionData.session.breaks.map((brk, index) => (
                        <div
                          key={brk.id || index}
                          className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <span className="text-gray-600">
                            {new Date(brk.startTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                            {brk.endTime && (
                              <> - {new Date(brk.endTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                              })}</>
                            )}
                          </span>
                          <span className="font-medium">
                            {brk.durationMinutes
                              ? `${brk.durationMinutes} min`
                              : 'In Progress'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent History */}
        <Card className={sessionData?.isWorking ? '' : 'lg:col-span-2'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No session history yet</p>
                <p className="text-sm">Your work sessions will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Break</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sessionHistory.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">
                            {new Date(session.startTime).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-600">
                            {new Date(session.startTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                            {session.endTime && (
                              <span className="text-gray-400"> - </span>
                            )}
                            {session.endTime && new Date(session.endTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          {session.client ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-primary" />
                              <span className="text-sm text-gray-700">{session.client.companyName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-semibold text-green-600">
                            {formatDuration(session.totalMinutes || session.workMinutes)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {session.totalBreakMinutes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-sm text-yellow-600">
                              <Coffee className="w-3.5 h-3.5" />
                              {session.totalBreakMinutes}m
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {session.notes ? (
                            <p className="text-sm text-gray-600 max-w-xs truncate" title={session.notes}>
                              {session.notes}
                            </p>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Breakdown */}
      {weeklySummary?.dailyBreakdown && Object.keys(weeklySummary.dailyBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              This Week's Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                const weekStart = new Date(weeklySummary.weekStart);
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + index);
                const dateKey = dayDate.toISOString().split('T')[0];
                const dayData = weeklySummary.dailyBreakdown[dateKey];
                const isToday = new Date().toDateString() === dayDate.toDateString();

                return (
                  <div
                    key={day}
                    className={`p-4 rounded-xl text-center ${
                      isToday
                        ? 'bg-primary text-white'
                        : dayData
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-gray-50'
                    }`}
                  >
                    <p className={`text-sm font-medium ${isToday ? 'text-primary-100' : 'text-gray-500'}`}>
                      {day}
                    </p>
                    <p className={`text-lg font-bold mt-1 ${isToday ? 'text-white' : 'text-gray-900'}`}>
                      {dayDate.getDate()}
                    </p>
                    {dayData ? (
                      <p className={`text-sm mt-2 ${isToday ? 'text-primary-100' : 'text-green-600'}`}>
                        {formatDuration(dayData.workMinutes)}
                      </p>
                    ) : (
                      <p className={`text-sm mt-2 ${isToday ? 'text-primary-200' : 'text-gray-400'}`}>
                        --:--
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Session Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Clock In Reminder</p>
                <p className="text-sm text-blue-700">
                  Please clock in within 5 minutes of your scheduled start time.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <Coffee className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Break Policy</p>
                <p className="text-sm text-yellow-700">
                  You are entitled to a 1-hour break for every 8-hour shift.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <Clock className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Overtime Policy</p>
                <p className="text-sm text-green-700">
                  Any overtime requires prior approval from your client.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clock Out Modal */}
      <Modal
        isOpen={showClockOutModal}
        onClose={() => setShowClockOutModal(false)}
        title="Clock Out"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Session Started</span>
              <span className="font-semibold">
                {sessionData?.session?.startTime
                  ? new Date(sessionData.session.startTime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '--:--'}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Work Duration</span>
              <span className="font-semibold text-green-600">
                {formatDuration(liveStats.workMinutes)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Breaks</span>
              <span className="font-semibold text-yellow-600">
                {formatDuration(liveStats.breakMinutes)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={clockOutNotes}
              onChange={(e) => setClockOutNotes(e.target.value)}
              placeholder="Add any notes about your work session..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowClockOutModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleClockOut}
              loading={actionLoading}
              icon={Square}
              className="flex-1"
            >
              Clock Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* Post-Shift Clock-In Warning Modal */}
      {showPostShiftWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-100">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">No Approved Overtime</h2>
                  <p className="text-sm text-gray-500">Your shift has ended</p>
                </div>
              </div>
              <button
                onClick={() => setShowPostShiftWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <p className="text-sm text-red-800 font-medium mb-2">
                  No approved overtime. You may not get paid.
                </p>
                <p className="text-sm text-red-700">
                  This requires special approval at client's discretion. Hours worked outside your schedule without prior overtime approval may not be compensated.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you still want to clock in?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPostShiftWarning(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handlePostShiftClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Early Clock-In Warning Modal */}
      {showEarlyClockInWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Early Clock-In</h2>
                  <p className="text-sm text-gray-500">Your shift hasn't started yet</p>
                </div>
              </div>
              <button
                onClick={() => setShowEarlyClockInWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  Your shift hasn't started. You may not get paid for these hours.
                </p>
                <p className="text-sm text-amber-700">
                  Hours worked before your scheduled start time will be logged as overtime and require separate approval from your client.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you still want to clock in early?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEarlyClockInWarning(false)}
                  className="flex-1"
                >
                  Wait for Shift
                </Button>
                <Button
                  variant="warning"
                  onClick={handleEarlyClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Early
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Arrival Warning Modal */}
      {showLateArrivalWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Late Clock-In</h2>
                  <p className="text-sm text-gray-500">You are past your scheduled start time</p>
                </div>
              </div>
              <button
                onClick={() => setShowLateArrivalWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  {clockInWarningMessage || 'You are clocking in late. This will be recorded as a late arrival.'}
                </p>
                <p className="text-sm text-amber-700">
                  Late arrivals are tracked and reported. Please ensure you arrive on time for your scheduled shifts.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you want to proceed with clocking in?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLateArrivalWarning(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="warning"
                  onClick={handleLateArrivalClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Late
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeClock;
