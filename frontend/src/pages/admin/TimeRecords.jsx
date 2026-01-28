import { useState, useEffect } from 'react';
import { Clock, Calendar, Download, Filter, Search, Building2, Edit, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
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

    setStartDate(startOfWeek.toISOString().split('T')[0]);
    setEndDate(endOfWeek.toISOString().split('T')[0]);
  }, []);

  // Fetch clients list
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await clientService.getClients({ limit: 100 });
        if (response.data?.success) {
          setClients([
            { id: 'all', name: 'All Clients' },
            ...response.data.data.clients.map(c => ({
              id: c.id,
              name: c.companyName,
            })),
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      }
    };
    fetchClients();
  }, []);

  // Fetch time records
  const fetchTimeRecords = async () => {
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
      if (response.data?.success) {
        setTimeRecords(response.data.data.records);
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch time records:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchTimeRecords();
    }
  }, [selectedClient, selectedStatus, searchTerm, startDate, endDate]);

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

  const handleAdjust = (record) => {
    setSelectedRecord(record);
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
      if (response.data?.success) {
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
    // Create CSV content
    const headers = ['Employee', 'Client', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status'];
    const csvContent = [
      headers.join(','),
      ...timeRecords.map(record =>
        [
          `"${record.employee}"`,
          `"${record.client}"`,
          record.date,
          record.clockIn || 'N/A',
          record.clockOut || 'Active',
          record.hours || 0,
          record.status,
        ].join(',')
      ),
    ].join('\n');

    // Download
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
              <p className="text-sm text-gray-500">Total Records</p>
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
            <div className="p-2 bg-purple-100 rounded-lg">
              <Edit className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.adjustments}</p>
              <p className="text-sm text-gray-500">Adjustments</p>
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
              <p className="text-sm text-gray-500">Flagged</p>
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
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
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

      {/* Time Records Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-gray-500 mt-2">Loading time records...</p>
          </div>
        ) : timeRecords.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Clock In</TableHeader>
                <TableHeader>Clock Out</TableHeader>
                <TableHeader>Hours</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {timeRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={record.employee} size="sm" src={record.profilePhoto} />
                      <span className="font-medium text-gray-900">{record.employee}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600">{record.client}</span>
                  </TableCell>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.clockIn || '-'}</TableCell>
                  <TableCell>
                    {record.clockOut || (
                      <span className="text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Active
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.hours !== null ? (
                      <span className={record.hours > 8 ? 'text-orange-600 font-medium' : ''}>
                        {record.hours}h
                        {record.overtimeHours > 0 && (
                          <span className="text-xs text-orange-500 ml-1">
                            (+{record.overtimeHours}h OT)
                          </span>
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      {getStatusBadge(record.status)}
                      {record.notes && (
                        <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={record.notes}>
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit}
                      onClick={() => handleAdjust(record)}
                    >
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <p className="font-medium text-gray-900">{selectedRecord.date}</p>
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
