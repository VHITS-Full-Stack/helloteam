import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  AlertCircle,
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  AlertTriangle,
  Loader2,
  Info,
  Building2,
} from 'lucide-react';
import { Card, CardContent, Badge, Button, Modal } from '../../components/common';
import leaveService from '../../services/leave.service';
import { formatDate } from '../../utils/formatDateTime';

const Leave = () => {
  const [activeTab, setActiveTab] = useState('request');
  const [leaveOptions, setLeaveOptions] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [shortNoticeWarning, setShortNoticeWarning] = useState(false);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filter state for history
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [optionsRes, balanceRes, historyRes] = await Promise.all([
        leaveService.getLeaveOptions(),
        leaveService.getLeaveBalance(),
        leaveService.getLeaveHistory({ status: historyFilter === 'all' ? null : historyFilter }),
      ]);

      if (optionsRes?.success) {
        setLeaveOptions(optionsRes.data);
        // Set default leave type if available
        if (optionsRes.data?.options?.length > 0 && !requestForm.leaveType) {
          setRequestForm(prev => ({
            ...prev,
            leaveType: optionsRes.data.options[0].type,
          }));
        }
      }

      if (balanceRes?.success) {
        setLeaveBalance(balanceRes.data);
      }

      if (historyRes?.success) {
        setLeaveHistory(historyRes.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch leave data:', err);
      setError('Failed to load leave data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check for short notice (< 2 weeks)
  useEffect(() => {
    if (requestForm.startDate) {
      const startDate = new Date(requestForm.startDate);
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      setShortNoticeWarning(startDate < twoWeeksFromNow);
    } else {
      setShortNoticeWarning(false);
    }
  }, [requestForm.startDate]);

  // Calculate requested days
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
  };

  const requestedDays = calculateDays(requestForm.startDate, requestForm.endDate);

  // Submit leave request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await leaveService.submitLeaveRequest({
        leaveType: requestForm.leaveType,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        reason: requestForm.reason,
      });

      if (result?.success) {
        setShowRequestModal(false);
        setRequestForm({
          leaveType: leaveOptions?.options?.[0]?.type || '',
          startDate: '',
          endDate: '',
          reason: '',
        });
        fetchData();
      } else {
        setError(result?.error || 'Failed to submit leave request');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  // View request details
  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
    setDetailLoading(true);

    try {
      const result = await leaveService.getLeaveRequestDetails(request.id);
      if (result?.success) {
        setSelectedRequest(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch request details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Cancel request
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      const result = await leaveService.cancelLeaveRequest(requestId);
      if (result?.success) {
        setShowDetailModal(false);
        setSelectedRequest(null);
        fetchData();
      } else {
        setError(result?.error || 'Failed to cancel request');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to cancel request');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { variant: 'warning', label: 'Pending' },
      APPROVED_BY_CLIENT: { variant: 'info', label: 'Client Approved' },
      APPROVED: { variant: 'success', label: 'Approved' },
      REJECTED: { variant: 'danger', label: 'Rejected' },
    };
    const config = statusConfig[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get leave type label
  const getLeaveTypeLabel = (type) => {
    return type === 'PAID' ? 'Paid Leave' : 'Unpaid Leave';
  };

  const tabs = [
    { id: 'request', label: 'Request Leave' },
    { id: 'history', label: 'History' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave & Availability</h1>
          {leaveOptions && (
            <p className="text-sm text-gray-500 mt-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              {leaveOptions.clientName}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowRequestModal(true)}
        >
          New Request
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Balance Cards */}
      {leaveBalance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Paid Leave Balance */}
          {leaveBalance.policy?.allowPaidLeave && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Paid Leave Balance</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {leaveBalance.paidLeave.available}
                      <span className="text-lg font-normal text-gray-400"> days</span>
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Entitled:</span>
                    <span>{leaveBalance.paidLeave.entitled} days</span>
                  </div>
                  {leaveBalance.paidLeave.carryover > 0 && (
                    <div className="flex justify-between">
                      <span>Carryover:</span>
                      <span>{leaveBalance.paidLeave.carryover} days</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Used:</span>
                    <span>{leaveBalance.paidLeave.used} days</span>
                  </div>
                  {leaveBalance.paidLeave.pending > 0 && (
                    <div className="flex justify-between text-yellow-600">
                      <span>Pending:</span>
                      <span>{leaveBalance.paidLeave.pending} days</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unpaid Leave Stats */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unpaid Leave Taken</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {leaveBalance.unpaidLeave.taken}
                    <span className="text-lg font-normal text-gray-400"> days</span>
                  </p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
              </div>
              {leaveBalance.unpaidLeave.pending > 0 && (
                <div className="mt-3 text-xs text-yellow-600">
                  <span>{leaveBalance.unpaidLeave.pending} days pending approval</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Policy Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Leave Policy</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {leaveBalance.policy?.allowPaidLeave
                      ? `${leaveBalance.paidLeave.entitlementType} entitlement`
                      : 'Unpaid leave only'}
                  </p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                {leaveBalance.policy?.requiresTwoWeeksNotice && (
                  <p>2 weeks notice recommended</p>
                )}
                {leaveBalance.policy?.allowPaidLeave && (
                  <p>Paid leave available</p>
                )}
                {leaveBalance.policy?.allowUnpaidLeave && (
                  <p>Unpaid leave available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center gap-1 px-4 pt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-100 text-gray-900 border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Request Tab Content */}
        {activeTab === 'request' && (
          <CardContent className="p-6">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Submit Leave Request</h3>

              {!leaveOptions?.options?.length ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No leave options available for your client.</p>
                  <p className="text-sm text-gray-400 mt-1">Please contact your administrator.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  {/* Leave Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Leave Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {leaveOptions.options.map((option) => (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => setRequestForm(prev => ({ ...prev, leaveType: option.type }))}
                          className={`p-4 rounded-lg border-2 text-left transition-colors ${
                            requestForm.leaveType === option.type
                              ? 'border-primary bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-medium text-gray-900">{option.label}</p>
                          <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={requestForm.startDate}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, startDate: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={requestForm.endDate}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, endDate: e.target.value }))}
                        min={requestForm.startDate || new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  {/* Days Summary */}
                  {requestedDays > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Days Requested:</span>
                        <span className="text-lg font-bold text-gray-900">{requestedDays} day{requestedDays !== 1 ? 's' : ''}</span>
                      </div>
                      {requestForm.leaveType === 'PAID' && leaveBalance && (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-gray-600">Remaining after request:</span>
                          <span className={`font-medium ${
                            leaveBalance.paidLeave.available - requestedDays < 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}>
                            {Math.max(0, leaveBalance.paidLeave.available - requestedDays)} days
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Short Notice Warning */}
                  {shortNoticeWarning && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">Short Notice Request</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          This request is within 2 weeks. While allowed, please note that approval may be affected.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason (Optional)
                    </label>
                    <textarea
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Provide a reason for your leave request..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={submitting}
                      disabled={!requestForm.leaveType || !requestForm.startDate || !requestForm.endDate}
                    >
                      Submit Request
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </CardContent>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <CardContent className="p-6">
            {/* Filter */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="text-lg font-medium text-gray-900">Request History</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search reason..."
                    value={historySearch}
                    onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                    className="w-40 h-9 pl-8 pr-3 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="relative">
                  <select
                    value={historyFilter}
                    onChange={(e) => { setHistoryFilter(e.target.value); setHistoryPage(1); }}
                    className="appearance-none pr-9 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED_BY_CLIENT">Client Approved</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* History Table */}
            {(() => {
              const filtered = historySearch.trim()
                ? leaveHistory.filter((r) => {
                    const q = historySearch.toLowerCase();
                    return (r.reason || '').toLowerCase().includes(q)
                      || (r.leaveType || '').toLowerCase().includes(q);
                  })
                : leaveHistory;
              const totalPages = Math.ceil(filtered.length / historyPageSize);
              const startIdx = (historyPage - 1) * historyPageSize;
              const paginated = filtered.slice(startIdx, startIdx + historyPageSize);

              return filtered.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No leave requests found.</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Start Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">End Date</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map((request) => (
                      <tr
                        key={request.id}
                        onClick={() => handleViewDetails(request)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${request.leaveType === 'PAID' ? 'text-green-700' : 'text-gray-900'}`}>
                            {getLeaveTypeLabel(request.leaveType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(request.startDate, {
                            includeWeekday: true,
                            includeYear: true,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(request.endDate, {
                            includeWeekday: true,
                            includeYear: true,
                          })}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                          {request.requestedDays}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600 max-w-[200px] truncate" title={request.reason}>
                            {request.reason || '—'}
                          </p>
                          {request.isShortNotice && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-yellow-600 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Short notice
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChevronRight className="w-4 h-4 text-gray-400 inline-block" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 -mx-6">
                  <p className="text-xs text-gray-500 pl-4">
                    Showing {startIdx + 1}–{Math.min(startIdx + historyPageSize, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1 pr-4">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setHistoryPage(page)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          historyPage === page
                            ? 'bg-primary text-white'
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                      disabled={historyPage === totalPages}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
            );
            })()}
          </CardContent>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRequest(null);
        }}
        title="Leave Request Details"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
              </div>
              {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'APPROVED_BY_CLIENT') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelRequest(selectedRequest.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Cancel Request
                </Button>
              )}
            </div>

            {/* Request Details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Leave Type:</span>
                <span className="font-medium">{getLeaveTypeLabel(selectedRequest.leaveType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Start Date:</span>
                <span className="font-medium">
                  {formatDate(selectedRequest.startDate, {
                    includeWeekday: true,
                    includeYear: true,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">End Date:</span>
                <span className="font-medium">
                  {formatDate(selectedRequest.endDate, {
                    includeWeekday: true,
                    includeYear: true,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Days:</span>
                <span className="font-medium">{selectedRequest.requestedDays} days</span>
              </div>
              {selectedRequest.reason && (
                <div>
                  <span className="text-sm text-gray-500">Reason:</span>
                  <p className="mt-1 text-gray-900">{selectedRequest.reason}</p>
                </div>
              )}
            </div>

            {/* Short Notice Warning */}
            {selectedRequest.isShortNotice && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-yellow-700">This is a short notice request (&lt; 2 weeks)</span>
              </div>
            )}

            {/* Approval Flow */}
            {selectedRequest.approvalFlow && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Approval Flow</p>
                <div className="relative">
                  {selectedRequest.approvalFlow.map((step, index) => (
                    <div key={step.step} className="flex items-start gap-3 pb-4">
                      {/* Step Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        step.status === 'completed'
                          ? 'bg-green-100'
                          : step.status === 'rejected'
                            ? 'bg-red-100'
                            : step.status === 'pending'
                              ? 'bg-yellow-100'
                              : 'bg-gray-100'
                      }`}>
                        {step.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {step.status === 'rejected' && (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        {step.status === 'pending' && (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        )}
                        {step.status === 'skipped' && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{step.label}</p>
                        {step.date && (
                          <p className="text-sm text-gray-500">
                            {new Date(step.date).toLocaleString()}
                          </p>
                        )}
                        {step.actor && (
                          <p className="text-sm text-gray-500">By: {step.actor}</p>
                        )}
                      </div>

                      {/* Connector Line */}
                      {index < selectedRequest.approvalFlow.length - 1 && (
                        <div className="absolute left-4 w-0.5 h-4 bg-gray-200" style={{ top: `${(index + 1) * 56}px` }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejection Reason */}
            {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                <p className="text-sm text-red-700 mt-1">{selectedRequest.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Leave;
