import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  FileText,
  Download,
  ChevronDown,
  Loader2,
  Eye,
  User,
  Calendar,
  Activity,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Modal,
} from '../../components/common';
import timeAdjustmentService from '../../services/timeAdjustment.service';

const AuditLog = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [error, setError] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsResponse, statsResponse] = await Promise.all([
        timeAdjustmentService.getAuditLogs({
          action: actionFilter || undefined,
          entityType: entityTypeFilter || undefined,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          page: pagination.page,
          limit: pagination.limit,
        }),
        timeAdjustmentService.getAuditLogStats(),
      ]);

      if (logsResponse.success) {
        setLogs(logsResponse.data.logs || []);
        setPagination(prev => ({
          ...prev,
          total: logsResponse.data.pagination.total,
          totalPages: logsResponse.data.pagination.totalPages,
        }));
      } else {
        setError(logsResponse.error || 'Failed to load audit logs');
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityTypeFilter, dateRange.startDate, dateRange.endDate, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getActionBadge = (action) => {
    const variants = {
      CREATE: 'success',
      UPDATE: 'info',
      DELETE: 'danger',
      APPROVE: 'success',
      REJECT: 'danger',
      LOGIN: 'default',
      LOGOUT: 'default',
      EXPORT: 'warning',
      ADJUSTMENT: 'warning',
    };
    return <Badge variant={variants[action] || 'default'}>{action}</Badge>;
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const exportLogs = () => {
    // Create CSV content
    const headers = ['Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'Description'];
    const rows = logs.map(log => [
      formatDateTime(log.createdAt),
      log.user?.email || 'Unknown',
      log.action,
      log.entityType,
      log.entityId || '-',
      log.description,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
          <p className="text-gray-500">Track all system changes and user actions</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            icon={Download}
            onClick={exportLogs}
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            icon={Filter}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.todayCount}</p>
                <p className="text-sm text-gray-500">Today</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.weekCount}</p>
                <p className="text-sm text-gray-500">This Week</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">By Action (This Week)</p>
              <div className="flex flex-wrap gap-1">
                {stats.byAction?.slice(0, 3).map(a => (
                  <Badge key={a.action} variant="default" className="text-xs">
                    {a.action}: {a.count}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">By Entity (This Week)</p>
              <div className="flex flex-wrap gap-1">
                {stats.byEntityType?.slice(0, 3).map(e => (
                  <Badge key={e.entityType} variant="default" className="text-xs">
                    {e.entityType}: {e.count}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <div className="relative">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="input appearance-none pr-9"
                >
                  <option value="">All Actions</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="APPROVE">Approve</option>
                  <option value="REJECT">Reject</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGOUT">Logout</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <div className="relative">
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="input appearance-none pr-9"
                >
                  <option value="">All Types</option>
                  <option value="TimeRecord">Time Records</option>
                  <option value="LeaveRequest">Leave Requests</option>
                  <option value="Employee">Employees</option>
                  <option value="Client">Clients</option>
                  <option value="User">Users</option>
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
            <Button
              variant="ghost"
              onClick={() => {
                setActionFilter('');
                setEntityTypeFilter('');
                setDateRange({ startDate: '', endDate: '' });
              }}
            >
              Clear
            </Button>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={fetchLogs} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Logs Table */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : logs.length > 0 ? (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Timestamp</TableHeader>
                  <TableHeader>User</TableHeader>
                  <TableHeader>Action</TableHeader>
                  <TableHeader>Entity</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Details</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className="text-sm text-gray-600">{formatDateTime(log.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{log.user?.email || 'System'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.entityType}</p>
                        {log.entityId && (
                          <p className="text-xs text-gray-500 truncate max-w-[120px]" title={log.entityId}>
                            {log.entityId}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-700 max-w-xs truncate" title={log.description}>
                        {log.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => handleViewDetails(log)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
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
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No audit logs found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Audit Log Details"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Timestamp</p>
                <p className="font-medium">{formatDateTime(selectedLog.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">User</p>
                <p className="font-medium">{selectedLog.user?.email || 'System'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Action</p>
                <p>{getActionBadge(selectedLog.action)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entity Type</p>
                <p className="font-medium">{selectedLog.entityType}</p>
              </div>
              {selectedLog.entityId && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Entity ID</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                    {selectedLog.entityId}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="p-3 bg-gray-50 rounded-lg">{selectedLog.description}</p>
            </div>

            {/* Old Values */}
            {selectedLog.oldValues && Object.keys(selectedLog.oldValues).length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Previous Values</p>
                <pre className="p-3 bg-red-50 rounded-lg text-sm overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.oldValues, null, 2)}
                </pre>
              </div>
            )}

            {/* New Values */}
            {selectedLog.newValues && Object.keys(selectedLog.newValues).length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-1">New Values</p>
                <pre className="p-3 bg-green-50 rounded-lg text-sm overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.newValues, null, 2)}
                </pre>
              </div>
            )}

            {/* Metadata */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Additional Data</p>
                <pre className="p-3 bg-gray-50 rounded-lg text-sm overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Context */}
            {(selectedLog.ipAddress || selectedLog.userAgent) && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Request Context</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedLog.ipAddress && (
                    <div>
                      <p className="text-gray-500">IP Address</p>
                      <p className="font-mono">{selectedLog.ipAddress}</p>
                    </div>
                  )}
                  {selectedLog.userAgent && (
                    <div className="col-span-2">
                      <p className="text-gray-500">User Agent</p>
                      <p className="font-mono text-xs break-all">{selectedLog.userAgent}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLog;
