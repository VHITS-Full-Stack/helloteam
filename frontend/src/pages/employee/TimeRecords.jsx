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
  RotateCcw,
  FileText,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, Badge, Button, Modal } from '../../components/common';
import workSessionService from '../../services/workSession.service';
import timeRecordService from '../../services/timeRecord.service';
import { formatDuration as formatDurationShort, formatTime12 } from '../../utils/formatTime';

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
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
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

  // Helper to format date as YYYY-MM-DD using local timezone
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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
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

  // Get status badge — checks overtime entry statuses first, then falls back to TimeRecord status
  const getStatusBadge = (session) => {
    if (session.status === 'ACTIVE') {
      return <Badge variant="info" size="xs">Working</Badge>;
    }
    if (session.status === 'ON_BREAK') {
      return <Badge variant="warning" size="xs">On Break</Badge>;
    }

    // If session has overtime entries, derive status from their actual statuses
    const otEntries = session.overtimeEntries || [];
    if (otEntries.length > 0) {
      const hasRejected = otEntries.some(ot => ot.status === 'REJECTED');
      const hasPending = otEntries.some(ot => ot.status === 'PENDING');
      if (hasRejected) {
        return <Badge variant="danger" size="xs">OT Rejected</Badge>;
      }
      if (hasPending) {
        return <Badge variant="warning" size="xs">Pending</Badge>;
      }
      // All approved/auto-approved
      return <Badge variant="success" size="xs">Approved</Badge>;
    }

    if (session.approvalStatus === 'APPROVED') {
      return <Badge variant="success" size="xs">Approved</Badge>;
    }
    if (session.approvalStatus === 'AUTO_APPROVED') {
      return <Badge variant="success" size="xs">Auto-Approved</Badge>;
    }
    if (session.approvalStatus === 'REJECTED') {
      return <Badge variant="danger" size="xs">Rejected</Badge>;
    }
    if (session.approvalStatus === 'REVISION_REQUESTED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
          Revision
        </span>
      );
    }
    if (session.approvalStatus === 'PENDING' || !session.approvedAt) {
      return <Badge variant="warning" size="xs">Pending</Badge>;
    }
    return null;
  };

  // Get arrival badge
  const getArrivalBadge = (session) => {
    if (session.arrivalStatus === 'Late') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
          Late{session.lateMinutes ? ` ${session.lateMinutes >= 60 ? `${Math.floor(session.lateMinutes / 60)}h ${session.lateMinutes % 60}m` : `${session.lateMinutes}m`}` : ''}
        </span>
      );
    }
    if (session.arrivalStatus === 'On Time') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
          On Time
        </span>
      );
    }
    if (session.arrivalStatus === 'Early') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">
          Early
        </span>
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

  // Compute summary stats
  const summary = useMemo(() => {
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    let breakMinutes = 0;
    for (const s of sessions) {
      totalMinutes += s.totalMinutes || 0;
      overtimeMinutes += s.overtimeMinutes || 0;
      breakMinutes += s.breakMinutes || s.totalBreakMinutes || 0;
    }
    return { totalMinutes, overtimeMinutes, breakMinutes, count: sessions.length };
  }, [sessions]);

  const tabs = [
    { id: 'timesheets', label: 'Timesheets' },
    { id: 'manual', label: 'Manual Entry' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Entries</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage your work sessions</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowAddTimeModal(true)}
        >
          Add Time
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.count}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatDurationShort(summary.totalMinutes)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</p>
          <p className={`text-2xl font-bold mt-1 ${summary.overtimeMinutes > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {formatDurationShort(summary.overtimeMinutes)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Breaks</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{formatDurationShort(summary.breakMinutes)}</p>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="overflow-hidden" padding="none">
        {/* Tabs + Toolbar */}
        <div className="border-b border-gray-200 bg-gray-50/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4">
            {/* Left: Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: Navigation + View Toggle */}
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'week'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'day'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Day
                </button>
              </div>

              {/* Date Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrevious}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[160px] justify-center">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{formatDateDisplay()}</span>
                </div>
                <button
                  onClick={goToNext}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-50 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'timesheets' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Time Entries</h3>
                <p className="text-gray-500 mb-4 text-sm">
                  No time entries found for this period.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowAddTimeModal(true)}
                >
                  Add Time Entry
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Break
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Overtime
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">

                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sessions.map((session) => {
                        const isOT = session.overtimeMinutes > 0;
                        return (
                          <React.Fragment key={session.id}>
                            <tr
                              className={`transition-colors ${
                                isOT
                                  ? 'bg-amber-50/40 hover:bg-amber-50/80'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {/* Date & Time (combined) */}
                              <td className="py-3 px-5">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 text-sm">
                                      {formatDateHeader(session.startTime)}
                                    </span>
                                    {getArrivalBadge(session)}
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {isActiveSession(session) ? (
                                      <span className="text-green-600 font-medium">
                                        {formatTime(session.startTime)} - Now
                                      </span>
                                    ) : session.endTime ? (
                                      `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`
                                    ) : (
                                      <span className="italic">Manual</span>
                                    )}
                                  </span>
                                  {session.client && (
                                    <span className="text-xs text-gray-400">{session.client.companyName}</span>
                                  )}
                                </div>
                              </td>

                              {/* Duration */}
                              <td className="py-3 px-4 text-center">
                                {isActiveSession(session) ? (
                                  <span className="text-green-600 font-medium text-sm">In Progress</span>
                                ) : (
                                  <span className="font-semibold text-gray-900 text-sm">
                                    {formatDuration(session.totalMinutes)}
                                  </span>
                                )}
                              </td>

                              {/* Break */}
                              <td className="py-3 px-4 text-center">
                                {(session.breakMinutes || session.totalBreakMinutes) > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-sm text-yellow-600">
                                    <Coffee className="w-3.5 h-3.5" />
                                    {formatDurationShort(session.breakMinutes || session.totalBreakMinutes)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>

                              {/* Overtime */}
                              <td className="py-3 px-4 text-center">
                                {isActiveSession(session) ? (
                                  <span className="text-gray-300">-</span>
                                ) : session.overtimeEntries && session.overtimeEntries.length > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {session.overtimeEntries.map((ot, otIdx) => {
                                      const isApproved = ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED';
                                      const isDenied = ot.status === 'REJECTED';
                                      const badgeBg = isApproved
                                        ? 'bg-green-100 text-green-800'
                                        : isDenied
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800';
                                      const badgeLabel = isApproved ? 'Approved' : isDenied ? 'Denied' : 'Pending';
                                      const timeRange = ot.type === 'OFF_SHIFT'
                                        ? `${formatTime12(ot.requestedStartTime)} → ${formatTime12(ot.requestedEndTime)}`
                                        : ot.estimatedEndTime ? `until ${formatTime12(ot.estimatedEndTime)}` : '';
                                      return (
                                        <div key={ot.id || otIdx} className="flex flex-col items-center gap-0.5">
                                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded ${badgeBg}`}>
                                            +{formatDurationShort(ot.requestedMinutes)} · {badgeLabel}
                                          </span>
                                          {timeRange && (
                                            <span className="text-[10px] text-gray-400">{timeRange}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : isOT ? (
                                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800">
                                    +{formatDuration(session.overtimeMinutes)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 text-center">
                                {getStatusBadge(session)}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleViewDetail(session)}
                                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {session.approvalStatus === 'REVISION_REQUESTED' && session.timeRecordId && (
                                    <button
                                      onClick={() => handleResubmit(session.timeRecordId)}
                                      disabled={resubmitLoading === session.timeRecordId}
                                      className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
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
                                <td colSpan={6} className="px-5 py-2">
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
                </div>

                {/* Mobile Card Layout */}
                <div className="md:hidden divide-y divide-gray-100">
                  {sessions.map((session) => {
                    const isOT = session.overtimeMinutes > 0;
                    return (
                      <div
                        key={session.id}
                        className={`p-4 ${isOT ? 'bg-amber-50/40' : ''}`}
                      >
                        {/* Top row: date + status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">
                              {formatDateHeader(session.startTime)}
                            </span>
                            {getArrivalBadge(session)}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(session)}
                            <button
                              onClick={() => handleViewDetail(session)}
                              className="p-1.5 text-gray-400 hover:text-primary rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Time range */}
                        <p className="text-sm text-gray-500 mb-3">
                          {isActiveSession(session) ? (
                            <span className="text-green-600 font-medium">{formatTime(session.startTime)} - Now</span>
                          ) : session.endTime ? (
                            `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`
                          ) : (
                            <span className="italic">Manual entry</span>
                          )}
                          {session.client && (
                            <span className="text-gray-400"> · {session.client.companyName}</span>
                          )}
                        </p>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Duration</span>
                            <p className="font-semibold text-gray-900">
                              {isActiveSession(session) ? 'In Progress' : formatDuration(session.totalMinutes)}
                            </p>
                          </div>
                          {(session.breakMinutes || session.totalBreakMinutes) > 0 && (
                            <div>
                              <span className="text-gray-400 text-xs">Break</span>
                              <p className="font-medium text-yellow-600">
                                {formatDurationShort(session.breakMinutes || session.totalBreakMinutes)}
                              </p>
                            </div>
                          )}
                          {session.overtimeEntries && session.overtimeEntries.length > 0 && (
                            <div>
                              <span className="text-gray-400 text-xs">Overtime</span>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                {session.overtimeEntries.map((ot, otIdx) => {
                                  const isApproved = ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED';
                                  const isDenied = ot.status === 'REJECTED';
                                  const badgeBg = isApproved
                                    ? 'bg-green-100 text-green-800'
                                    : isDenied
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800';
                                  const badgeLabel = isApproved ? 'Approved' : isDenied ? 'Denied' : 'Pending';
                                  return (
                                    <span key={ot.id || otIdx} className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded ${badgeBg}`}>
                                      +{formatDurationShort(ot.requestedMinutes)} · {badgeLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Revision banner */}
                        {session.approvalStatus === 'REVISION_REQUESTED' && (
                          <div className="mt-3 p-2 bg-amber-100 rounded-lg">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-amber-700">
                                <strong>Revision:</strong> {session.revisionReason || 'Please review and resubmit.'}
                              </p>
                              {session.timeRecordId && (
                                <button
                                  onClick={() => handleResubmit(session.timeRecordId)}
                                  disabled={resubmitLoading === session.timeRecordId}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0"
                                >
                                  <RotateCcw className={`w-3 h-3 ${resubmitLoading === session.timeRecordId ? 'animate-spin' : ''}`} />
                                  Resubmit
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Manual Time Card Tab */}
        {activeTab === 'manual' && (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Manual Time Card</h3>
            <p className="text-gray-500 text-sm mb-4">
              Enter time manually for days you forgot to clock in.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowAddTimeModal(true)}
            >
              Add Manual Entry
            </Button>
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
        title="Session Details"
        size="xl"
      >
        {selectedSession && (
          <div className="space-y-6">
            {/* Session Summary */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Date</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {formatDateHeader(selectedSession.startTime)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Time</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {formatTime(selectedSession.startTime)}
                    {selectedSession.endTime && ` - ${formatTime(selectedSession.endTime)}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</p>
                  <p className="font-semibold text-green-600 mt-1">
                    {formatDuration(selectedSession.totalMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</p>
                  <div className="mt-1">
                    {getStatusBadge(selectedSession)}
                  </div>
                </div>
              </div>

              {/* Overtime entries in detail */}
              {selectedSession.overtimeEntries && selectedSession.overtimeEntries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Overtime</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSession.overtimeEntries.map((ot, otIdx) => {
                      const isApproved = ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED';
                      const isDenied = ot.status === 'REJECTED';
                      const badgeBg = isApproved
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : isDenied
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800';
                      const badgeLabel = isApproved ? 'Approved' : isDenied ? 'Denied' : 'Pending';
                      const timeRange = ot.type === 'OFF_SHIFT'
                        ? `${formatTime12(ot.requestedStartTime)} → ${formatTime12(ot.requestedEndTime)}`
                        : ot.estimatedEndTime ? `until ${formatTime12(ot.estimatedEndTime)}` : '';
                      return (
                        <div key={ot.id || otIdx} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${badgeBg}`}>
                          +{formatDurationShort(ot.requestedMinutes)} · {badgeLabel}
                          {timeRange && <span className="text-gray-500 ml-1">({timeRange})</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {selectedSession.notes && (
              <div>
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {selectedSession.notes}
                </p>
              </div>
            )}

            {/* Activity Log */}
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Activity Log</h4>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : sessionLogs.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-700 text-white">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium">
                      <div className="col-span-4">Time</div>
                      <div className="col-span-3">User</div>
                      <div className="col-span-5">Log Message</div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {sessionLogs.map((log, index) => (
                      <div
                        key={log.id || index}
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-sm ${
                          index % 2 === 0 ? 'bg-blue-50/50' : 'bg-white'
                        }`}
                      >
                        <div className="col-span-4 text-gray-500 text-xs">
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
                        </div>
                        <div className="col-span-3 text-gray-900 text-xs font-medium">
                          {log.userName || 'System'}
                        </div>
                        <div className="col-span-5 text-gray-600 text-xs">
                          {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-100">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No activity logs available</p>
                </div>
              )}
            </div>

            {/* Breaks List */}
            {selectedSession.breaks && selectedSession.breaks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Breaks</h4>
                <div className="space-y-2">
                  {selectedSession.breaks.map((brk, index) => (
                    <div
                      key={brk.id || index}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100"
                    >
                      <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-600">
                          {formatTime(brk.startTime)}
                          {brk.endTime && ` - ${formatTime(brk.endTime)}`}
                        </span>
                      </div>
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
