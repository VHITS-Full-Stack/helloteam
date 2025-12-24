import { useState, useEffect } from 'react';
import { Clock, Play, Pause, Square, Coffee, AlertCircle } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';

const TimeClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionState, setSessionState] = useState('idle'); // idle, working, break
  const [workDuration, setWorkDuration] = useState(0);
  const [breakDuration, setBreakDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (sessionState === 'working') {
        setWorkDuration(prev => prev + 1);
      } else if (sessionState === 'break') {
        setBreakDuration(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionState]);

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClockIn = () => {
    setSessionState('working');
    setSessionStartTime(new Date());
    setWorkDuration(0);
    setBreakDuration(0);
  };

  const handleClockOut = () => {
    setSessionState('idle');
    // Here you would save the session data
  };

  const handleStartBreak = () => {
    setSessionState('break');
  };

  const handleEndBreak = () => {
    setSessionState('working');
  };

  const todaySchedule = {
    scheduledStart: '9:00 AM',
    scheduledEnd: '6:00 PM',
    scheduledBreak: '1:00 PM - 2:00 PM',
    totalScheduledHours: 8,
  };

  const getStatusInfo = () => {
    switch (sessionState) {
      case 'working':
        return { label: 'Currently Working', color: 'success', icon: Play };
      case 'break':
        return { label: 'On Break', color: 'warning', icon: Coffee };
      default:
        return { label: 'Not Clocked In', color: 'default', icon: Clock };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Clock</h2>
          <p className="text-gray-500">Manage your work sessions</p>
        </div>
        <Badge variant={statusInfo.color} size="lg" dot>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Main Clock Card */}
      <Card className={`
        ${sessionState === 'working' ? 'bg-gradient-to-r from-green-500 to-green-600' : ''}
        ${sessionState === 'break' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : ''}
        ${sessionState === 'idle' ? 'bg-gradient-to-r from-primary to-primary-dark' : ''}
        text-white
      `}>
        <div className="text-center py-8">
          {/* Current Time */}
          <p className="text-white/80 text-sm font-medium uppercase tracking-wide">
            Current Time
          </p>
          <p className="text-5xl md:text-6xl font-bold mt-2">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
          <p className="text-white/80 mt-2">
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>

          {/* Session Info */}
          {sessionState !== 'idle' && (
            <div className="mt-8 pt-8 border-t border-white/20">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-white/80 text-sm">Session Started</p>
                  <p className="text-2xl font-bold">
                    {sessionStartTime?.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-white/80 text-sm">Work Duration</p>
                  <p className="text-2xl font-bold">{formatDuration(workDuration)}</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="text-white/80 text-sm">Break Duration</p>
                  <p className="text-2xl font-bold">{formatDuration(breakDuration)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {sessionState === 'idle' && (
              <Button
                variant="secondary"
                size="lg"
                onClick={handleClockIn}
                icon={Play}
              >
                Clock In
              </Button>
            )}

            {sessionState === 'working' && (
              <>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleStartBreak}
                  icon={Coffee}
                >
                  Start Break
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleClockOut}
                  icon={Square}
                >
                  Clock Out
                </Button>
              </>
            )}

            {sessionState === 'break' && (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleEndBreak}
                  icon={Play}
                >
                  End Break
                </Button>
                <Button
                  variant="danger"
                  size="lg"
                  onClick={handleClockOut}
                  icon={Square}
                >
                  Clock Out
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Schedule Info & Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Schedule</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-500">Scheduled Start</span>
              <span className="font-semibold text-gray-900">{todaySchedule.scheduledStart}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-500">Scheduled End</span>
              <span className="font-semibold text-gray-900">{todaySchedule.scheduledEnd}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-500">Break Time</span>
              <span className="font-semibold text-gray-900">{todaySchedule.scheduledBreak}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-500">Total Hours</span>
              <span className="font-semibold text-gray-900">{todaySchedule.totalScheduledHours} hours</span>
            </div>
          </div>
        </Card>

        {/* Arrival Status */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Guidelines</h3>
          <div className="space-y-4">
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
                <p className="font-medium text-green-900">Additional Work</p>
                <p className="text-sm text-green-700">
                  Any overtime requires prior approval from your client.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Activity Log */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Activity Log</h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {sessionStartTime && (
              <div className="flex gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center z-10">
                  <Play className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium text-gray-900">Clocked In</p>
                  <p className="text-sm text-gray-500">
                    {sessionStartTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )}
            {!sessionStartTime && (
              <div className="flex gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center z-10">
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium text-gray-500">Awaiting Clock In</p>
                  <p className="text-sm text-gray-400">No activity recorded today</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TimeClock;
