import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Clock,
  Edit3,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Loader2,
  Calendar,
  User,
  Building2,
} from 'lucide-react';
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
  Modal,
} from '../../components/common';
import timeAdjustmentService from '../../services/timeAdjustment.service';

const TimeAdjustments = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [error, setError] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [hasAdjustmentsFilter, setHasAdjustmentsFilter] = useState('');

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Adjustment form
  const [adjustmentForm, setAdjustmentForm] = useState({
    newTotalMinutes: '',
    reason: '',
  });
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await timeAdjustmentService.getTimeRecords({
        search: search || undefined,
        status: statusFilter || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        hasAdjustments: hasAdjustmentsFilter || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (response.success) {
        setRecords(response.data.records || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }));
      } else {
        setError(response.error || 'Failed to load time records');
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Failed to load time records');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateRange.startDate, dateRange.endDate, hasAdjustmentsFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleAdjust = (record) => {
    setSelectedRecord(record);
    setAdjustmentForm({
      newTotalMinutes: record.totalMinutes.toString(),
      reason: '',
    });
    setShowAdjustModal(true);
  };

  const handleViewHistory = async (record) => {
    setSelectedRecord(record);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const response = await timeAdjustmentService.getAdjustmentHistory(record.id);
      if (response.success) {
        setAdjustmentHistory(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitAdjustment = async () => {
    if (!adjustmentForm.reason || adjustmentForm.reason.trim().length < 10) {
      alert('Please provide a reason (minimum 10 characters)');
      return;
    }

    setAdjustLoading(true);
    try {
      const response = await timeAdjustmentService.createAdjustment(selectedRecord.id, {
        newTotalMinutes: parseInt(adjustmentForm.newTotalMinutes, 10),
        reason: adjustmentForm.reason.trim(),
      });

      if (response.success) {
        setShowAdjustModal(false);
        setSelectedRecord(null);
        fetchRecords();
      } else {
        alert(response.error || 'Failed to create adjustment');
      }
    } catch (err) {
      console.error('Error creating adjustment:', err);
      alert('Failed to create adjustment');
    } finally {
      setAdjustLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Handle YYYY-MM-DD format to avoid timezone issues
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatMinutes = (minutes) => {
    if (!minutes && minutes !== 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Adjustments</h2>
          <p className="text-gray-500">Review and adjust employee time records</p>
        </div>
        <Button
          variant="ghost"
          icon={Filter}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Search and Filters */}
      <Card padding="md">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Additional Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-end gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input appearance-none pr-9"
                  >
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustments</label>
                <div className="relative">
                  <select
                    value={hasAdjustmentsFilter}
                    onChange={(e) => setHasAdjustmentsFilter(e.target.value)}
                    className="input appearance-none pr-9"
                  >
                    <option value="">All Records</option>
                    <option value="true">Has Adjustments</option>
                    <option value="false">No Adjustments</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setDateRange({ startDate: '', endDate: '' });
                  setHasAdjustmentsFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={fetchRecords} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Records Table */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : records.length > 0 ? (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Hours</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Adjusted</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={record.employee.name} src={record.employee.profilePhoto} size="sm" />
                        <span className="font-medium">{record.employee.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span>{record.client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{formatMinutes(record.totalMinutes)}</span>
                        {record.originalMinutes !== null && record.originalMinutes !== record.totalMinutes && (
                          <span className="text-xs text-gray-500 ml-1">
                            (was {formatMinutes(record.originalMinutes)})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {record.hasAdjustments ? (
                        <Badge variant="warning" className="cursor-pointer" onClick={() => handleViewHistory(record)}>
                          <History className="w-3 h-3 mr-1" />
                          Adjusted
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit3}
                          onClick={() => handleAdjust(record)}
                        >
                          Adjust
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={History}
                          onClick={() => handleViewHistory(record)}
                        >
                          History
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No time records found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        )}
      </Card>

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Time Record"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdjustModal(false)} disabled={adjustLoading}>
              Cancel
            </Button>
            <Button variant="primary" icon={CheckCircle} onClick={submitAdjustment} disabled={adjustLoading}>
              {adjustLoading ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </>
        }
      >
        {selectedRecord && (
          <div className="space-y-6">
            {/* Record Info */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">{selectedRecord.employee.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">{selectedRecord.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{formatDate(selectedRecord.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Hours</span>
                <span className="font-medium">{formatMinutes(selectedRecord.totalMinutes)}</span>
              </div>
              {selectedRecord.originalMinutes !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Original Hours</span>
                  <span className="font-medium text-orange-600">{formatMinutes(selectedRecord.originalMinutes)}</span>
                </div>
              )}
            </div>

            {/* Warning if previously approved */}
            {selectedRecord.status === 'APPROVED' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">This record was already approved</p>
                  <p>Adjusting will reset approval status and require client re-approval.</p>
                </div>
              </div>
            )}

            {/* Adjustment Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Total Minutes
                </label>
                <input
                  type="number"
                  value={adjustmentForm.newTotalMinutes}
                  onChange={(e) => setAdjustmentForm(prev => ({ ...prev, newTotalMinutes: e.target.value }))}
                  className="input w-full"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {adjustmentForm.newTotalMinutes && formatMinutes(parseInt(adjustmentForm.newTotalMinutes, 10))}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Adjustment <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="input w-full"
                  rows={3}
                  placeholder="Explain why this adjustment is being made (min 10 characters)..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {adjustmentForm.reason.length}/10 characters minimum
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Adjustment History"
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Record Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar name={selectedRecord.employee.name} src={selectedRecord.employee.profilePhoto} size="md" />
                <div>
                  <p className="font-medium">{selectedRecord.employee.name}</p>
                  <p className="text-sm text-gray-500">{formatDate(selectedRecord.date)} - {selectedRecord.client.name}</p>
                </div>
              </div>
            </div>

            {/* History List */}
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : adjustmentHistory.length > 0 ? (
              <div className="space-y-3">
                {adjustmentHistory.map((adj) => (
                  <div key={adj.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {adj.fieldChanged === 'totalMinutes' && (
                            <>
                              Time changed: {formatMinutes(adj.oldTotalMinutes)} → {formatMinutes(adj.newTotalMinutes)}
                            </>
                          )}
                          {adj.fieldChanged !== 'totalMinutes' && (
                            <>
                              {adj.fieldChanged} changed
                            </>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          by {adj.adjuster?.email || 'Unknown'} on {formatDateTime(adj.adjustedAt)}
                        </p>
                      </div>
                      {adj.minutesDifference !== null && (
                        <Badge variant={adj.minutesDifference > 0 ? 'success' : 'danger'}>
                          {adj.minutesDifference > 0 ? '+' : ''}{adj.minutesDifference} min
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <span className="font-medium">Reason:</span> {adj.reason}
                    </p>
                    {adj.requiresReapproval && !adj.clientReapprovedAt && (
                      <div className="mt-2 flex items-center gap-1 text-sm text-orange-600">
                        <AlertTriangle className="w-4 h-4" />
                        Pending client re-approval
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No adjustment history for this record
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimeAdjustments;
