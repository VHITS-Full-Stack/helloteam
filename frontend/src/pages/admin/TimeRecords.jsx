import { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Calendar, Download, Filter, Search, Building2, Edit, AlertCircle, RefreshCw, ChevronDown, ChevronRight, Coffee, Loader2, Users } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
} from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';
import clientService from '../../services/client.service';
import { formatHours, formatDuration, formatTime12 } from '../../utils/formatTime';

const TimeRecords = () => {
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [timeRecords, setTimeRecords] = useState([
    {
      employeeId: 'demo-1',
      employee: 'Nikita Karanpuria',
      client: 'Acme Corp',
      clientId: 'c1',
      clientTimezone: 'America/New_York',
      profilePhoto: null,
      totalHours: 24.5,
      overtimeHours: 2,
      workedDays: 3,
      status: 'pending',
      dailyRecords: [
        { id: 'd1', date: '2026-03-09', clockIn: '2026-03-09T14:00:00Z', clockOut: '2026-03-09T22:00:00Z', billingStart: '2026-03-09T14:00:00Z', billingEnd: '2026-03-09T22:00:00Z', hours: 8, overtimeHours: 0, breaks: 0.5, status: 'approved', isLate: false, arrivalStatus: 'On Time', overtimeEntries: [], notes: '' },
        { id: 'd2', date: '2026-03-10', clockIn: '2026-03-10T14:05:00Z', clockOut: '2026-03-10T23:30:00Z', billingStart: '2026-03-10T14:05:00Z', billingEnd: '2026-03-10T23:30:00Z', hours: 9.4, overtimeHours: 1.4, breaks: 0, status: 'pending', isLate: true, lateMinutes: 5, arrivalStatus: 'Late', overtimeEntries: [{ id: 'ot1', type: 'SHIFT_EXTENSION', requestedMinutes: 84, status: 'PENDING' }], notes: '' },
        { id: 'd3', date: '2026-03-11', clockIn: '2026-03-11T13:55:00Z', clockOut: '2026-03-11T22:00:00Z', billingStart: '2026-03-11T14:00:00Z', billingEnd: '2026-03-11T22:00:00Z', hours: 8.1, overtimeHours: 0, breaks: 0, status: 'approved', isLate: false, arrivalStatus: 'Early', overtimeEntries: [], notes: '' },
      ],
    },
    {
      employeeId: 'demo-2',
      employee: 'John Smith',
      client: 'TechStart Inc',
      clientId: 'c2',
      clientTimezone: 'America/Chicago',
      profilePhoto: null,
      totalHours: 16,
      overtimeHours: 0,
      workedDays: 2,
      status: 'approved',
      dailyRecords: [
        { id: 'd4', date: '2026-03-09', clockIn: '2026-03-09T15:00:00Z', clockOut: '2026-03-09T23:00:00Z', billingStart: '2026-03-09T15:00:00Z', billingEnd: '2026-03-09T23:00:00Z', hours: 8, overtimeHours: 0, breaks: 0.5, status: 'approved', isLate: false, arrivalStatus: 'On Time', overtimeEntries: [], notes: '' },
        { id: 'd5', date: '2026-03-10', clockIn: '2026-03-10T15:00:00Z', clockOut: '2026-03-10T23:00:00Z', billingStart: '2026-03-10T15:00:00Z', billingEnd: '2026-03-10T23:00:00Z', hours: 8, overtimeHours: 0, breaks: 0, status: 'approved', isLate: false, arrivalStatus: 'On Time', overtimeEntries: [], notes: '' },
      ],
    },
    {
      employeeId: 'demo-3',
      employee: 'Sarah Johnson',
      client: 'Acme Corp',
      clientId: 'c1',
      clientTimezone: 'America/New_York',
      profilePhoto: null,
      totalHours: 8,
      overtimeHours: 0,
      workedDays: 1,
      status: 'active',
      dailyRecords: [
        { id: 'd6', date: '2026-03-10', clockIn: '2026-03-10T14:00:00Z', clockOut: null, billingStart: null, billingEnd: null, hours: null, overtimeHours: 0, breaks: 0, status: 'active', isLate: false, arrivalStatus: 'On Time', overtimeEntries: [], notes: '' },
      ],
    },
  ]);
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [stats, setStats] = useState({
    totalRecords: 0,
    pendingReview: 0,
    adjustments: 0,
    flagged: 0,
  });
  const [clients, setClients] = useState([{ id: 'all', name: 'All Clients' }]);
  const [sessionEdits, setSessionEdits] = useState([]);
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Set default date range (current week)
  useEffect(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setStartDate(formatLocal(startOfWeek));
    setEndDate(formatLocal(endOfWeek));
  }, []);

  const fetchingClientsRef = useRef(false);
  const fetchingRecordsRef = useRef(false);

  // Fetch clients list
  useEffect(() => {
    const fetchClients = async () => {
      if (fetchingClientsRef.current) return;
      fetchingClientsRef.current = true;
      try {
        const response = await clientService.getClients({ limit: 100 });
        if (response?.success) {
          setClients([
            { id: 'all', name: 'All Clients' },
            ...response.data.clients.map(c => ({
              id: c.id,
              name: c.companyName,
            })),
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      } finally {
        fetchingClientsRef.current = false;
      }
    };
    fetchClients();
  }, []);

  // Fetch time records
  const fetchTimeRecords = async () => {
    if (fetchingRecordsRef.current) return;
    fetchingRecordsRef.current = true;
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 50,
      };
      if (selectedClient !== 'all') params.clientId = selectedClient;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (searchTerm) params.search = searchTerm;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await adminPortalService.getTimeRecords(params);
      if (response?.success) {
        setTimeRecords(response.data.records);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch time records:', error);
    } finally {
      setLoading(false);
      fetchingRecordsRef.current = false;
    }
  };

  // TODO: Remove static data and re-enable these fetches
  // // Fetch on filter/date changes
  // useEffect(() => {
  //   if (startDate && endDate) {
  //     fetchTimeRecords();
  //   }
  // }, [selectedClient, selectedStatus, startDate, endDate]);

  // // Debounce search term
  // useEffect(() => {
  //   if (!startDate || !endDate) return;
  //   const timer = setTimeout(() => {
  //     fetchTimeRecords();
  //   }, 300);
  //   return () => clearTimeout(timer);
  // }, [searchTerm]);

  // Group time records by client
  const clientGroups = useMemo(() => {
    const groups = new Map();
    for (const record of timeRecords) {
      const key = record.clientId || 'unassigned';
      if (!groups.has(key)) {
        groups.set(key, {
          clientId: key,
          clientName: record.client || 'Unassigned',
          employees: [],
          totalHours: 0,
          overtimeHours: 0,
          employeeCount: 0,
        });
      }
      const group = groups.get(key);
      group.employees.push(record);
      group.totalHours += record.totalHours;
      group.overtimeHours += record.overtimeHours;
      group.employeeCount++;
    }
    for (const group of groups.values()) {
      group.totalHours = Math.round(group.totalHours * 100) / 100;
      group.overtimeHours = Math.round(group.overtimeHours * 100) / 100;
    }
    return Array.from(groups.values());
  }, [timeRecords]);

  const toggleClient = (clientId) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleEmployee = (employeeId) => {
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClients(new Set(clientGroups.map(g => g.clientId)));
    setExpandedEmployees(new Set(timeRecords.map(r => r.employeeId)));
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedEmployees(new Set());
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success" size="xs">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning" size="xs">Pending</Badge>;
      case 'active':
        return <Badge variant="info" size="xs">Active</Badge>;
      case 'adjusted':
        return <Badge variant="primary" size="xs">Adjusted</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="xs">Rejected</Badge>;
      default:
        return <Badge variant="default" size="xs">{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format clock time to 12h display in client timezone when possible.
  // If `timeStr` is an ISO datetime string, convert to the given timezone.
  // If `timeStr` is HH:MM, convert to 12h with formatTime12.
  const fmtTime = (timeStr, tz) => {
    if (!timeStr) return '-';
    const timezone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // ISO datetime (contains 'T' or 'Z' or full date)
    if (timeStr.includes('T') || timeStr.includes('Z') || /\d{4}-\d{2}-\d{2}/.test(timeStr)) {
      try {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
        }
      } catch (e) {
        // fallthrough
      }
    }
    // 24h HH:MM or 12h strings
    if (/^\d{1,2}:\d{2}$/.test(timeStr) || /AM|PM/i.test(timeStr)) {
      return formatTime12(timeStr);
    }
    return timeStr;
  };

  // Convert 12h time string "HH:MM AM/PM" to 24h "HH:MM" for input
  const to24h = (timeStr, tz) => {
    if (!timeStr) return '';
    const timezone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // If it's an ISO datetime, convert using Date
    if (timeStr.includes('T') || timeStr.includes('Z') || /\d{4}-\d{2}-\d{2}/.test(timeStr)) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        });
      }
    }
    // Already 24h format
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    // Parse "HH:MM AM/PM" or "H:MM AM/PM"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '';
    let h = parseInt(match[1], 10);
    const m = match[2];
    const period = match[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m}`;
  };

  const handleAdjust = (record, employeeRecord) => {
    setSelectedRecord({
      ...record,
      employee: employeeRecord.employee,
      client: employeeRecord.client,
    });
    // Initialize editable session data
    const tz = employeeRecord.clientTimezone;
    const sessions = record.sessions && record.sessions.length > 0
      ? record.sessions.map((s) => ({
          id: s.id,
          clockIn: to24h(s.clockIn, tz),
          clockOut: to24h(s.clockOut, tz),
          hours: s.hours,
          breakMinutes: s.breakMinutes,
          status: s.status,
          notes: s.notes || '',
        }))
      : [{
          id: record.id,
          clockIn: to24h(record.clockIn, tz),
          clockOut: to24h(record.clockOut, tz),
          hours: record.hours,
          breakMinutes: 0,
          status: record.status,
          notes: '',
        }];
    setSessionEdits(sessions);
    setAdjustmentNotes(record.notes || '');
    setShowAdjustment(true);
  };

  const updateSessionEdit = (idx, field, value) => {
    setSessionEdits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSaveAdjustment = async () => {
    if (!selectedRecord) return;
    setSaving(true);
    try {
      const response = await adminPortalService.adjustTimeRecord(selectedRecord.id, {
        sessions: sessionEdits.map(s => ({
          id: s.id,
          clockIn: s.clockIn,
          clockOut: s.clockOut,
          notes: s.notes,
        })),
        notes: adjustmentNotes,
      });
      if (response?.success) {
        setShowAdjustment(false);
        fetchTimeRecords();
      }
    } catch (error) {
      console.error('Failed to adjust time record:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const headers = ['Employee', 'Client', 'Date', 'Actual In', 'Actual Out', 'Billing In', 'Billing Out', 'Hours', 'OT Hours', 'Breaks', 'Status'];
    const rows = [];
    for (const emp of timeRecords) {
      for (const day of emp.dailyRecords) {
        rows.push([
          `"${emp.employee}"`,
          `"${emp.client}"`,
          day.date,
          fmtTime(day.clockIn, emp.clientTimezone) || 'N/A',
          fmtTime(day.clockOut, emp.clientTimezone) || 'N/A',
          fmtTime(day.billingStart, emp.clientTimezone) || 'N/A',
          fmtTime(day.billingEnd, emp.clientTimezone) || 'N/A',
          day.hours || 0,
          day.overtimeHours || 0,
          day.breaks || 0,
          day.status,
        ].join(','));
      }
    }
    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-records-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compute totals from all records
  const totals = useMemo(() => {
    let totalHours = 0;
    let overtimeHours = 0;
    for (const r of timeRecords) {
      totalHours += r.totalHours || 0;
      overtimeHours += r.overtimeHours || 0;
    }
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      regularHours: Math.round((totalHours - overtimeHours) * 100) / 100,
    };
  }, [timeRecords]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-sm text-gray-500 mt-1">View and manage all employee time records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {/* <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRecords}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatHours(totals.totalHours)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Regular</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatHours(totals.regularHours)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</p>
          <p className={`text-2xl font-bold mt-1 ${totals.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {formatHours(totals.overtimeHours)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Now</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.adjustments}</p>
        </Card>
      </div> */}

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input w-full py-2 text-sm"
                style={{ paddingLeft: '2.25rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Client */}
          <div className="w-[calc(50%-6px)] sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
            <select
              className="input w-full py-2 text-sm sm:w-40"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="w-[calc(50%-6px)] sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              className="input w-full py-2 text-sm sm:w-32"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input py-2 text-sm w-full sm:w-36"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-gray-400 text-xs flex-shrink-0">to</span>
              <input
                type="date"
                className="input py-2 text-sm w-full sm:w-36"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Refresh */}
          <div>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchTimeRecords} />
          </div>
        </div>
      </Card>

      {/* Time Records Table */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : timeRecords.length > 0 ? (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="text-left py-3 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actual In/Out</th>
                  <th className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Billing In/Out</th>
                  <th className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Break</th>
                  <th className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Regular</th>
                  <th className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    OT
                    <span className="text-[9px] font-medium text-gray-400 normal-case tracking-normal block">Ext / Off‑Shift</span>
                  </th>
                  <th className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {timeRecords.flatMap((empRecord) =>
                  empRecord.dailyRecords.map((day, dayIdx) => (
                    <tr key={`${empRecord.employeeId}-${day.id}`} className={`hover:bg-gray-50/50 ${dayIdx === 0 ? 'border-t border-gray-200' : 'border-t border-gray-50'}`}>
                      {/* Employee + Company — only on first row, spans all days */}
                      {dayIdx === 0 && (
                        <td className="py-2.5 px-4 align-top" rowSpan={empRecord.dailyRecords.length}>
                          <div className="flex items-center gap-2.5 sticky top-0">
                            <Avatar name={empRecord.employee} size="sm" src={empRecord.profilePhoto} />
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{empRecord.employee}</p>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded mt-0.5">
                                <Building2 className="w-3 h-3" />
                                {empRecord.client}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Date */}
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-gray-900 text-xs">{formatDate(day.date)}</span>
                        {(day.isLate || day.arrivalStatus === 'Late') && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-red-100 text-red-700">
                            Late{day.lateMinutes ? ` ${day.lateMinutes}m` : ''}
                          </span>
                        )}
                        {!day.isLate && day.arrivalStatus === 'Early' && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-blue-100 text-blue-700">
                            Early
                          </span>
                        )}
                      </td>

                      {/* Actual In/Out */}
                      <td className="py-2.5 px-2 text-xs text-center">
                        <span className="text-gray-700">{fmtTime(day.clockIn, empRecord.clientTimezone)}</span>
                        <span className="text-gray-300 mx-1">–</span>
                        {day.clockOut ? (
                          <span className="text-gray-700">{fmtTime(day.clockOut, empRecord.clientTimezone)}</span>
                        ) : day.status === 'active' ? (
                          <span className="text-green-600 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Now
                          </span>
                        ) : <span className="text-gray-400">-</span>}
                      </td>

                      {/* Billing In/Out */}
                      <td className="py-2.5 px-2 text-xs text-center">
                        {day.billingStart && day.billingEnd ? (
                          <span className="text-blue-700 font-medium">
                            {fmtTime(day.billingStart, empRecord.clientTimezone)}
                            <span className="text-blue-300 mx-1">–</span>
                            {fmtTime(day.billingEnd, empRecord.clientTimezone)}
                          </span>
                        ) : day.status === 'active' ? (
                          <span className="text-gray-400 italic">In progress</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Break */}
                      <td className="py-2.5 px-2 text-center">
                        {day.breaks > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                            <Coffee className="w-3 h-3" />
                            {formatHours(day.breaks)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>

                      {/* Regular Hours */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-semibold text-gray-900 text-xs">
                          {day.hours != null ? formatHours(Math.max(0, (day.hours || 0) - (day.overtimeHours || 0))) : '-'}
                        </span>
                      </td>

                      {/* OT (Ext / Off-Shift) */}
                      <td className="py-2.5 px-2 text-center">
                        {(() => {
                          const shiftExtEntries = (day.overtimeEntries || []).filter(o => o.type === 'SHIFT_EXTENSION');
                          const offShiftEntries = (day.overtimeEntries || []).filter(o => o.type === 'OFF_SHIFT');
                          if (shiftExtEntries.length > 0 || offShiftEntries.length > 0) {
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                {shiftExtEntries.map((ot, i) => (
                                  <span key={i} className="text-[10px] text-purple-600 font-medium">{formatDuration(ot.requestedMinutes)} ext</span>
                                ))}
                                {offShiftEntries.map((ot, i) => (
                                  <span key={i} className="text-[10px] text-orange-600 font-medium">{formatDuration(ot.requestedMinutes)} off</span>
                                ))}
                              </div>
                            );
                          }
                          return <span className="text-gray-300 text-xs">—</span>;
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-2 text-center">
                        {getStatusBadge(day.status)}
                        {day.notes && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[100px] mx-auto" title={day.notes}>
                            {day.notes}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleAdjust(day, empRecord)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                          title="Adjust"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-50">
              {timeRecords.flatMap((empRecord) =>
                empRecord.dailyRecords.map((day) => (
                  <div key={`${empRecord.employeeId}-${day.id}-m`} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={empRecord.employee} size="sm" src={empRecord.profilePhoto} />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{empRecord.employee}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
                            <Building2 className="w-2.5 h-2.5" />
                            {empRecord.client}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(day.status)}
                        <button
                          onClick={() => handleAdjust(day, empRecord)}
                          className="p-1 text-gray-400 hover:text-primary rounded"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-gray-900 mb-1">
                      {formatDate(day.date)}
                      {(day.isLate || day.arrivalStatus === 'Late') && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-red-100 text-red-700">Late</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Actual: {fmtTime(day.clockIn, empRecord.clientTimezone)} → {day.clockOut ? fmtTime(day.clockOut, empRecord.clientTimezone) : (day.status === 'active' ? 'Now' : '-')}
                    </p>
                    {day.billingStart && day.billingEnd && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        Billing: {fmtTime(day.billingStart, empRecord.clientTimezone)} → {fmtTime(day.billingEnd, empRecord.clientTimezone)}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs mt-2">
                      <div>
                        <span className="text-gray-400">Regular</span>
                        <p className="font-semibold text-gray-900">{day.hours != null ? formatHours(Math.max(0, (day.hours || 0) - (day.overtimeHours || 0))) : '-'}</p>
                      </div>
                      {day.breaks > 0 && (
                        <div>
                          <span className="text-gray-400">Break</span>
                          <p className="text-yellow-600">{formatHours(day.breaks)}</p>
                        </div>
                      )}
                    </div>
                    {day.overtimeEntries && day.overtimeEntries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {day.overtimeEntries.map((ot, otIdx) => {
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
                              +{formatDuration(ot.requestedMinutes)} · {badgeLabel}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No time records found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters or date range</p>
          </div>
        )}
      </Card>

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustment}
        onClose={() => setShowAdjustment(false)}
        title="Adjust Time Record"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdjustment(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveAdjustment} disabled={saving}>
              {saving ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </>
        }
      >
        {selectedRecord && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Employee</p>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">{selectedRecord.employee}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Client</p>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">{selectedRecord.client}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Date</p>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">{selectedRecord.date ? formatDate(selectedRecord.date) : '-'}</p>
                </div>
              </div>
            </div>

            {/* Editable Sessions */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Sessions ({sessionEdits.length})
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {sessionEdits.map((session, idx) => (
                  <div key={session.id || idx} className="p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-900">Session {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {session.hours != null && (
                          <span className="text-xs text-gray-500">{formatHours(session.hours)}</span>
                        )}
                        {session.breakMinutes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-yellow-600">
                            <Coffee className="w-3 h-3" />
                            {session.breakMinutes}m break
                          </span>
                        )}
                        {session.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-gray-400 uppercase">Clock In</label>
                        <input
                          type="time"
                          className="input mt-1 text-sm"
                          value={session.clockIn}
                          onChange={(e) => updateSessionEdit(idx, 'clockIn', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-gray-400 uppercase">Clock Out</label>
                        {session.status === 'ACTIVE' ? (
                          <p className="text-sm font-medium text-green-600 mt-1 py-2">In Progress</p>
                        ) : (
                          <input
                            type="time"
                            className="input mt-1 text-sm"
                            value={session.clockOut}
                            onChange={(e) => updateSessionEdit(idx, 'clockOut', e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overtime Entries (read-only) */}
            {selectedRecord.overtimeEntries && selectedRecord.overtimeEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Overtime ({selectedRecord.overtimeEntries.length})
                </p>
                <div className="space-y-2">
                  {selectedRecord.overtimeEntries.map((ot, otIdx) => {
                    const isApproved = ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED';
                    const isDenied = ot.status === 'REJECTED';
                    const borderColor = isApproved ? 'border-green-200 bg-green-50' : isDenied ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
                    const badgeColor = isApproved ? 'bg-green-100 text-green-800' : isDenied ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
                    const badgeLabel = isApproved ? 'Approved' : isDenied ? 'Denied' : 'Pending';
                    const timeRange = ot.type === 'OFF_SHIFT'
                      ? `${formatTime12(ot.requestedStartTime)} → ${formatTime12(ot.requestedEndTime)}`
                      : ot.estimatedEndTime ? `until ${formatTime12(ot.estimatedEndTime)}` : '';
                    return (
                      <div key={ot.id || otIdx} className={`p-3 rounded-lg border ${borderColor}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded ${badgeColor}`}>
                              +{formatDuration(ot.requestedMinutes)} · {badgeLabel}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase">
                              {ot.type === 'OFF_SHIFT' ? 'Off-Shift' : 'Extension'}
                            </span>
                          </div>
                        </div>
                        {timeRange && (
                          <p className="text-xs text-gray-500 mt-1">{timeRange}</p>
                        )}
                        {ot.reason && (
                          <p className="text-[10px] text-gray-400 mt-1 italic">{ot.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day Totals */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-center">
                <p className="text-[10px] font-medium text-gray-400 uppercase">Total</p>
                <p className="font-semibold text-gray-900 text-sm">{formatHours(selectedRecord.hours)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium text-gray-400 uppercase">Overtime</p>
                <p className={`font-semibold text-sm ${selectedRecord.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {formatHours(selectedRecord.overtimeHours)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium text-gray-400 uppercase">Breaks</p>
                <p className="font-semibold text-yellow-600 text-sm">{formatHours(selectedRecord.breaks)}</p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Adjustment Reason</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Reason for adjustment..."
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
              />
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">
                This adjustment will be logged and visible to the client for approval.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimeRecords;
