import { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, Download, Filter, Search, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Modal
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

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

  const fetchTimeRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getTimeRecords({
        startDate: currentWeek.start.toISOString().split('T')[0],
        endDate: currentWeek.end.toISOString().split('T')[0],
        status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
        search: searchQuery || undefined,
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
    }
  }, [currentWeek, statusFilter, searchQuery]);

  useEffect(() => {
    fetchTimeRecords();
  }, [fetchTimeRecords]);

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getCellClass = (hours) => {
    if (!hours || hours === 0) return 'text-gray-300';
    if (hours > 8) return 'text-orange-600 font-medium';
    return 'text-gray-900';
  };

  const handleExport = () => {
    // Generate CSV data
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
          <p className="text-sm text-gray-500">Employees</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalEmployees}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalHours}h</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Regular Hours</p>
          <p className="text-2xl font-bold text-green-600">{summary.regularHours}h</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Overtime</p>
          <p className="text-2xl font-bold text-orange-600">{summary.overtimeHours}h</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Pending</p>
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
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input pl-10 w-full md:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Time Records Table */}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader className="text-center">Mon</TableHeader>
                  <TableHeader className="text-center">Tue</TableHeader>
                  <TableHeader className="text-center">Wed</TableHeader>
                  <TableHeader className="text-center">Thu</TableHeader>
                  <TableHeader className="text-center">Fri</TableHeader>
                  <TableHeader className="text-center">Sat</TableHeader>
                  <TableHeader className="text-center">Sun</TableHeader>
                  <TableHeader className="text-center">Total</TableHeader>
                  <TableHeader className="text-center">OT</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {timeRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={record.employee} src={record.profilePhoto} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900">{record.employee}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.mon)}`}>
                      {record.dailyHours?.mon > 0 ? record.dailyHours.mon : '-'}
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.tue)}`}>
                      {record.dailyHours?.tue > 0 ? record.dailyHours.tue : '-'}
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.wed)}`}>
                      {record.dailyHours?.wed > 0 ? record.dailyHours.wed : '-'}
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.thu)}`}>
                      {record.dailyHours?.thu > 0 ? record.dailyHours.thu : '-'}
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.fri)}`}>
                      {record.dailyHours?.fri > 0 ? record.dailyHours.fri : '-'}
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.sat)}`}>
                      {record.dailyHours?.sat > 0 ? record.dailyHours.sat : '-'}
                    </TableCell>
                    <TableCell className={`text-center ${getCellClass(record.dailyHours?.sun)}`}>
                      {record.dailyHours?.sun > 0 ? record.dailyHours.sun : '-'}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-gray-900">
                      {record.totalHours}h
                    </TableCell>
                    <TableCell className="text-center">
                      {record.overtimeHours > 0 ? (
                        <span className="text-orange-600 font-medium">+{record.overtimeHours}h</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Overtime</span>
        </div>
      </div>

      {/* Record Detail Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Time Record Details"
        size="md"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedRecord.employee} src={selectedRecord.profilePhoto} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedRecord.employee}</h3>
                <p className="text-gray-500">
                  Week of {formatWeekDisplay(currentWeek.start, currentWeek.end)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Total Hours</p>
                <p className="text-xl font-bold text-gray-900">{selectedRecord.totalHours}h</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Overtime</p>
                <p className="text-xl font-bold text-orange-600">{selectedRecord.overtimeHours}h</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Regular Hours</p>
                <p className="text-xl font-bold text-green-600">
                  {selectedRecord.totalHours - selectedRecord.overtimeHours}h
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(selectedRecord.status)}</div>
              </div>
            </div>

            {selectedRecord.records && selectedRecord.records.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Daily Breakdown</h4>
                <div className="space-y-2">
                  {selectedRecord.records.map((rec, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">
                        {new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          {((rec.totalMinutes || 0) + (rec.overtimeMinutes || 0)) / 60}h
                        </span>
                        {getStatusBadge(rec.status.toLowerCase())}
                      </div>
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
