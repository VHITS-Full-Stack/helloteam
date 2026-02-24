import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Calendar, Download, Filter, Search, ChevronDown, ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
} from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';

const TimeRecords = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRecords, setTimeRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalEmployees: 0,
    totalHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    pendingCount: 0,
  });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [, setShowFilterModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionRecordIds, setRevisionRecordIds] = useState([]);

  // Get week start/end dates
  const getWeekDates = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const [currentWeek, setCurrentWeek] = useState(() => getWeekDates(new Date()));

  const formatWeekDisplay = (start, end) => {
    const options = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const fetchingRef = useRef(false);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const prevSearchRef = useRef(searchQuery);

  const fetchTimeRecords = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getTimeRecords({
        startDate: `${currentWeek.start.getFullYear()}-${String(currentWeek.start.getMonth() + 1).padStart(2, '0')}-${String(currentWeek.start.getDate()).padStart(2, '0')}`,
        endDate: `${currentWeek.end.getFullYear()}-${String(currentWeek.end.getMonth() + 1).padStart(2, '0')}-${String(currentWeek.end.getDate()).padStart(2, '0')}`,
        status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
        search: searchQueryRef.current || undefined,
      });

      if (response.success) {
        setTimeRecords(response.data.records || []);
        setSummary(response.data.summary || {
          totalEmployees: 0,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          pendingCount: 0,
        });
        setDateRange(response.data.dateRange || { start: '', end: '' });
      } else {
        setError(response.error || 'Failed to load time records');
      }
    } catch (err) {
      console.error('Error fetching time records:', err);
      setError('Failed to load time records');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [currentWeek, statusFilter]);

  useEffect(() => {
    fetchTimeRecords();
  }, [fetchTimeRecords]);

  // Debounce search
  useEffect(() => {
    if (prevSearchRef.current === searchQuery) return;
    prevSearchRef.current = searchQuery;
    const timer = setTimeout(() => {
      fetchTimeRecords();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePreviousWeek = () => {
    const newStart = new Date(currentWeek.start);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeek(getWeekDates(newStart));
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeek.start);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeek(getWeekDates(newStart));
  };

  const handleCurrentWeek = () => {
    setCurrentWeek(getWeekDates(new Date()));
  };

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'auto_approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'active':
        return <Badge variant="info">Active</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'revision_requested':
        return <Badge variant="warning" className="bg-amber-100 text-amber-800">Revision Requested</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getCellClass = (hours, hasUnapprovedOT, shiftExtensionStatus) => {
    if (!hours || hours === 0) return 'text-gray-300';
    if (shiftExtensionStatus === 'DENIED') return 'text-red-600 font-medium';
    if (shiftExtensionStatus === 'UNAPPROVED' || shiftExtensionStatus === 'PENDING') return 'text-orange-600 font-medium';
    if (shiftExtensionStatus === 'APPROVED') return 'text-green-700 font-medium';
    if (hasUnapprovedOT) return 'text-orange-600 font-medium';
    return 'text-blue-700 font-medium'; // Scheduled time = blue
  };

  const formatHours = (decimalHours) => {
    if (decimalHours === null || decimalHours === undefined || decimalHours === 0) return '0m';
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const handleExport = () => {
    const headers = ['Employee', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total', 'Overtime', 'Status'];
    const rows = timeRecords.map(record => [
      record.employee,
      record.dailyHours?.mon || 0,
      record.dailyHours?.tue || 0,
      record.dailyHours?.wed || 0,
      record.dailyHours?.thu || 0,
      record.dailyHours?.fri || 0,
      record.dailyHours?.sat || 0,
      record.dailyHours?.sun || 0,
      record.totalHours,
      record.overtimeHours,
      record.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-records-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle overtime approval directly from time records page
  const handleApproveOvertime = async (timeRecordId) => {
    if (!timeRecordId) return;
    try {
      setActionLoading(true);
      const response = await clientPortalService.approveTimeRecord(timeRecordId);
      if (response.success) {
        fetchTimeRecords();
      }
    } catch (err) {
      setError(err.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDenyOvertime = async (timeRecordId, reason = 'Overtime denied by client') => {
    if (!timeRecordId) return;
    try {
      setActionLoading(true);
      const response = await clientPortalService.rejectTimeRecord(timeRecordId, reason);
      if (response.success) {
        fetchTimeRecords();
      }
    } catch (err) {
      setError(err.message || 'Failed to deny');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRevision = (timeRecordIds) => {
    setRevisionRecordIds(Array.isArray(timeRecordIds) ? timeRecordIds : [timeRecordIds]);
    setRevisionReason('');
    setShowRevisionModal(true);
  };

  const confirmRequestRevision = async () => {
    if (!revisionRecordIds.length || !revisionReason.trim()) return;
    try {
      setActionLoading(true);
      let response;
      if (revisionRecordIds.length === 1) {
        response = await clientPortalService.requestRevisionTimeRecord(revisionRecordIds[0], revisionReason);
      } else {
        response = await clientPortalService.bulkRequestRevision(revisionRecordIds, revisionReason);
      }
      if (response.success) {
        setShowRevisionModal(false);
        setRevisionReason('');
        setRevisionRecordIds([]);
        fetchTimeRecords();
      }
    } catch (err) {
      setError(err.message || 'Failed to request revision');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && timeRecords.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-gray-500">View and manage employee time records</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={Filter} onClick={() => setShowFilterModal(true)}>
            Filter
          </Button>
          <Button variant="outline" icon={Download} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={fetchTimeRecords} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900">{formatHours(summary.totalHours)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Regular Hours</p>
          <p className="text-2xl font-bold text-green-600">{formatHours(summary.regularHours)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Approved OT</p>
          <p className="text-2xl font-bold text-green-600">{formatHours(summary.approvedOvertimeHours || 0)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Unapproved OT</p>
          <p className="text-2xl font-bold text-orange-600">{formatHours(summary.unapprovedOvertimeHours || 0)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.pendingCount}</p>
        </Card>
      </div>

      {/* Week Selector and Search */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900">
                {formatWeekDisplay(currentWeek.start, currentWeek.end)}
              </span>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
            <Button variant="ghost" size="sm" onClick={handleCurrentWeek}>
              Today
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-2"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revision_requested">Revision Requested</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input w-full md:w-64"
                style={{ paddingLeft: '2.5rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Time Records Accordion */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : timeRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No time records</h3>
            <p className="text-gray-500">No time records found for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Employee</div>
              <div className="text-center">Mon</div>
              <div className="text-center">Tue</div>
              <div className="text-center">Wed</div>
              <div className="text-center">Thu</div>
              <div className="text-center">Fri</div>
              <div className="text-center">Sat</div>
              <div className="text-center">Sun</div>
              <div className="text-center">Total</div>
              <div className="text-center">Status</div>
            </div>

            {timeRecords.map((record) => {
              const isExpanded = expandedRows[record.id];
              return (
                <div key={record.id}>
                  {/* Main Row */}
                  <div
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRow(record.id)}
                  >
                    {/* Employee */}
                    <div className="col-span-3 flex items-center gap-3">
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      <Avatar name={record.employee} src={record.profilePhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{record.employee}</p>
                      </div>
                    </div>

                    {/* Daily Hours - hidden on mobile */}
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                      const dayRec = record.records?.find((r) => {
                        const d = new Date(r.date);
                        return dayNames[d.getUTCDay()] === day;
                      });
                      const hasUnapprovedOT = dayRec?.overtimeMinutes > 0 && dayRec?.overtimeStatus !== 'APPROVED' && dayRec?.overtimeStatus !== 'AUTO_APPROVED';
                      return (
                        <div key={day} className={`hidden md:block text-center text-sm ${getCellClass(record.dailyHours?.[day], hasUnapprovedOT, dayRec?.shiftExtensionStatus)}`}>
                          {record.dailyHours?.[day] > 0 ? formatHours(record.dailyHours[day]) : '-'}
                        </div>
                      );
                    })}

                    {/* Total */}
                    <div className="hidden md:block text-center font-semibold text-gray-900">
                      {formatHours(record.totalHours)}
                    </div>

                    {/* Status */}
                    <div className="hidden md:flex justify-center">
                      {getStatusBadge(record.status)}
                    </div>

                    {/* Mobile summary */}
                    <div className="flex md:hidden items-center justify-between mt-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-900">{formatHours(record.totalHours)}</span></span>
                        {record.overtimeHours > 0 && (
                          <span className="text-sm text-orange-600 font-medium">+{formatHours(record.overtimeHours)} OT</span>
                        )}
                      </div>
                      {getStatusBadge(record.status)}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="bg-gray-50/70 border-t border-gray-100">
                      {/* Desktop: table rows aligned to columns */}
                      <div className="hidden md:block">
                        {record.records && record.records.length > 0 && (() => {
                          // Build day map from records: dayName -> { totalMinutes, overtimeMinutes, status }
                          const dayMap = {};
                          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                          record.records.forEach((rec) => {
                            const d = new Date(rec.date);
                            const dayKey = dayNames[d.getUTCDay()];
                            dayMap[dayKey] = rec;
                          });

                          return (
                            <>
                              {/* Regular Hours row */}
                              <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center">
                                <div className="col-span-3 pl-11 text-xs font-medium text-gray-500">Regular Hours</div>
                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                                  const rec = dayMap[day];
                                  const totalMins = rec ? (rec.totalMinutes || 0) : 0;
                                  const otMins = rec ? (rec.overtimeMinutes || 0) : 0;
                                  const regularHrs = (totalMins - otMins) / 60;
                                  return (
                                    <div key={day} className={`text-center text-sm ${regularHrs > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                      {regularHrs > 0 ? formatHours(regularHrs) : '-'}
                                    </div>
                                  );
                                })}
                                <div className="text-center text-sm font-semibold text-gray-900">
                                  {formatHours(record.totalHours - record.overtimeHours)}
                                </div>
                                <div />
                              </div>

                              {/* Overtime row (only if has overtime) */}
                              {record.overtimeHours > 0 && (
                                <div className={`grid grid-cols-12 gap-2 px-4 py-2 items-center border-l-2 ${
                                  record.unapprovedOvertimeHours > 0 ? 'bg-orange-50/50 border-orange-400' : 'bg-green-50/50 border-green-400'
                                }`}>
                                  <div className={`col-span-3 pl-11 text-xs font-medium ${
                                    record.unapprovedOvertimeHours > 0 ? 'text-orange-600' : 'text-green-600'
                                  }`}>
                                    Overtime
                                  </div>
                                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                                    const rec = dayMap[day];
                                    const ot = rec ? (rec.overtimeMinutes || 0) / 60 : 0;
                                    const extStatus = rec?.shiftExtensionStatus || 'NONE';
                                    const otStatus = rec?.overtimeStatus ? rec.overtimeStatus.toLowerCase() : (rec && rec.overtimeMinutes > 0 ? (rec.status || '').toLowerCase() : null);
                                    const isApproved = otStatus === 'approved' || otStatus === 'auto_approved' || extStatus === 'APPROVED';
                                    const isDenied = otStatus === 'rejected' || extStatus === 'DENIED';
                                    const isPending = extStatus === 'PENDING' || otStatus === 'pending';
                                    // Color: Green=approved, Red=denied, Orange=unapproved/pending
                                    const colorClass = isApproved ? 'text-green-700' : isDenied ? 'text-red-700' : 'text-orange-700';
                                    const badgeBg = isApproved ? 'bg-green-100 text-green-700' : isDenied ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';
                                    const badgeLabel = isApproved ? 'Approved' : isDenied ? 'Denied' : isPending ? 'Pending' : 'Unapproved';
                                    return (
                                      <div key={day} className="text-center">
                                        {ot > 0 ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className={`text-sm font-medium ${colorClass}`}>+{formatHours(ot)}</span>
                                            {(otStatus || extStatus !== 'NONE') && (
                                              <span className={`text-[9px] font-bold uppercase px-1 py-px rounded ${badgeBg}`}>
                                                {badgeLabel}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-sm text-gray-300">-</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div className="text-center text-sm font-semibold">
                                    <span className={record.approvedOvertimeHours > 0 ? 'text-green-700' : ''}>
                                      {record.approvedOvertimeHours > 0 ? `+${formatHours(record.approvedOvertimeHours)}` : ''}
                                    </span>
                                    {record.approvedOvertimeHours > 0 && record.unapprovedOvertimeHours > 0 && ' / '}
                                    <span className={record.unapprovedOvertimeHours > 0 ? 'text-orange-700' : ''}>
                                      {record.unapprovedOvertimeHours > 0 ? `+${formatHours(record.unapprovedOvertimeHours)}` : ''}
                                    </span>
                                  </div>
                                  <div className="flex justify-center gap-1">
                                    {record.records?.filter(r => r.overtimeMinutes > 0 && r.overtimeStatus !== 'APPROVED' && r.overtimeStatus !== 'AUTO_APPROVED' && r.overtimeStatus !== 'REJECTED' && r.timeRecordId).length > 0 && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const pendingIds = record.records.filter(r => r.overtimeMinutes > 0 && r.overtimeStatus !== 'APPROVED' && r.overtimeStatus !== 'AUTO_APPROVED' && r.overtimeStatus !== 'REJECTED' && r.timeRecordId);
                                            pendingIds.forEach(r => handleApproveOvertime(r.timeRecordId));
                                          }}
                                          disabled={actionLoading}
                                          className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                                          title="Approve overtime"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const pendingIds = record.records.filter(r => r.overtimeMinutes > 0 && r.overtimeStatus !== 'APPROVED' && r.overtimeStatus !== 'AUTO_APPROVED' && r.overtimeStatus !== 'REJECTED' && r.timeRecordId);
                                            pendingIds.forEach(r => handleDenyOvertime(r.timeRecordId));
                                          }}
                                          disabled={actionLoading}
                                          className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                                          title="Deny overtime"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Request Revisions for pending regular records */}
                              {(() => {
                                const pendingRegular = record.records?.filter(r =>
                                  (!r.overtimeMinutes || r.overtimeMinutes === 0) &&
                                  r.timeRecordId &&
                                  (!r.status || r.status === 'PENDING')
                                ) || [];
                                if (pendingRegular.length === 0) return null;
                                return (
                                  <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center bg-amber-50/30 border-l-2 border-amber-300">
                                    <div className="col-span-3 pl-11 text-xs font-medium text-amber-700">
                                      Regular Hours
                                    </div>
                                    <div className="col-span-7" />
                                    <div className="col-span-2 flex justify-end">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRequestRevision(pendingRegular.map(r => r.timeRecordId));
                                        }}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                        title="Request revisions for regular hours"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        Request Revisions
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Revision reason display */}
                              {(() => {
                                const revisionRecord = record.records?.find(r => r.status === 'REVISION_REQUESTED' && r.revisionReason);
                                if (!revisionRecord) return null;
                                return (
                                  <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center bg-amber-50/50 border-l-2 border-amber-400">
                                    <div className="col-span-12 pl-11">
                                      <p className="text-xs text-amber-700">
                                        <span className="font-medium">Revision requested:</span>{' '}
                                        {revisionRecord.revisionReason}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}

                            </>
                          );
                        })()}
                      </div>

                      {/* Mobile: card-based breakdown */}
                      <div className="md:hidden px-4 py-3 space-y-2">
                        {record.records && record.records.map((rec, idx) => {
                          const totalHrs = (rec.totalMinutes || 0) / 60;
                          const hasOT = rec.overtimeMinutes > 0;
                          const otStatus = rec.overtimeStatus ? rec.overtimeStatus.toLowerCase() : (rec.status || '').toLowerCase();
                          const isOTApproved = otStatus === 'approved' || otStatus === 'auto_approved';
                          return (
                            <div key={idx} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                              hasOT ? (isOTApproved ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200') : 'bg-white border-gray-100'
                            }`}>
                              <span className="text-sm text-gray-600">
                                {new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-green-700">{formatHours(totalHrs)}</span>
                                {hasOT && (
                                  <span className={`text-xs font-bold ${isOTApproved ? 'text-green-700' : 'text-orange-700'}`}>
                                    +{formatHours(rec.overtimeMinutes / 60)} OT
                                  </span>
                                )}
                                {hasOT && (
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    isOTApproved ? 'bg-green-100 text-green-700' :
                                    otStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-orange-100 text-orange-700'
                                  }`}>
                                    {otStatus === 'rejected' ? 'Denied' : isOTApproved ? 'Approved' : 'Pending'}
                                  </span>
                                )}
                                {hasOT && otStatus === 'pending' && rec.timeRecordId && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleApproveOvertime(rec.timeRecordId); }}
                                      disabled={actionLoading}
                                      className="p-1 rounded hover:bg-green-100 text-green-600"
                                      title="Approve"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDenyOvertime(rec.timeRecordId); }}
                                      disabled={actionLoading}
                                      className="p-1 rounded hover:bg-red-100 text-red-600"
                                      title="Deny"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* Mobile: Request Revisions button */}
                        {(() => {
                          const pendingRegular = record.records?.filter(r =>
                            (!r.overtimeMinutes || r.overtimeMinutes === 0) &&
                            r.timeRecordId &&
                            (!r.status || r.status === 'PENDING')
                          ) || [];
                          if (pendingRegular.length === 0) return null;
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestRevision(pendingRegular.map(r => r.timeRecordId));
                              }}
                              disabled={actionLoading}
                              className="w-full mt-2 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Request Revisions
                            </button>
                          );
                        })()}
                        {/* Mobile: Revision reason */}
                        {(() => {
                          const revisionRecord = record.records?.find(r => r.status === 'REVISION_REQUESTED' && r.revisionReason);
                          if (!revisionRecord) return null;
                          return (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                              <span className="font-medium">Revision requested:</span> {revisionRecord.revisionReason}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Scheduled Time</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Approved OT</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Unapproved / Pending OT</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Denied OT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Pending</span>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700">Approved</span>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">Denied</span>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Unapproved</span>
          <span>OT Status</span>
        </div>
      </div>

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowRevisionModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Revisions</h3>
            <p className="text-sm text-gray-500 mb-4">
              The employee will be notified and can review and resubmit their timesheet.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Revision Notes</label>
              <textarea
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Describe what needs to be revised..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRevisionModal(false); setRevisionRecordIds([]); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRequestRevision}
                disabled={!revisionReason.trim() || actionLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Submitting...' : 'Request Revisions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRecords;
