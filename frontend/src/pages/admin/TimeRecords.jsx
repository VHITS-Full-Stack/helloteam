import { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Calendar, Download, Filter, Search, Building2, Edit, AlertCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
} from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';
import clientService from '../../services/client.service';

const TimeRecords = () => {
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [timeRecords, setTimeRecords] = useState([]);
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [stats, setStats] = useState({
    totalRecords: 0,
    pendingReview: 0,
    adjustments: 0,
    flagged: 0,
  });
  const [clients, setClients] = useState([{ id: 'all', name: 'All Clients' }]);
  const [adjustmentData, setAdjustmentData] = useState({
    clockIn: '',
    clockOut: '',
    notes: '',
  });
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

  // Fetch on filter/date changes (not searchTerm — that's debounced below)
  useEffect(() => {
    if (startDate && endDate) {
      fetchTimeRecords();
    }
  }, [selectedClient, selectedStatus, startDate, endDate]);

  // Debounce search term
  useEffect(() => {
    if (!startDate || !endDate) return;
    const timer = setTimeout(() => {
      fetchTimeRecords();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleEmployee = (employeeId) => {
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
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
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'active':
        return <Badge variant="info">Active</Badge>;
      case 'adjusted':
        return <Badge variant="primary">Adjusted</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

  const handleAdjust = (record, employeeRecord) => {
    setSelectedRecord({
      ...record,
      employee: employeeRecord.employee,
      client: employeeRecord.client,
    });
    setAdjustmentData({
      clockIn: record.clockIn ? record.clockIn.replace(' AM', '').replace(' PM', '') : '',
      clockOut: record.clockOut ? record.clockOut.replace(' AM', '').replace(' PM', '') : '',
      notes: record.notes || '',
    });
    setShowAdjustment(true);
  };

  const handleSaveAdjustment = async () => {
    if (!selectedRecord) return;
    setSaving(true);
    try {
      const response = await adminPortalService.adjustTimeRecord(selectedRecord.id, adjustmentData);
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
    const headers = ['Employee', 'Client', 'Date', 'Clock In', 'Clock Out', 'Hours', 'OT Hours', 'Breaks', 'Status'];
    const rows = [];
    for (const emp of timeRecords) {
      for (const day of emp.dailyRecords) {
        rows.push([
          `"${emp.employee}"`,
          `"${emp.client}"`,
          day.date,
          day.clockIn || 'N/A',
          day.clockOut || 'N/A',
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-gray-500">View and manage all employee time records</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={RefreshCw} onClick={fetchTimeRecords}>
            Refresh
          </Button>
          <Button variant="outline" icon={Download} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
              <p className="text-sm text-gray-500">Total Employees</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingReview}</p>
              <p className="text-sm text-gray-500">Pending Review</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.adjustments}</p>
              <p className="text-sm text-gray-500">Active Now</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.flagged}</p>
              <p className="text-sm text-gray-500">Overtime</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-400" />
            <select
              className="input w-48"
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
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              className="input w-36"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              className="input w-40"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              className="input w-40"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input w-full"
                style={{ paddingLeft: '2.5rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Time Records Accordion */}
      <Card padding="none">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-gray-500 mt-2">Loading time records...</p>
          </div>
        ) : clientGroups.length > 0 ? (
          <div>
            {/* Accordion Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-500">
                  {clientGroups.length} client{clientGroups.length !== 1 ? 's' : ''} &middot; {timeRecords.length} employee{timeRecords.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Expand All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={collapseAll}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Client Groups */}
            <div className="divide-y divide-gray-200">
              {clientGroups.map((clientGroup) => {
                const isClientExpanded = expandedClients.has(clientGroup.clientId);
                return (
                  <div key={clientGroup.clientId}>
                    {/* Client Header Row */}
                    <div
                      className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors bg-white"
                      onClick={() => toggleClient(clientGroup.clientId)}
                    >
                      <div className="flex-shrink-0 text-gray-400">
                        {isClientExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{clientGroup.clientName}</p>
                          <p className="text-sm text-gray-500">
                            {clientGroup.employeeCount} employee{clientGroup.employeeCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 flex-1 justify-end">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatHours(clientGroup.totalHours)}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        {clientGroup.overtimeHours > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-semibold text-orange-600">{formatHours(clientGroup.overtimeHours)}</p>
                            <p className="text-xs text-gray-500">Overtime</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Employees under this client */}
                    {isClientExpanded && (
                      <div className="divide-y divide-gray-100">
                        {clientGroup.employees.map((empRecord) => {
                          const isEmpExpanded = expandedEmployees.has(empRecord.employeeId);
                          return (
                            <div key={empRecord.employeeId}>
                              {/* Employee Summary Row */}
                              <div
                                className="flex items-center gap-4 px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors pl-14"
                                onClick={() => toggleEmployee(empRecord.employeeId)}
                              >
                                <div className="flex-shrink-0 text-gray-400">
                                  {isEmpExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex items-center gap-3 min-w-[180px]">
                                  <Avatar name={empRecord.employee} size="sm" src={empRecord.profilePhoto} />
                                  <p className="font-medium text-gray-900">{empRecord.employee}</p>
                                </div>
                                <div className="flex items-center gap-6 flex-1 justify-end">
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">{formatHours(empRecord.totalHours)}</p>
                                    <p className="text-xs text-gray-500">Total</p>
                                  </div>
                                  {empRecord.overtimeHours > 0 && (
                                    <div className="text-right">
                                      <p className="text-sm font-semibold text-orange-600">{formatHours(empRecord.overtimeHours)}</p>
                                      <p className="text-xs text-gray-500">Overtime</p>
                                    </div>
                                  )}
                                  <div className="text-right">
                                    <p className="text-sm text-gray-700">{empRecord.workedDays}d</p>
                                    <p className="text-xs text-gray-500">Days</p>
                                  </div>
                                  <div className="min-w-[90px] text-right">
                                    {getStatusBadge(empRecord.status)}
                                  </div>
                                </div>
                              </div>

                              {/* Daily Records (expanded) */}
                              {isEmpExpanded && (
                                <div className="bg-gray-50/50">
                                  <div className="grid grid-cols-12 gap-2 px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-t border-gray-100">
                                    <div className="col-span-2 pl-16">Date</div>
                                    <div className="col-span-2">Clock In</div>
                                    <div className="col-span-2">Clock Out</div>
                                    <div className="col-span-2">Hours</div>
                                    <div className="col-span-1">Breaks</div>
                                    <div className="col-span-2">Status</div>
                                    <div className="col-span-1">Actions</div>
                                  </div>
                                  {empRecord.dailyRecords.map((day) => (
                                    <div
                                      key={day.id}
                                      className="grid grid-cols-12 gap-2 px-6 py-3 text-sm border-t border-gray-100 hover:bg-gray-100/50 items-center"
                                    >
                                      <div className="col-span-2 pl-16 text-gray-700 font-medium">
                                        {formatDate(day.date)}
                                      </div>
                                      <div className="col-span-2 text-gray-600">
                                        {day.clockIn || '-'}
                                      </div>
                                      <div className="col-span-2 text-gray-600">
                                        {day.clockOut || (
                                          day.status === 'active' ? (
                                            <span className="text-green-600 flex items-center gap-1">
                                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                              Active
                                            </span>
                                          ) : '-'
                                        )}
                                      </div>
                                      <div className="col-span-2">
                                        {day.hours !== null && day.hours !== undefined ? (
                                          <span className={day.overtimeHours > 0 ? 'text-orange-600 font-medium' : 'text-gray-900'}>
                                            {formatHours(day.hours)}
                                            {day.overtimeHours > 0 && (
                                              <span className="text-xs text-orange-500 ml-1">
                                                (+{formatHours(day.overtimeHours)} OT)
                                              </span>
                                            )}
                                          </span>
                                        ) : '-'}
                                      </div>
                                      <div className="col-span-1 text-gray-600">
                                        {day.breaks ? formatHours(day.breaks) : '-'}
                                      </div>
                                      <div className="col-span-2">
                                        {getStatusBadge(day.status)}
                                        {day.notes && (
                                          <p className="text-xs text-gray-500 mt-1 truncate max-w-[140px]" title={day.notes}>
                                            {day.notes}
                                          </p>
                                        )}
                                      </div>
                                      <div className="col-span-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAdjust(day, empRecord);
                                          }}
                                          className="text-gray-400 hover:text-primary-600 transition-colors p-1 rounded"
                                          title="Adjust"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No time records found</h3>
            <p className="text-gray-500">Try adjusting your filters or date range</p>
          </div>
        )}
      </Card>

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustment}
        onClose={() => setShowAdjustment(false)}
        title="Adjust Time Record"
        size="md"
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
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-medium text-gray-900">{selectedRecord.employee}</p>
              <p className="text-sm text-gray-500 mt-2">Client</p>
              <p className="font-medium text-gray-900">{selectedRecord.client}</p>
              <p className="text-sm text-gray-500 mt-2">Date</p>
              <p className="font-medium text-gray-900">{selectedRecord.date ? formatDate(selectedRecord.date) : '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Clock In</label>
                <input
                  type="time"
                  className="input"
                  value={adjustmentData.clockIn}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, clockIn: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Clock Out</label>
                <input
                  type="time"
                  className="input"
                  value={adjustmentData.clockOut}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, clockOut: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Adjustment Reason</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Reason for adjustment..."
                value={adjustmentData.notes}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
              />
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
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
