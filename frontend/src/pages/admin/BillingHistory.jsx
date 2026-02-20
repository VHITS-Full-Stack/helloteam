import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Loader2,
  DollarSign,
  Calendar,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
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
} from '../../components/common';
import rateHistoryService from '../../services/rateHistory.service';

const BillingHistory = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [error, setError] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rateTypeFilter, setRateTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await rateHistoryService.getRateHistory({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        rateType: rateTypeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      if (response.success) {
        setHistory(response.data.history || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages,
        }));
        setStats(response.data.stats || null);
      } else {
        setError(response.error || 'Failed to load rate history');
      }
    } catch (err) {
      console.error('Error fetching rate history:', err);
      setError('Failed to load rate history');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, rateTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearch, rateTypeFilter, dateFrom, dateTo]);

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

  const formatRate = (value) => {
    if (value === null || value === undefined) return '—';
    return `$${Number(value).toFixed(2)}`;
  };

  const getRateTypeBadge = (rateType) => {
    const config = {
      BILLING_RATE: { label: 'Billing Rate', variant: 'info' },
      PAYABLE_RATE: { label: 'Payable Rate', variant: 'warning' },
      HOURLY_RATE: { label: 'Hourly Rate', variant: 'success' },
      OVERTIME_RATE: { label: 'Overtime Rate', variant: 'danger' },
    };
    const { label, variant } = config[rateType] || { label: rateType, variant: 'default' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getChangeIndicator = (oldValue, newValue) => {
    const oldNum = oldValue !== null && oldValue !== undefined ? Number(oldValue) : null;
    const newNum = newValue !== null && newValue !== undefined ? Number(newValue) : null;

    if (oldNum === null && newNum !== null) {
      // New rate set
      return (
        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
          <ArrowUpRight className="w-4 h-4" />
          +${newNum.toFixed(2)}
        </span>
      );
    }

    if (oldNum !== null && newNum === null) {
      // Rate removed
      return (
        <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
          <Minus className="w-4 h-4" />
          Removed
        </span>
      );
    }

    if (oldNum !== null && newNum !== null) {
      const diff = newNum - oldNum;
      if (diff > 0) {
        return (
          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
            <ArrowUpRight className="w-4 h-4" />
            +${diff.toFixed(2)}
          </span>
        );
      } else if (diff < 0) {
        return (
          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
            <ArrowDownRight className="w-4 h-4" />
            -${Math.abs(diff).toFixed(2)}
          </span>
        );
      }
    }

    return <span className="text-gray-400">No change</span>;
  };

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  };

  const exportHistory = () => {
    const headers = ['Date', 'Employee', 'Client', 'Rate Type', 'Old Rate', 'New Rate', 'Changed By'];
    const rows = history.map(h => [
      formatDateTime(h.changeDate),
      `${h.employee?.firstName || ''} ${h.employee?.lastName || ''}`.trim(),
      h.clientName || 'Base Rate',
      h.rateType,
      formatRate(h.oldValue),
      formatRate(h.newValue),
      h.changedByName || 'Unknown',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing & Pay Raise History</h2>
          <p className="text-gray-500">Track all changes to employee billing and payment rates</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            icon={Download}
            onClick={exportHistory}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalChanges}</p>
                <p className="text-sm text-gray-500">Total Changes</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.recentChanges}</p>
                <p className="text-sm text-gray-500">Last 30 Days</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.employeesAffected}</p>
                <p className="text-sm text-gray-500">Employees Affected</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Employee</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name..."
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
              <select
                value={rateTypeFilter}
                onChange={(e) => setRateTypeFilter(e.target.value)}
                className="input"
              >
                <option value="">All Types</option>
                <option value="BILLING_RATE">Billing Rate</option>
                <option value="PAYABLE_RATE">Payable Rate</option>
                <option value="HOURLY_RATE">Hourly Rate</option>
                <option value="OVERTIME_RATE">Overtime Rate</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input"
              />
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchTerm('');
                setRateTypeFilter('');
                setDateFrom('');
                setDateTo('');
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
          <button onClick={fetchHistory} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* History Table */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length > 0 ? (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Rate Type</TableHeader>
                  <TableHeader>Old Rate</TableHeader>
                  <TableHeader>New Rate</TableHeader>
                  <TableHeader>Change</TableHeader>
                  <TableHeader>Changed By</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className="text-sm text-gray-600">{formatDateTime(record.changeDate)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
                          {getInitials(record.employee?.firstName, record.employee?.lastName)}
                        </div>
                        <span className="text-sm font-medium">
                          {record.employee?.firstName} {record.employee?.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {record.clientName || (
                          <span className="text-gray-400 italic">Base Rate</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{getRateTypeBadge(record.rateType)}</TableCell>
                    <TableCell>
                      <span className="text-sm font-mono text-gray-600">{formatRate(record.oldValue)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono font-medium">{formatRate(record.newValue)}</span>
                    </TableCell>
                    <TableCell>
                      {getChangeIndicator(record.oldValue, record.newValue)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">{record.changedByName || 'Unknown'}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.pages > 1 && (
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
                    disabled={pagination.page >= pagination.pages}
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
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No rate changes found</h3>
            <p className="text-gray-500">Rate changes will appear here when employee billing or payment rates are modified</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BillingHistory;
