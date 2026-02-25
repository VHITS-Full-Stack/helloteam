import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';
import scheduleService from '../../services/schedule.service';

const Schedule = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('week');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const monthScheduleCacheRef = useRef({});
  const fetchingRef = useRef(false);

  // Get the start of the current week (Sunday)
  const getWeekStart = useCallback((date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Get the start of the current month
  const getMonthStart = useCallback((date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Fetch schedule data for a week
  const fetchWeekSchedule = useCallback(async (weekStart) => {
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const result = await scheduleService.getMySchedule(weekStartStr);
    if (result?.success) {
      return result.schedule || [];
    }
    return [];
  }, []);

  // Fetch schedule data based on view mode
  const fetchScheduleData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setIsLoading(true);
      setError(null);

      if (viewMode === 'week') {
        const weekStart = getWeekStart(currentDate);
        const [weekResult, todayResult] = await Promise.allSettled([
          fetchWeekSchedule(weekStart),
          scheduleService.getTodaySchedule(),
        ]);

        if (weekResult.status === 'fulfilled') {
          setScheduleData(weekResult.value);
        }

        if (todayResult.status === 'fulfilled' && todayResult.value?.success) {
          setTodaySchedule(todayResult.value);
        }
      } else {
        // Month view - fetch all weeks of the month
        const monthStart = getMonthStart(currentDate);
        const monthKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;

        // Check cache first
        if (monthScheduleCacheRef.current[monthKey]) {
          setScheduleData(monthScheduleCacheRef.current[monthKey]);
        } else {
          // Fetch all weeks of the month
          const weeksToFetch = [];
          const firstDayOfMonth = new Date(monthStart);
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

          // Start from the Sunday of the week containing the first of the month
          let weekStart = getWeekStart(firstDayOfMonth);

          while (weekStart <= lastDayOfMonth) {
            weeksToFetch.push(new Date(weekStart));
            weekStart = new Date(weekStart);
            weekStart.setDate(weekStart.getDate() + 7);
          }

          const weekResults = await Promise.all(
            weeksToFetch.map(ws => fetchWeekSchedule(ws))
          );

          // Combine all weeks and remove duplicates
          const allDays = [];
          const seenDates = new Set();
          weekResults.forEach(weekData => {
            weekData.forEach(day => {
              if (!seenDates.has(day.date)) {
                seenDates.add(day.date);
                allDays.push(day);
              }
            });
          });

          // Sort by date
          allDays.sort((a, b) => new Date(a.date) - new Date(b.date));

          // Cache the result
          monthScheduleCacheRef.current[monthKey] = allDays;
          setScheduleData(allDays);
        }

        // Also fetch today's schedule
        const todayResult = await scheduleService.getTodaySchedule();
        if (todayResult?.success) {
          setTodaySchedule(todayResult);
        }
      }
    } catch (err) {
      console.error('Failed to fetch schedule data:', err);
      setError('Failed to load schedule data. Please try again.');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [currentDate, viewMode, getWeekStart, getMonthStart, fetchWeekSchedule]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  // Navigation handlers
  const navigate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate weekly schedule for week view
  const weekSchedule = useMemo(() => {
    if (viewMode !== 'week') return [];
    const weekStart = getWeekStart(currentDate);
    return scheduleData.filter(day => {
      const dayDate = new Date(day.date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return dayDate >= weekStart && dayDate < weekEnd;
    });
  }, [scheduleData, currentDate, viewMode, getWeekStart]);

  // Calculate month calendar data
  const monthCalendarData = useMemo(() => {
    if (viewMode !== 'month') return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    const calendar = [];
    let week = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -(startDayOfWeek - i - 1));
      week.push({ date: prevMonthDay, isCurrentMonth: false, schedule: null });
    }

    // Add days of the current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const daySchedule = scheduleData.find(s => s.date === dateStr);

      week.push({
        date,
        isCurrentMonth: true,
        schedule: daySchedule || null,
      });

      if (week.length === 7) {
        calendar.push(week);
        week = [];
      }
    }

    // Add empty cells for days after the last of the month
    if (week.length > 0) {
      const remainingDays = 7 - week.length;
      for (let i = 1; i <= remainingDays; i++) {
        const nextMonthDay = new Date(year, month + 1, i);
        week.push({ date: nextMonthDay, isCurrentMonth: false, schedule: null });
      }
      calendar.push(week);
    }

    return calendar;
  }, [currentDate, viewMode, scheduleData]);

  // Calculate totals
  const totals = useMemo(() => {
    const relevantData = viewMode === 'week' ? weekSchedule : scheduleData.filter(d => {
      const date = new Date(d.date);
      return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
    });

    const totalMinutes = relevantData.reduce((sum, d) => sum + (d.scheduledMinutes || 0), 0);
    const workingDays = relevantData.filter(d => d.isScheduled).length;
    const daysOff = relevantData.filter(d => !d.isScheduled).length;

    return {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      workingDays,
      daysOff,
    };
  }, [weekSchedule, scheduleData, viewMode, currentDate]);

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatMinutesToHours = (minutes) => {
    if (!minutes) return '0h';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  // Get display title
  const getDisplayTitle = () => {
    if (viewMode === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (isLoading && scheduleData.length === 0) {
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Schedule</h2>
          <p className="text-gray-500">View your work schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            icon={RefreshCw}
          >
            Today
          </Button>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">{getDisplayTitle()}</h3>
            <p className="text-sm text-gray-500">
              Total: {totals.totalHours} hours scheduled ({formatMinutesToHours(totals.totalMinutes)})
            </p>
          </div>
          <button
            onClick={() => navigate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-7 gap-2">
            {weekSchedule.length > 0 ? (
              weekSchedule.map((day, index) => {
                const dayDate = new Date(day.date);
                const today = isToday(dayDate);

                return (
                  <div
                    key={day.date || index}
                    className={`
                      p-4 rounded-lg text-center transition-all
                      ${today ? 'ring-2 ring-primary bg-primary-50' : ''}
                      ${day.isScheduled ? 'bg-green-50' : 'bg-gray-50'}
                    `}
                  >
                    <p className={`text-sm font-medium ${today ? 'text-primary' : 'text-gray-500'}`}>
                      {day.dayName?.slice(0, 3)}
                    </p>
                    <p className={`text-2xl font-bold mt-1 ${today ? 'text-primary' : 'text-gray-900'}`}>
                      {dayDate.getDate()}
                    </p>
                    <div className="mt-3">
                      {day.isScheduled ? (
                        <>
                          <Badge variant="success" size="sm">Working</Badge>
                          <p className="text-xs text-gray-600 mt-2">
                            {formatTime(day.startTime)} - {formatTime(day.endTime)}
                          </p>
                          <p className="text-xs font-medium text-gray-900">
                            {formatMinutesToHours(day.scheduledMinutes)}
                          </p>
                        </>
                      ) : (
                        <Badge variant="default" size="sm">Day Off</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              [...Array(7)].map((_, index) => {
                const weekStart = getWeekStart(currentDate);
                const dayDate = new Date(weekStart);
                dayDate.setDate(dayDate.getDate() + index);
                const today = isToday(dayDate);

                return (
                  <div
                    key={index}
                    className={`
                      p-4 rounded-lg text-center transition-all bg-gray-50
                      ${today ? 'ring-2 ring-primary' : ''}
                    `}
                  >
                    <p className={`text-sm font-medium ${today ? 'text-primary' : 'text-gray-500'}`}>
                      {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className={`text-2xl font-bold mt-1 ${today ? 'text-primary' : 'text-gray-900'}`}>
                      {dayDate.getDate()}
                    </p>
                    <div className="mt-3">
                      <Badge variant="warning" size="sm">No Schedule</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Month View */}
        {viewMode === 'month' && (
          <div>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="space-y-1">
              {monthCalendarData.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                  {week.map((day, dayIndex) => {
                    const today = isToday(day.date);
                    const hasSchedule = day.schedule?.isScheduled;

                    return (
                      <div
                        key={dayIndex}
                        className={`
                          min-h-[80px] p-2 rounded-lg border transition-all
                          ${!day.isCurrentMonth ? 'bg-gray-50 opacity-50' : ''}
                          ${today ? 'ring-2 ring-primary bg-primary-50 border-primary' : 'border-gray-200'}
                          ${day.isCurrentMonth && hasSchedule ? 'bg-green-50 border-green-200' : ''}
                          ${day.isCurrentMonth && !hasSchedule && !today ? 'bg-white' : ''}
                        `}
                      >
                        <p className={`text-sm font-medium ${
                          today ? 'text-primary' :
                          !day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {day.date.getDate()}
                        </p>
                        {day.isCurrentMonth && day.schedule && (
                          <div className="mt-1">
                            {hasSchedule ? (
                              <>
                                <div className="w-full h-1 bg-green-400 rounded mb-1" />
                                <p className="text-xs text-gray-600 truncate">
                                  {formatTime(day.schedule.startTime)}
                                </p>
                                <p className="text-xs font-medium text-green-600">
                                  {formatMinutesToHours(day.schedule.scheduledMinutes)}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">Off</p>
                            )}
                          </div>
                        )}
                        {day.isCurrentMonth && !day.schedule && (
                          <p className="text-xs text-gray-400 mt-1">No data</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Month Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded" />
                <span className="text-sm text-gray-600">Working Day</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-200 rounded" />
                <span className="text-sm text-gray-600">Day Off / No Schedule</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 ring-2 ring-primary rounded" />
                <span className="text-sm text-gray-600">Today</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Schedule Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Details */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-50 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Today's Schedule</h3>
          </div>
          <div className="space-y-4">
            {todaySchedule?.isScheduled ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-900">{todaySchedule.dayName}</span>
                  <Badge variant="success">Scheduled</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Shift Time</span>
                    <span className="font-semibold text-gray-900">
                      {formatTime(todaySchedule.startTime)} - {formatTime(todaySchedule.endTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Total Hours</span>
                    <span className="font-semibold text-gray-900">
                      {formatMinutesToHours(todaySchedule.scheduledMinutes)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">
                  {todaySchedule?.message || 'No schedule for today'}
                </p>
                <p className="text-sm text-gray-400 mt-1">{todaySchedule?.dayName}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Summary */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {viewMode === 'week' ? 'Weekly' : 'Monthly'} Summary
            </h3>
          </div>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Total Scheduled Hours</span>
                <span className="text-2xl font-bold text-blue-600">{totals.totalHours}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Minutes</span>
                <span className="font-medium text-gray-700">{totals.totalMinutes} min</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{totals.workingDays}</p>
                <p className="text-sm text-gray-500">Working Days</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-600">{totals.daysOff}</p>
                <p className="text-sm text-gray-500">Days Off</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Schedule by Day Details - Only show in week view */}
      {viewMode === 'week' && weekSchedule.filter(d => d.isScheduled).length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Schedule Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Day</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Start Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">End Time</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Hours</th>
                </tr>
              </thead>
              <tbody>
                {weekSchedule.filter(d => d.isScheduled).map((day, index) => {
                  const dayDate = new Date(day.date);
                  const today = isToday(dayDate);

                  return (
                    <tr
                      key={day.date || index}
                      className={`border-b border-gray-100 ${today ? 'bg-primary-50' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <span className={`font-medium ${today ? 'text-primary' : 'text-gray-900'}`}>
                          {day.dayName}
                        </span>
                        {today && (
                          <Badge variant="primary" size="sm" className="ml-2">Today</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{formatTime(day.startTime)}</td>
                      <td className="py-3 px-4 text-gray-600">{formatTime(day.endTime)}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {formatMinutesToHours(day.scheduledMinutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Schedule;
