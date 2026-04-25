import { useState, useEffect, useCallback, useRef } from 'react';
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
  Paperclip,
  Eye,
} from 'lucide-react';
import { Card, CardContent, Badge, Button, Modal } from '../../components/common';
import leaveService from '../../services/leave.service';
import { formatDate } from '../../utils/formatDateTime';

const Leave = () => {
  const [leaveOptions, setLeaveOptions] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [leaveType, setLeaveType] = useState('');
  const [formError, setFormError] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [leaveDays, setLeaveDays] = useState([{ date: today, hours: 8, mins: 0 }]);
  const [leaveNotes, setLeaveNotes] = useState('');
  const [leaveDocuments, setLeaveDocuments] = useState([]);
  const documentInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Auto-clear toast message after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Filter state for history
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
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
        console.log('Leave options:', optionsRes.data);
        setLeaveOptions(optionsRes.data);
        if (optionsRes.data?.options?.length > 0 && !leaveType) {
          setLeaveType(optionsRes.data.options[0].type);
        }
      } else {
        console.log('Leave options error:', optionsRes);
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

  // Total minutes across all days
  const totalMinutes = leaveDays.reduce((sum, d) => sum + Number(d.hours) * 60 + Number(d.mins), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  // Submit leave request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await leaveService.submitLeaveRequest({
        leaveType,
        days: leaveDays,
        notes: leaveNotes,
        documents: leaveDocuments.length > 0 ? leaveDocuments : undefined,
      });

      if (result?.success) {
        setShowRequestModal(false);
        setLeaveType(leaveOptions?.options?.[0]?.type || '');
        setLeaveDays([{ date: new Date().toISOString().split('T')[0], hours: 8, mins: 0 }]);
        setLeaveNotes('');
        setLeaveDocuments([]);
        setFormError('');
        fetchData();
        
        // Show warning if any
        if (result.data?.balanceWarning || result.data?.shortNoticeWarning) {
          setError(result.data?.balanceWarning || result.data?.shortNoticeWarning);
        }
      } else {
        setFormError(result?.error || 'Failed to submit leave request');
      }
    } catch (err) {
      setFormError(err.error || err.message || 'Failed to submit leave request');
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
  const handleCancelRequest = async () => {
    if (!selectedRequest) return;
    
    setSubmitting(true);
    try {
      const result = await leaveService.cancelLeaveRequest(selectedRequest.id);
      if (result?.success) {
        setToastMessage({
          title: 'Leave Request Cancelled',
          description: 'Your leave request has been cancelled successfully.',
        });
        setShowCancelModal(false);
        setShowDetailModal(false);
        setSelectedRequest(null);
        fetchData();
      } else {
        setFormError(result?.error || result?.message || 'Failed to cancel request');
      }
    } catch (err) {
      console.error('Cancel error:', err);
      setFormError(err?.error || err?.message || 'Failed to cancel request');
    } finally {
      setSubmitting(false);
    }
  };

  const openCancelModal = (request) => {
    setSelectedRequest(request);
    setFormError('');
    setShowCancelModal(true);
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { variant: 'warning', label: 'Pending' },
      APPROVED_BY_CLIENT: { variant: 'info', label: 'Client Approved' },
      APPROVED: { variant: 'success', label: 'Approved' },
      REJECTED: { variant: 'danger', label: 'Rejected' },
      CANCELLED: { variant: 'default', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get action taken info
  const getActionTaken = (request) => {
    const { status, clientApprovedAt, adminApprovedAt, rejectedAt } = request;
    
    if (status === 'PENDING') {
      return <span className="text-xs text-yellow-600">Pending</span>;
    }
    
    if (status === 'CANCELLED') {
      return <span className="text-xs text-gray-500">Cancelled by employee</span>;
    }
    
    let action = '';
    let actionBy = '';
    let actionAt = null;
    let actionTime = '';
    
    if (status === 'REJECTED') {
      action = 'Rejected';
      actionBy = 'Client';
      actionAt = rejectedAt;
    } else if (status === 'APPROVED_BY_CLIENT') {
      action = 'Approved';
      actionBy = 'Client';
      actionAt = clientApprovedAt;
    } else if (status === 'APPROVED') {
      action = 'Approved';
      actionBy = 'Admin';
      actionAt = adminApprovedAt;
    }
    
    if (actionAt) {
      const date = new Date(actionAt);
      const today = new Date();
      const diffMs = today.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffHours < 24) {
        actionTime = diffHours === 0 ? 'Just now' : `${diffHours}h ago`;
      } else if (diffDays < 7) {
        actionTime = `${diffDays}d ago`;
      } else {
        actionTime = formatDate(actionAt, { includeYear: true });
      }
    }
    
    return (
      <div className="text-xs space-y-0.5">
        <div className={`font-medium ${status === 'REJECTED' ? 'text-red-600' : 'text-green-600'}`}>
          {action} by {actionBy}
        </div>
        {actionTime && <div className="text-gray-500">{actionTime}</div>}
      </div>
    );
  };

  // Get leave type label
  const getLeaveTypeLabel = (type) => {
    if (!type) return 'Leave';
    const t = type.toUpperCase();
    const labels = { PTO: 'PTO', VTO: 'VTO', PAID: 'PTO', UNPAID: 'VTO' };
    return labels[t] || type;
  };


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
          onClick={() => { setShowRequestModal(true); setFormError(''); }}
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
                  {leaveBalance.paidLeave.rejected > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Rejected:</span>
                      <span>{leaveBalance.paidLeave.rejected}</span>
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
                {leaveBalance.policy?.requiresTwoWeeksNoticePaidLeave && (
                  <p>2 weeks notice required for paid leave</p>
                )}
                {leaveBalance.policy?.requiresTwoWeeksNoticeUnpaidLeave && (
                  <p>2 weeks notice required for unpaid leave</p>
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
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                    className="w-28 h-9 px-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Start date"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                    className="w-28 h-9 px-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="End date"
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
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {(historyStartDate || historyEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); setHistoryPage(1); }}
                    className="text-xs text-gray-500 hover:text-primary"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            </div>

            {/* History Table */}
            {(() => {
              let filtered = leaveHistory;
              
              if (historySearch.trim()) {
                const q = historySearch.toLowerCase();
                filtered = filtered.filter((r) => {
                  return (r.reason || '').toLowerCase().includes(q)
                    || (r.leaveType || '').toLowerCase().includes(q);
                });
              }
              
              if (historyStartDate || historyEndDate) {
                filtered = filtered.filter((r) => {
                  const reqStart = new Date(r.startDate);
                  if (historyStartDate && reqStart < new Date(historyStartDate)) return false;
                  if (historyEndDate && reqStart > new Date(historyEndDate)) return false;
                  return true;
                });
              }
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action Taken</th>
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
                          <span className={`text-sm font-medium ${(request.leaveType === 'PAID' || request.leaveType === 'PTO') ? 'text-green-700' : 'text-gray-900'}`}>
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
                        <td className="px-4 py-3">
                          {getActionTaken(request)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleViewDetails(request); }}
                              className="text-gray-400 hover:text-primary"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(request.status === 'PENDING' || request.status === 'APPROVED_BY_CLIENT') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openCancelModal(request); }}
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                                title="Cancel request"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
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
      </Card>

      {/* Request Leave Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => { setShowRequestModal(false); setFormError(''); }}
        title="New Leave Request"
      >
        <form onSubmit={handleSubmitRequest}>
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {formError}
            </div>
          )}
          {/* CODE dropdown */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Leave Type</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                  required
                >
                  {(!leaveOptions?.options || leaveOptions.options.length === 0) ? (
                    <>
                      <option value="PTO">PTO - Paid Time Off</option>
                      <option value="VTO">VTO - Voluntary Time Off</option>
                    </>
                  ) : (
                    leaveOptions.options.map(opt => (
                      <option key={opt.type} value={opt.type}>{opt.label}</option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 text-gray-400 text-xs cursor-default" title={leaveType === 'PTO' ? 'Paid Time Off' : 'Voluntary Time Off'}>
                <Info className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Per-day rows */}
          <div className="space-y-3 mb-3">
            {leaveDays.map((day, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) => {
                      const updated = [...leaveDays];
                      updated[idx] = { ...updated[idx], date: e.target.value };
                      setLeaveDays(updated);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hours</label>
                  <div className="relative">
                    <select
                      value={day.hours}
                      onChange={(e) => {
                        const updated = [...leaveDays];
                        updated[idx] = { ...updated[idx], hours: Number(e.target.value) };
                        setLeaveDays(updated);
                      }}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-6"
                    >
                      {Array.from({ length: 13 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="w-20">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mins</label>
                  <div className="relative">
                    <select
                      value={day.mins}
                      onChange={(e) => {
                        const updated = [...leaveDays];
                        updated[idx] = { ...updated[idx], mins: Number(e.target.value) };
                        setLeaveDays(updated);
                      }}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-6"
                    >
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaveDays(leaveDays.filter((_, i) => i !== idx))}
                  disabled={leaveDays.length === 1}
                  className="mb-0.5 flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add day */}
          <button
            type="button"
            onClick={() => setLeaveDays([...leaveDays, { date: new Date().toISOString().split('T')[0], hours: 8, mins: 0 }])}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-700 mb-5"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs">
              <Plus className="w-3 h-3" />
            </span>
            Add day
          </button>

          {/* Notes */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea
              value={leaveNotes}
              onChange={(e) => setLeaveNotes(e.target.value)}
              maxLength={1000}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              placeholder=""
            />
            <p className="text-right text-xs text-gray-400 mt-1">{leaveNotes.length} / 1000 characters</p>
          </div>

          {/* Documents */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Documents (optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setLeaveDocuments(prev => [...prev, ...files]);
                }}
                className="hidden"
                id="leave-documents"
              />
              <label htmlFor="leave-documents" className="flex flex-col items-center cursor-pointer">
                <Paperclip className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to upload documents</span>
                <span className="text-xs text-gray-400">PDF, DOC, JPG (max 10MB)</span>
              </label>
            </div>
            {leaveDocuments.length > 0 && (
              <div className="mt-2 space-y-2">
                {leaveDocuments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-600 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setLeaveDocuments(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer: total + actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-2xl font-bold text-gray-900">
                {totalHours}<span className="text-base font-semibold">h</span>{' '}
                {String(totalMins).padStart(2, '0')}<span className="text-base font-semibold">m</span>
              </span>
              <p className="text-xs text-gray-400">This request</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={!leaveType || leaveDays.some(d => !d.date) || totalMinutes === 0}
              >
                Save
              </Button>
            </div>
          </div>
        </form>
      </Modal>

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
            {(selectedRequest.status === 'REJECTED' || selectedRequest.status === 'CANCELLED') && selectedRequest.rejectionReason && (
              <div className={`border rounded-lg p-4 ${selectedRequest.status === 'CANCELLED' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-sm font-medium ${selectedRequest.status === 'CANCELLED' ? 'text-gray-800' : 'text-red-800'}`}>
                  {selectedRequest.status === 'CANCELLED' ? 'Cancellation Reason:' : 'Rejection Reason:'}
                </p>
                <p className={`text-sm ${selectedRequest.status === 'CANCELLED' ? 'text-gray-600' : 'text-red-700'} mt-1`}>{selectedRequest.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Leave Request"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {formError}
            </div>
          )}
          <p className="text-gray-600">
            Are you sure you want to cancel this leave request?
          </p>
          {selectedRequest && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>Type:</strong> {getLeaveTypeLabel(selectedRequest.leaveType)}</p>
              <p><strong>Dates:</strong> {formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={submitting}>No, Keep It</Button>
            <Button variant="danger" onClick={handleCancelRequest} loading={submitting}>Yes, Cancel Request</Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-white border-l-4 border-green-500 rounded-lg shadow-lg p-4 min-w-80">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-gray-900">{toastMessage.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{toastMessage.description}</p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leave;
