import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  Timer,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Modal } from '../../components/common';
import timeRecordService from '../../services/timeRecord.service';

const TimeRecords = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState(null);
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recordDetail, setRecordDetail] = useState(null);
  const [summaryPeriod, setSummaryPeriod] = useState('month');

  // Fetch time records
  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const result = await timeRecordService.getMyRecords(params);

      if (result?.success) {
        setRecords(result.records || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 0,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch time records:', err);
      setError('Failed to load time records. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const [summaryResult, payrollResult] = await Promise.allSettled([
        timeRecordService.getMySummary(summaryPeriod),
        timeRecordService.getMyPayroll(),
      ]);

      if (summaryResult.status === 'fulfilled' && summaryResult.value?.success) {
        setSummary(summaryResult.value.summary);
      }

      if (payrollResult.status === 'fulfilled' && payrollResult.value?.success) {
        setPayrollSummary(payrollResult.value);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, [summaryPeriod]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch record detail
  const fetchRecordDetail = async (recordId) => {
    try {
      setDetailLoading(true);
      const result = await timeRecordService.getRecordDetail(recordId);
      if (result?.success) {
        setRecordDetail(result);
      }
    } catch (err) {
      console.error('Failed to fetch record detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetail = async (record) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
    await fetchRecordDetail(record.id);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ status: '', startDate: '', endDate: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '--:--';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs}h ${mins}m`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success" icon={CheckCircle}>Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" icon={XCircle}>Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning" icon={Clock}>Pending</Badge>;
    }
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-gray-500">View your work history and time record status</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchRecords();
              fetchSummary();
            }}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            icon={Filter}
          >
            Filters
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary-100">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.totalHours || 0}h
                </p>
                <p className="text-xs text-gray-400">
                  {summary?.netWorkHours || 0}h net (excl. breaks)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved Hours</p>
                <p className="text-2xl font-bold text-green-600">
                  {summary?.approvedHours || 0}h
                </p>
                <p className="text-xs text-gray-400">
                  {summary?.approvedMinutes || 0} minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100">
                <Timer className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Hours</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {summary?.pendingHours || 0}h
                </p>
                <p className="text-xs text-gray-400">
                  Awaiting approval
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Days Worked</p>
                <p className="text-2xl font-bold text-purple-600">
                  {summary?.daysWorked || 0}
                </p>
                <p className="text-xs text-gray-400">
                  This {summaryPeriod}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Summary Period:</span>
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          {['week', 'month', 'year'].map((period) => (
            <button
              key={period}
              onClick={() => setSummaryPeriod(period)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${
                summaryPeriod === period
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payroll Summary Card */}
      {payrollSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Payroll Summary - {payrollSummary.payPeriod?.monthName} {payrollSummary.payPeriod?.year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {payrollSummary.summary?.totalApprovedHours || 0}h
                </p>
                <p className="text-sm text-gray-500">Approved Hours</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {payrollSummary.summary?.regularHours || 0}h
                </p>
                <p className="text-sm text-gray-500">Regular Hours</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {payrollSummary.summary?.totalOvertimeHours || 0}h
                </p>
                <p className="text-sm text-gray-500">Overtime Hours</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {payrollSummary.summary?.pendingRecordsCount || 0}
                </p>
                <p className="text-sm text-gray-500">Pending Records</p>
              </div>
            </div>

            {/* By Client Breakdown */}
            {payrollSummary.byClient && payrollSummary.byClient.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Hours by Client</h4>
                <div className="space-y-2">
                  {payrollSummary.byClient.map((client, index) => (
                    <div
                      key={client.client?.id || index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{client.client?.companyName || 'Unknown Client'}</p>
                        <p className="text-sm text-gray-500">{client.daysWorked} days worked</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatDuration(client.totalMinutes)}</p>
                        {client.overtimeMinutes > 0 && (
                          <p className="text-xs text-purple-600">+{formatDuration(client.overtimeMinutes)} OT</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Time Records List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Time Records
            {pagination.total > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({pagination.total} records)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Time Records Found</h3>
              <p className="text-gray-500">
                {filters.status || filters.startDate || filters.endDate
                  ? 'Try adjusting your filters to see more results.'
                  : 'Your time records will appear here once you start clocking in.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Scheduled</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actual</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Hours</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{formatDate(record.date)}</p>
                            {record.wasAdjusted && (
                              <Badge variant="info" size="sm">Adjusted</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {record.client?.companyName || '--'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {record.scheduledStart && record.scheduledEnd
                            ? `${formatTime(record.scheduledStart)} - ${formatTime(record.scheduledEnd)}`
                            : '--'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {record.actualStart && record.actualEnd
                            ? `${formatTime(record.actualStart)} - ${formatTime(record.actualEnd)}`
                            : record.actualStart
                            ? `${formatTime(record.actualStart)} - In Progress`
                            : '--'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className="font-semibold text-gray-900">
                            {formatDuration(record.netWorkMinutes)}
                          </p>
                          {record.overtimeMinutes > 0 && (
                            <p className="text-xs text-purple-600">
                              +{formatDuration(record.overtimeMinutes)} OT
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatusBadge(record.status)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(record)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      icon={ChevronLeft}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRecord(null);
          setRecordDetail(null);
        }}
        title="Time Record Details"
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : recordDetail ? (
          <div className="space-y-6">
            {/* Record Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {formatDate(recordDetail.record?.date)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {recordDetail.record?.client?.companyName || 'Unknown Client'}
                  </p>
                </div>
                {getStatusBadge(recordDetail.record?.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Scheduled</p>
                  <p className="font-medium">
                    {recordDetail.record?.scheduledStart && recordDetail.record?.scheduledEnd
                      ? `${formatTime(recordDetail.record.scheduledStart)} - ${formatTime(recordDetail.record.scheduledEnd)}`
                      : 'Not Scheduled'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Actual</p>
                  <p className="font-medium">
                    {recordDetail.record?.actualStart
                      ? `${formatTime(recordDetail.record.actualStart)} - ${recordDetail.record.actualEnd ? formatTime(recordDetail.record.actualEnd) : 'In Progress'}`
                      : 'No Clock-in'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Work</p>
                  <p className="font-medium text-green-600">
                    {formatDuration(recordDetail.record?.netWorkMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Break Time</p>
                  <p className="font-medium text-yellow-600">
                    {formatDuration(recordDetail.record?.breakMinutes)}
                  </p>
                </div>
                {recordDetail.record?.overtimeMinutes > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">Overtime</p>
                    <p className="font-medium text-purple-600">
                      {formatDuration(recordDetail.record.overtimeMinutes)}
                    </p>
                  </div>
                )}
              </div>

              {/* Adjustment Info */}
              {recordDetail.record?.wasAdjusted && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Badge variant="info" size="sm">Record was adjusted</Badge>
                  <p className="text-sm text-gray-500 mt-2">
                    Original: {formatDuration(recordDetail.record.originalMinutes)}
                  </p>
                  {recordDetail.record?.adjustmentNotes && (
                    <p className="text-sm text-gray-600 mt-1">
                      Notes: {recordDetail.record.adjustmentNotes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Work Sessions */}
            {recordDetail.workSessions && recordDetail.workSessions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Work Sessions</h4>
                <div className="space-y-3">
                  {recordDetail.workSessions.map((session, index) => (
                    <div
                      key={session.id || index}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Session {index + 1}</span>
                        <Badge variant={session.status === 'COMPLETED' ? 'success' : 'warning'} size="sm">
                          {session.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>
                          {formatTime(session.startTime)}
                          {session.endTime && ` - ${formatTime(session.endTime)}`}
                        </p>
                        {session.totalBreakMinutes > 0 && (
                          <p className="text-yellow-600">Break: {session.totalBreakMinutes} min</p>
                        )}
                      </div>

                      {/* Session Breaks */}
                      {session.breaks && session.breaks.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">Breaks:</p>
                          {session.breaks.map((brk, brkIndex) => (
                            <p key={brk.id || brkIndex} className="text-xs text-gray-600">
                              {formatTime(brk.startTime)}
                              {brk.endTime && ` - ${formatTime(brk.endTime)}`}
                              {brk.durationMinutes && ` (${brk.durationMinutes} min)`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Info */}
            {recordDetail.record?.status === 'APPROVED' && recordDetail.record?.approvedAt && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Approved on {formatDate(recordDetail.record.approvedAt)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Failed to load details</p>
        )}
      </Modal>
    </div>
  );
};

export default TimeRecords;
