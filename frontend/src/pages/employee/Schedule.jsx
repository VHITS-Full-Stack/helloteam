import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';

const Schedule = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // week, month

  const getWeekDates = (date) => {
    const week = [];
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1); // Start from Monday

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentWeek);

  const scheduleData = {
    // Sample schedule data
    '2025-12-15': { shift: '9:00 AM - 6:00 PM', type: 'regular', hours: 8 },
    '2025-12-16': { shift: '9:00 AM - 6:00 PM', type: 'regular', hours: 8 },
    '2025-12-17': { shift: '9:00 AM - 6:00 PM', type: 'regular', hours: 8 },
    '2025-12-18': { shift: '9:00 AM - 6:00 PM', type: 'regular', hours: 8 },
    '2025-12-19': { shift: '9:00 AM - 6:00 PM', type: 'regular', hours: 8 },
    '2025-12-20': { shift: 'Off', type: 'off', hours: 0 },
    '2025-12-21': { shift: 'Off', type: 'off', hours: 0 },
  };

  const formatDateKey = (date) => {
    return date.toISOString().split('T')[0];
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newDate);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getScheduleForDate = (date) => {
    const key = formatDateKey(date);
    return scheduleData[key] || { shift: 'No schedule', type: 'none', hours: 0 };
  };

  const totalWeeklyHours = weekDates.reduce((total, date) => {
    return total + getScheduleForDate(date).hours;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Schedule</h2>
          <p className="text-gray-500">View and manage your work schedule</p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Week Navigation */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <p className="text-sm text-gray-500">Total: {totalWeeklyHours} hours scheduled</p>
          </div>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const schedule = getScheduleForDate(date);
            const today = isToday(date);

            return (
              <div
                key={index}
                className={`
                  p-4 rounded-lg text-center transition-all
                  ${today ? 'ring-2 ring-primary bg-primary-50' : ''}
                  ${schedule.type === 'regular' ? 'bg-green-50' : ''}
                  ${schedule.type === 'off' ? 'bg-gray-50' : ''}
                  ${schedule.type === 'none' ? 'bg-gray-50' : ''}
                `}
              >
                <p className={`text-sm font-medium ${today ? 'text-primary' : 'text-gray-500'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className={`text-2xl font-bold mt-1 ${today ? 'text-primary' : 'text-gray-900'}`}>
                  {date.getDate()}
                </p>
                <div className="mt-3">
                  {schedule.type === 'regular' ? (
                    <>
                      <Badge variant="success" size="sm">Working</Badge>
                      <p className="text-xs text-gray-600 mt-2">{schedule.shift}</p>
                      <p className="text-xs font-medium text-gray-900">{schedule.hours}h</p>
                    </>
                  ) : schedule.type === 'off' ? (
                    <Badge variant="default" size="sm">Day Off</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">TBD</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Shift Time</span>
                <span className="font-semibold text-gray-900">9:00 AM - 6:00 PM</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Break</span>
                <span className="font-semibold text-gray-900">1:00 PM - 2:00 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Hours</span>
                <span className="font-semibold text-gray-900">8 hours</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Upcoming Changes */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Changes</h3>
          </div>
          <div className="space-y-3">
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">December 25, 2025</p>
                  <p className="text-sm text-gray-500">Holiday - Office Closed</p>
                </div>
                <Badge variant="warning">Holiday</Badge>
              </div>
            </div>
            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">December 26, 2025</p>
                  <p className="text-sm text-gray-500">Holiday - Office Closed</p>
                </div>
                <Badge variant="info">Holiday</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Schedule Summary */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">160</p>
            <p className="text-sm text-gray-500">Scheduled Hours</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">128</p>
            <p className="text-sm text-gray-500">Hours Worked</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">20</p>
            <p className="text-sm text-gray-500">Working Days</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">2</p>
            <p className="text-sm text-gray-500">Days Off</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Schedule;
