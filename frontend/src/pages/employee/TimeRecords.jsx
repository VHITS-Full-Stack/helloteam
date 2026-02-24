import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  Plus,
  Search,
  Coffee,
  X,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, Badge, Button, Modal } from '../../components/common';
import workSessionService from '../../services/workSession.service';
import timeRecordService from '../../services/timeRecord.service';

const TimeRecords = () => {
  const [activeTab, setActiveTab] = useState('timesheets');
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'day'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resubmitLoading, setResubmitLoading] = useState(null);

  // Manual time entry modal
  const [showAddTimeModal, setShowAddTimeModal] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    notes: '',
  });
  const [addTimeLoading, setAddTimeLoading] = useState(false);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Calculate week range
  const getWeekRange = useCallback((date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  const weekRange = useMemo(() => getWeekRange(currentDate), [currentDate, getWeekRange]);

  // Get day range for day view
  const getDayRange = useCallback((date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  const dayRange = useMemo(() => getDayRange(currentDate), [currentDate, getDayRange]);

  // Get the active date range based on view mode
  const activeRange = useMemo(() => {
    return viewMode === 'week' ? weekRange : dayRange;
  }, [viewMode, weekRange, dayRange]);

  // Fetch sessions
  const fetchingSessionsRef = useRef(false);
  const fetchSessions = useCallback(async () => {
    if (fetchingSessionsRef.current) return;
    fetchingSessionsRef.current = true;
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        startDate: toLocalDateString(activeRange.start),
        endDate: toLocalDateString(activeRange.end),
        limit: 100,
      };

      const result = await workSessionService.getSessionHistory(params);

      if (result?.success) {
        setSessions(result.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError('Failed to load time entries. Please try again.');
    } finally {
      setIsLoading(false);
      fetchingSessionsRef.current = false;
    }
  }, [activeRange]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Navigation handlers
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Helper to format date as YYYY-MM-DD using local timezone (avoids UTC shift from toISOString)
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format helpers
  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  };

  const formatDateHeader = (dateString) => {
    if (!dateString) return 'Invalid Date';
    // Parse the date and extract local date components to avoid timezone shifts
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    // Build a date using local year/month/day to avoid any UTC-to-local shift
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return localDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatWeekRange = () => {
    const startMonth = weekRange.start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekRange.end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = weekRange.start.getDate();
    const endDay = weekRange.end.getDate();
    const year = weekRange.end.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  };

  const formatDayDisplay = () => {
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateDisplay = () => {
    return viewMode === 'week' ? formatWeekRange() : formatDayDisplay();
  };

  // Check if session is currently active
  const isActiveSession = (session) => {
    return session.status === 'ACTIVE' || session.status === 'ON_BREAK';
  };

  // Handle view detail
  const handleViewDetail = async (session) => {
    setSelectedSession(session);
    setShowDetailModal(true);
    setSessionLogs([]);
    setLogsLoading(true);

    try {
      const result = await workSessionService.getSessionLogs(session.id);
      if (result?.success) {
        setSessionLogs(result.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch session logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Handle add manual time
  const handleAddTime = async (e) => {
    e.preventDefault();
    setAddTimeLoading(true);
    setError(null);

    try {
      const result = await workSessionService.addManualEntry(manualEntry);
      if (result?.success) {
        setShowAddTimeModal(false);
        setManualEntry({
          date: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '17:00',
          notes: '',
        });
        fetchSessions();
      } else {
        setError(result?.message || 'Failed to add time entry');
      }
    } catch (err) {
      console.error('Failed to add time entry:', err);
      setError(err.message || 'Failed to add time entry');
    } finally {
      setAddTimeLoading(false);
    }
  };

  // Get status badge - uses distinct OT colors when session has overtime
  const getStatusBadge = (session) => {
    if (session.status === 'ACTIVE') {
      return null; // Active sessions show time in green instead
    }
    if (session.status === 'ON_BREAK') {
      return <Badge variant="warning" size="xs">On Break</Badge>;
    }

    const isOT = session.overtimeMinutes > 0;

    // Show approval status from time record
    if (session.approvalStatus === 'APPROVED') {
      return isOT ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-800 ring-1 ring-green-300">
          Approved
        </span>
      ) : (
        <Badge variant="success" size="xs">Approved</Badge>
      );
    }
    if (session.approvalStatus === 'AUTO_APPROVED') {
      return <Badge variant="success" size="xs">Auto-Approved</Badge>;
    }
    if (session.approvalStatus === 'REJECTED') {
      return isOT ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 ring-1 ring-red-300">
          Denied
        </span>
      ) : (
        <Badge variant="danger" size="xs">Rejected</Badge>
      );
    }
    if (session.approvalStatus === 'REVISION_REQUESTED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
          Revision Requested
        </span>
      );
    }
    if (session.approvalStatus === 'PENDING' || !session.approvedAt) {
      return isOT ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
          Pending
        </span>
      ) : (
        <Badge variant="warning" size="xs">Pending</Badge>
      );
    }
    return null;
  };

  // Handle resubmit after revision request
  const handleResubmit = async (recordId) => {
    try {
      setResubmitLoading(recordId);
      setError(null);
      const result = await timeRecordService.resubmitTimeRecord(recordId);
      if (result?.success) {
        fetchSessions();
      } else {
        setError(result?.message || 'Failed to resubmit timesheet');
      }
    } catch (err) {
      console.error('Failed to resubmit:', err);
      setError(err.message || 'Failed to resubmit timesheet');
    } finally {
      setResubmitLoading(null);
    }
  };

  const tabs = [
    { id: 'timesheets', label: 'Timesheets' },
    { id: 'manual', label: 'Manual Time Card' },
    { id: 'slider', label: 'Time Slider' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Time Entries</h1>
      </div>

      {/* Main Card */}
      <Card className="overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center gap-1 px-4 pt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-100 text-gray-900 border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* Add Time Button */}
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowAddTimeModal(true)}
            >
              Add Time
            </Button>

          </div>

          <div className="flex items-center gap-4">
            {/* Week/Day Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Day
              </button>
            </div>

            {/* Today Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="text-primary hover:text-primary-dark"
            >
              Today
            </Button>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={goToPrevious}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNext}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[160px]">
                {formatDateDisplay()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary w-48"
              />
            </div>

            {/* Settings */}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'timesheets' && (
          <div className="overflow-x-auto">
            {/* Loading State */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Time Entries</h3>
                <p className="text-gray-500 mb-4">
                  No time entries found for this period.
                </p>
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setShowAddTimeModal(true)}
                >
                  Add Time Entry
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Time in - out
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Arrival
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Overtime
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Break
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const isOT = session.overtimeMinutes > 0;
                    return (
                    <React.Fragment key={session.id}>
                    <tr
                      className={`border-b border-gray-100 transition-colors ${
                        isOT
                          ? 'bg-amber-50/60 hover:bg-amber-100/60'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">
                          {formatDateHeader(session.startTime)}
                        </span>
                      </td>

                      {/* Time in - out */}
                      <td className="py-3 px-4">
                        {isActiveSession(session) ? (
                          <span className="text-green-600 font-medium">
                            {formatTime(session.startTime)} - Now
                          </span>
                        ) : (
                          <span className="text-gray-600">
                            {session.endTime ? (
                              `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`
                            ) : (
                              'Manual'
                            )}
                          </span>
                        )}
                      </td>

                      {/* Arrival Status */}
                      <td className="py-3 px-4">
                        {session.arrivalStatus === 'Late' ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                            Late{session.lateMinutes ? ` (${session.lateMinutes >= 60 ? `${Math.floor(session.lateMinutes / 60)}h ${session.lateMinutes % 60}m` : `${session.lateMinutes}m`})` : ''}
                          </span>
                        ) : session.arrivalStatus === 'On Time' ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            On Time
                          </span>
                        ) : session.arrivalStatus === 'Early' ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                            Early
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Duration (total worked time) */}
                      <td className="py-3 px-4">
                        {isActiveSession(session) ? (
                          <span className="text-green-600">-</span>
                        ) : (
                          <span className="font-medium text-gray-900">
                            {formatDuration(session.totalMinutes || session.workMinutes)}
                          </span>
                        )}
                      </td>

                      {/* Overtime */}
                      <td className="py-3 px-4">
                        {isActiveSession(session) ? (
                          <span className="text-gray-400">-</span>
                        ) : isOT ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-bold rounded bg-amber-200 text-amber-800 w-fit">
                              +{formatDuration(session.overtimeMinutes)}
                            </span>
                            {session.shiftExtensionMinutes > 0 && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded w-fit ${
                                session.shiftExtensionStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                session.shiftExtensionStatus === 'DENIED' ? 'bg-red-100 text-red-800' :
                                session.shiftExtensionStatus === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                Ext +{formatDuration(session.shiftExtensionMinutes)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Break */}
                      <td className="py-3 px-4">
                        {(session.breakMinutes || session.totalBreakMinutes) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm text-yellow-600">
                            <Coffee className="w-3.5 h-3.5" />
                            {formatDuration(session.breakMinutes || session.totalBreakMinutes)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {session.client ? (
                            <>
                              <Badge variant="info" size="xs">
                                {session.client.companyName?.substring(0, 3).toUpperCase() || 'CLI'}
                              </Badge>
                              {getStatusBadge(session)}
                            </>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetail(session)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {session.approvalStatus === 'REVISION_REQUESTED' && session.timeRecordId && (
                            <button
                              onClick={() => handleResubmit(session.timeRecordId)}
                              disabled={resubmitLoading === session.timeRecordId}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Resubmit timesheet"
                            >
                              <RotateCcw className={`w-4 h-4 ${resubmitLoading === session.timeRecordId ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Revision requested banner */}
                    {session.approvalStatus === 'REVISION_REQUESTED' && (
                      <tr className="bg-amber-50 border-b border-amber-100">
                        <td colSpan={8} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-amber-700">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span>
                                <strong>Revision requested:</strong>{' '}
                                {session.revisionReason || 'Please review and resubmit your timesheet.'}
                              </span>
                            </div>
                            {session.timeRecordId && (
                              <button
                                onClick={() => handleResubmit(session.timeRecordId)}
                                disabled={resubmitLoading === session.timeRecordId}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className={`w-3 h-3 ${resubmitLoading === session.timeRecordId ? 'animate-spin' : ''}`} />
                                {resubmitLoading === session.timeRecordId ? 'Resubmitting...' : 'Resubmit'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Manual Time Card Tab */}
        {activeTab === 'manual' && (
          <div className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Manual Time Card</h3>
            <p className="text-gray-500 mb-4">
              Enter time manually for days you forgot to clock in.
            </p>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowAddTimeModal(true)}
            >
              Add Manual Entry
            </Button>
          </div>
        )}

        {/* Time Slider Tab */}
        {activeTab === 'slider' && (
          <div className="p-8 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Time Slider</h3>
            <p className="text-gray-500">
              Visual time slider feature coming soon.
            </p>
          </div>
        )}
      </Card>

      {/* Add Time Modal */}
      <Modal
        isOpen={showAddTimeModal}
        onClose={() => setShowAddTimeModal(false)}
        title="Add Time Entry"
        size="md"
      >
        <form onSubmit={handleAddTime} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={manualEntry.date}
              onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={manualEntry.startTime}
                onChange={(e) => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={manualEntry.endTime}
                onChange={(e) => setManualEntry({ ...manualEntry, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={manualEntry.notes}
              onChange={(e) => setManualEntry({ ...manualEntry, notes: e.target.value })}
              placeholder="Add notes about your work..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddTimeModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={addTimeLoading}
              className="flex-1"
            >
              Add Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSession(null);
          setSessionLogs([]);
        }}
        title={
          <div className="flex items-center gap-2">
            <span>Timesheet History</span>
            {selectedSession && (
              <span className="text-sm text-gray-500">
                ({selectedSession.id?.slice(0, 8)})
              </span>
            )}
          </div>
        }
        size="xl"
      >
        {selectedSession && (
          <div className="space-y-6">
            {/* Session Summary Header */}
            <div className="bg-gray-600 text-white rounded-t-lg p-3">
              <p className="font-medium">
                USER: {selectedSession.employee?.firstName} {selectedSession.employee?.lastName || 'Employee'}
              </p>
            </div>

            {/* Session Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDateHeader(selectedSession.startTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge
                    variant={
                      selectedSession.status === 'COMPLETED' ? 'success' :
                      selectedSession.status === 'ACTIVE' ? 'info' :
                      'warning'
                    }
                  >
                    {selectedSession.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="font-medium text-gray-900">
                    {formatTime(selectedSession.startTime)}
                    {selectedSession.endTime && ` - ${formatTime(selectedSession.endTime)}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium text-green-600">
                    {formatDuration(selectedSession.workMinutes)}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedSession.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                <p className="text-gray-600 bg-gray-50 rounded-lg p-3">
                  {selectedSession.notes}
                </p>
              </div>
            )}

            {/* Timesheet History / Logs */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Activity Log</h4>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : sessionLogs.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Log Table Header */}
                  <div className="bg-gray-600 text-white">
                    <div className="grid grid-cols-12 gap-2 p-3 text-sm font-medium">
                      <div className="col-span-4">Time</div>
                      <div className="col-span-3">User</div>
                      <div className="col-span-5">Log Message</div>
                    </div>
                  </div>
                  {/* Log Table Body */}
                  <div className="divide-y divide-gray-100">
                    {sessionLogs.map((log, index) => (
                      <div
                        key={log.id || index}
                        className={`grid grid-cols-12 gap-2 p-3 text-sm ${
                          index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        <div className="col-span-4 text-gray-600">
                          <div>
                            {new Date(log.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })},{' '}
                            {new Date(log.createdAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            }).toLowerCase()}
                          </div>
                          <div className="text-xs text-gray-400">
                            ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                          </div>
                        </div>
                        <div className="col-span-3 text-gray-900">
                          {log.userName || 'System'}
                        </div>
                        <div className="col-span-5 text-gray-700">
                          {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No activity logs available</p>
                </div>
              )}
            </div>

            {/* Breaks List */}
            {selectedSession.breaks && selectedSession.breaks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Breaks</h4>
                <div className="space-y-2">
                  {selectedSession.breaks.map((brk, index) => (
                    <div
                      key={brk.id || index}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-600">
                        {formatTime(brk.startTime)}
                        {brk.endTime && ` - ${formatTime(brk.endTime)}`}
                      </span>
                      <span className="text-sm font-medium text-yellow-600">
                        {brk.durationMinutes ? `${brk.durationMinutes} min` : 'In Progress'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimeRecords;
