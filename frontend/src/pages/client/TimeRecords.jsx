import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, Download, Filter, Search, Loader2, CheckCircle, XCircle, AlertCircle, Timer, Eye, ChevronDown, ChevronRight, ChevronLeft, RotateCcw, Calendar } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
} from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';
import { formatHours } from '../../utils/formatTime';

const formatClockTime = (dateStr, tz) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone });
};

const formatScheduleTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
};

const TimeRecords = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRecords, setTimeRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [, setShowFilterModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionRecordIds, setRevisionRecordIds] = useState([]);
  const [clientTimezone, setClientTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay()); // Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const handlePrevWeek = () => {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  };
  const handleNextWeek = () => {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  };
  const handleCurrentWeek = () => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  // Compute stats from records
  const totalEmployees = timeRecords.length;
  const activeCount = timeRecords.filter(r => r.status === 'active').length;
  const pendingCount = timeRecords.filter(r => r.status === 'pending').length;
  const approvedCount = timeRecords.filter(r => r.status === 'approved').length;
  const needsAttentionCount = timeRecords.filter(r => r.status === 'rejected' || r.status === 'revision_requested').length;

  // Compute hour-based totals
  const totalRegularHours = timeRecords.reduce((sum, r) => sum + (r.totalHours || 0) - (r.overtimeHours || 0), 0);
  const totalApprovedOT = timeRecords.reduce((sum, r) => sum + (r.approvedOvertimeHours || 0), 0);
  const totalUnapprovedOT = timeRecords.reduce((sum, r) => sum + (r.unapprovedOvertimeHours || 0), 0);

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
      const startDate = weekStart.toISOString().split('T')[0];
      const endD = new Date(weekStart);
      endD.setDate(endD.getDate() + 6);
      const endDate = endD.toISOString().split('T')[0];
      const response = await clientPortalService.getTimeRecords({
        startDate,
        endDate,
        status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
        search: searchQueryRef.current || undefined,
      });

      if (response.success) {
        setTimeRecords(response.data.records || []);
        if (response.data.clientTimezone) setClientTimezone(response.data.clientTimezone);
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
  }, [statusFilter, weekStart]);

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
      case 'paid_leave':
        return <Badge variant="info" className="bg-purple-100 text-purple-800">Paid Leave</Badge>;
      case 'unpaid_leave':
        return <Badge variant="default" className="bg-gray-200 text-gray-700">Unpaid Leave</Badge>;
      case 'holiday':
        return <Badge variant="info" className="bg-blue-100 text-blue-800">Holiday</Badge>;
      case 'not_started':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not Started</span>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleExport = () => {
    const headers = ['Employee', 'Total Hours', 'Overtime Hours', 'Status'];
    const rows = timeRecords.map(record => [
      record.employee,
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
    a.download = `time-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleViewTimesheet = (record) => {
    navigate(`/client/time-records/${record.id}`, {
      state: {
        employeeName: record.employee,
        employeePhoto: record.profilePhoto,
      },
    });
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
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

  // Get week label from records
  const getWeekLabel = (records) => {
    if (!records || records.length === 0) return '';
    const dates = records.map(r => new Date(r.date)).sort((a, b) => a - b);
    const first = dates[0];
    const last = dates[dates.length - 1];
    const opts = { month: 'short', day: 'numeric' };
    return `${first.toLocaleDateString('en-US', opts)} – ${last.toLocaleDateString('en-US', opts)}`;
  };

  // Render expanded detail table for an employee
  const renderExpandedView = (record) => {
    const dayRecords = record.records || [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekLabel = getWeekLabel(dayRecords);

    // Filter out weekends with no data and sort by date
    const filteredRecords = dayRecords
      .map(r => {
        const d = new Date(r.date);
        return { ...r, dateObj: d, dayOfWeek: d.getUTCDay() };
      })
      .filter(r => {
        const isWeekend = r.dayOfWeek === 0 || r.dayOfWeek === 6;
        const status = r.status?.toLowerCase();
        if (isWeekend && (r.totalMinutes || 0) === 0 && status === 'not_started') return false;
        return true;
      })
      .sort((a, b) => a.dateObj - b.dateObj);

    return (
      <div className="bg-gray-50 border-t border-gray-200">
        {/* Expanded header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">{record.employee} — Week of {weekLabel}</p>
            <p className="text-xs text-gray-500">{formatHours(record.totalHours)} total hours</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(record.status)}
            <button
              onClick={() => handleViewTimesheet(record)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors ml-2"
            >
              <Eye className="w-4 h-4" />
              Full Details
            </button>
          </div>
        </div>

        {/* Desktop expanded table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-100/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-6">Date</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">Billing In/Out</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">Break</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">Regular</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">OT<span className="text-[9px] font-medium text-gray-400 normal-case tracking-normal block">Ext / Off‑Shift</span></th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((rec, idx) => {
                const status = rec.status?.toLowerCase();
                const isLeaveOrHoliday = status === 'paid_leave' || status === 'unpaid_leave' || status === 'holiday';
                const otM = rec.overtimeMinutes || 0;
                const totalM = rec.totalMinutes || 0;
                const regularM = Math.max(0, totalM - otM);
                const shiftExtM = (rec.overtimeEntries || []).filter(ot => ot.type === 'SHIFT_EXTENSION').reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
                const extraTimeM = (rec.overtimeEntries || []).filter(ot => ot.type === 'OFF_SHIFT').reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
                const dateLabel = rec.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

                return (
                  <tr key={idx} className={(shiftExtM > 0 || extraTimeM > 0) ? 'bg-yellow-50/60' : ''}>
                    <td className="py-2.5 px-6 text-sm">
                      <span className="font-medium text-gray-900">{dateLabel}</span>
                    </td>
                    {isLeaveOrHoliday ? (
                      <td colSpan={6} className="py-2.5 px-4 text-sm text-center">
                        {getStatusBadge(status)}
                      </td>
                    ) : (
                      <>
                        {/* Billing In/Out */}
                        <td className="py-2.5 px-3 text-sm text-center">
                          {rec.billingStart && rec.billingEnd ? (
                            <div className="text-gray-900 font-medium">
                              {formatClockTime(rec.billingStart, clientTimezone)}
                              <span className="text-gray-300 mx-1">–</span>
                              {formatClockTime(rec.billingEnd, clientTimezone)}
                            </div>
                          ) : rec.clockIn ? (
                            <div className="text-gray-700">
                              {formatClockTime(rec.clockIn, clientTimezone)}
                              <span className="text-gray-300 mx-1">–</span>
                              {rec.clockOut ? formatClockTime(rec.clockOut, clientTimezone) : '—'}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                          {rec.isLate && <span className="ml-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">LATE</span>}
                        </td>
                        {/* Break */}
                        <td className="py-2.5 px-3 text-sm text-center">
                          <span className={(rec.breakMinutes || 0) > 0 ? 'font-medium text-yellow-600' : 'text-gray-400'}>{(rec.breakMinutes || 0) > 0 ? formatHours(rec.breakMinutes / 60) : '—'}</span>
                        </td>
                        {/* Regular */}
                        <td className="py-2.5 px-3 text-sm text-center">
                          <span className={regularM > 0 ? 'font-medium text-gray-900' : 'text-gray-400'}>{formatHours(regularM / 60)}</span>
                        </td>
                        {/* OT (Ext / Off-Shift) */}
                        <td className="py-2.5 px-3 text-sm text-center">
                          {(shiftExtM > 0 || extraTimeM > 0) ? (
                            <div className="flex flex-col items-center gap-1">
                              {(rec.overtimeEntries || []).filter(ot => ot.type === 'SHIFT_EXTENSION').map((ot, i) => (
                                <div key={i} className="flex flex-col items-center">
                                  <span className="text-xs text-purple-600 font-medium">{formatHours(ot.requestedMinutes / 60)} ext</span>
                                  <span className={`text-[10px] ${ot.status === 'APPROVED' ? 'text-green-600' : ot.status === 'REJECTED' ? 'text-red-500' : 'text-amber-500'}`}>
                                    {ot.status === 'APPROVED' ? '✓' : ot.status === 'REJECTED' ? '✗' : 'pending'}
                                  </span>
                                </div>
                              ))}
                              {(rec.overtimeEntries || []).filter(ot => ot.type === 'OFF_SHIFT').map((ot, i) => (
                                <div key={i} className="flex flex-col items-center">
                                  <span className="text-xs text-orange-600 font-medium">{formatHours(ot.requestedMinutes / 60)} off</span>
                                  <span className={`text-[10px] ${ot.status === 'APPROVED' ? 'text-green-600' : ot.status === 'REJECTED' ? 'text-red-500' : 'text-amber-500'}`}>
                                    {ot.status === 'APPROVED' ? '✓' : ot.status === 'REJECTED' ? '✗' : 'pending'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="py-2.5 px-4 text-right">
                          {getStatusBadge(status)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile expanded cards */}
        <div className="md:hidden px-4 py-3 space-y-2">
          {filteredRecords.map((rec, idx) => {
            const status = rec.status?.toLowerCase();
            const isLeaveOrHoliday = status === 'paid_leave' || status === 'unpaid_leave' || status === 'holiday';
            const otM = rec.overtimeMinutes || 0;
            const totalM = rec.totalMinutes || 0;
            const regularM = Math.max(0, totalM - otM);
            const shiftExtM = (rec.overtimeEntries || []).filter(ot => ot.type === 'SHIFT_EXTENSION').reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
            const extraTimeM = (rec.overtimeEntries || []).filter(ot => ot.type === 'OFF_SHIFT').reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
            const hasOT = shiftExtM > 0 || extraTimeM > 0;
            const dateLabel = rec.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

            return (
              <div key={idx} className={`px-3 py-2 rounded-lg border ${hasOT ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{dateLabel}</span>
                  {getStatusBadge(status)}
                </div>
                {!isLeaveOrHoliday && (
                  <>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      {rec.billingStart && rec.billingEnd ? (
                        <>
                          <span>In: {formatClockTime(rec.billingStart, clientTimezone)}</span>
                          <span>Out: {formatClockTime(rec.billingEnd, clientTimezone)}</span>
                        </>
                      ) : (
                        <>
                          <span>In: {rec.clockIn ? formatClockTime(rec.clockIn, clientTimezone) : '—'}</span>
                          <span>Out: {rec.clockOut ? formatClockTime(rec.clockOut, clientTimezone) : '—'}</span>
                        </>
                      )}
                      {rec.isLate && <span className="text-red-600 font-semibold">LATE</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      {(rec.breakMinutes || 0) > 0 && <span className="text-yellow-600">Break: {formatHours(rec.breakMinutes / 60)}</span>}
                      <span className={regularM > 0 ? 'text-gray-700' : 'text-gray-400'}>Reg: {formatHours(regularM / 60)}</span>
                      {(rec.overtimeEntries || []).filter(ot => ot.type === 'SHIFT_EXTENSION').map((ot, i) => (
                        <span key={i} className="text-purple-600">Ext: {formatHours(ot.requestedMinutes / 60)} <span className={`${ot.status === 'APPROVED' ? 'text-green-600' : ot.status === 'REJECTED' ? 'text-red-500' : 'text-amber-500'}`}>{ot.status === 'APPROVED' ? '✓' : ot.status === 'REJECTED' ? '✗' : '(pending)'}</span></span>
                      ))}
                      {(rec.overtimeEntries || []).filter(ot => ot.type === 'OFF_SHIFT').map((ot, i) => (
                        <span key={i} className="text-orange-600">Extra: {formatHours(ot.requestedMinutes / 60)} <span className={`${ot.status === 'APPROVED' ? 'text-green-600' : ot.status === 'REJECTED' ? 'text-red-500' : 'text-amber-500'}`}>{ot.status === 'APPROVED' ? '✓' : ot.status === 'REJECTED' ? '✗' : '(pending)'}</span></span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Revision reason display */}
        {(() => {
          const revisionRecord = record.records?.find(r => r.status === 'REVISION_REQUESTED' && r.revisionReason);
          if (!revisionRecord) return null;
          return (
            <div className="mx-4 my-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                <span className="font-medium">Revision requested:</span> {revisionRecord.revisionReason}
              </p>
            </div>
          );
        })()}

        {/* Request Revisions button */}
        {(() => {
          const revisionEligible = record.records?.filter(r =>
            r.timeRecordId &&
            r.status && r.status !== 'REVISION_REQUESTED' && r.status !== 'NOT_STARTED' &&
            r.status !== 'PAID_LEAVE' && r.status !== 'UNPAID_LEAVE' && r.status !== 'HOLIDAY'
          ) || [];
          if (revisionEligible.length === 0) return null;
          return (
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRequestRevision(revisionEligible.map(r => r.timeRecordId));
                }}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Request Revisions
              </button>
            </div>
          );
        })()}
      </div>
    );
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

      {/* Hour Totals */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Regular Hours</p>
              <p className="text-2xl font-bold text-gray-900">{formatHours(totalRegularHours)}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Approved Overtime</p>
              <p className="text-2xl font-bold text-green-600">{totalApprovedOT > 0 ? formatHours(totalApprovedOT) : '0h'}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unapproved Overtime</p>
              <p className="text-2xl font-bold text-orange-600">{totalUnapprovedOT > 0 ? formatHours(totalUnapprovedOT) : '0h'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Timer className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Approved</p>
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Needs Attention</p>
              <p className="text-2xl font-bold text-red-600">{needsAttentionCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Week Navigation + Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg min-w-[220px] justify-center">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 text-sm">{weekLabel}</span>
            </div>
            <button onClick={handleNextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
            <Button variant="ghost" size="sm" onClick={handleCurrentWeek}>Today</Button>
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

      {/* Employee Time Records */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : timeRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No time records</h3>
            <p className="text-gray-500">No time records found.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-1" />
              <div className="col-span-4">Employee</div>
              <div className="col-span-2 text-center">Total Hours</div>
              <div className="col-span-2 text-center">Overtime</div>
              <div className="col-span-3 text-center">Status</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {timeRecords.map((record) => {
                const isExpanded = expandedId === record.id;
                return (
                  <div key={record.id}>
                    {/* Desktop Row */}
                    <div
                      className={`hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer transition-colors ${isExpanded ? 'bg-primary-50/40' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleExpand(record.id)}
                    >
                      {/* Expand icon */}
                      <div className="col-span-1 flex justify-center">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Employee */}
                      <div className="col-span-4 flex items-center gap-3">
                        <Avatar name={record.employee} src={record.profilePhoto} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{record.employee}</p>
                          {record.overtimeHours > 0 && (
                            <p className="text-xs text-orange-600 mt-0.5">{record.records?.filter(r => r.overtimeMinutes > 0).length || 0} day(s) with overtime</p>
                          )}
                        </div>
                      </div>

                      {/* Total Hours */}
                      <div className="col-span-2 text-center">
                        <span className="text-lg font-semibold text-gray-900">{formatHours(record.totalHours)}</span>
                      </div>

                      {/* Overtime */}
                      <div className="col-span-2 text-center">
                        <span className={`text-lg font-semibold ${record.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                          {record.overtimeHours > 0 ? formatHours(record.overtimeHours) : '-'}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-3 flex justify-center">
                        {getStatusBadge(record.status)}
                      </div>
                    </div>

                    {/* Mobile Card */}
                    <div className="md:hidden">
                      <div
                        className={`px-4 py-3 cursor-pointer ${isExpanded ? 'bg-primary-50/40' : ''}`}
                        onClick={() => toggleExpand(record.id)}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <Avatar name={record.employee} src={record.profilePhoto} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{record.employee}</p>
                          </div>
                          {getStatusBadge(record.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 pl-8">
                          <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-sm font-semibold text-gray-900">{formatHours(record.totalHours)}</p>
                          </div>
                          {record.overtimeHours > 0 && (
                            <div>
                              <p className="text-xs text-gray-500">Overtime</p>
                              <p className="text-sm font-semibold text-orange-600">{formatHours(record.overtimeHours)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && renderExpandedView(record)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowRevisionModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Revisions</h3>
            <p className="text-sm text-gray-500 mb-4">
              The employee will be notified and can review and resubmit their timesheet.
            </p>
            <textarea
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Describe what needs to be revised..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRequestRevision}
                disabled={actionLoading || !revisionReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRecords;
