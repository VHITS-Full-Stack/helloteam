import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  Loader2,
  Calendar,
  ChevronDown,
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
import clientPortalService from '../../services/clientPortal.service';
import overtimeService from '../../services/overtime.service';

const Approvals = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [activeType, setActiveType] = useState('leave'); // 'leave' or 'overtime'
  const [approvals, setApprovals] = useState([]);
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [summary, setSummary] = useState({
    pending: 0,
    overtimePending: 0,
    approvedThisWeek: 0,
    rejectedThisWeek: 0,
  });
  const [overtimeSummary, setOvertimeSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalApprovedMinutes: 0,
    totalPendingMinutes: 0,
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const fetchingApprovalsRef = useRef(false);
  const fetchingOvertimeRef = useRef(false);

  const fetchApprovals = useCallback(async () => {
    if (fetchingApprovalsRef.current) return;
    fetchingApprovalsRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getApprovals({ status: activeTab, type: 'leave' });
      if (response.success) {
        // Only keep leave requests
        const leaveOnly = (response.data.approvals || []).filter(a => a.type === 'leave');
        setApprovals(leaveOnly);
        setSummary(response.data.summary || {
          pending: 0,
          overtimePending: 0,
          approvedThisWeek: 0,
          rejectedThisWeek: 0,
        });
      } else {
        setError(response.error || 'Failed to load approvals');
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
      setError('Failed to load approvals');
    } finally {
      setLoading(false);
      fetchingApprovalsRef.current = false;
    }
  }, [activeTab]);

  const fetchOvertimeRequests = useCallback(async () => {
    if (fetchingOvertimeRef.current) return;
    fetchingOvertimeRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const status = activeTab === 'pending' ? 'PENDING' : activeTab === 'approved' ? 'APPROVED' : 'REJECTED';
      const [requestsResponse, summaryResponse] = await Promise.all([
        overtimeService.getOvertimeRequests({
          status,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
        overtimeService.getOvertimeSummary({
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
      ]);

      if (requestsResponse.success) {
        setOvertimeRequests(requestsResponse.data.requests || []);
      }
      if (summaryResponse.success) {
        setOvertimeSummary(summaryResponse.data || {
          pending: 0,
          approved: 0,
          rejected: 0,
          totalApprovedMinutes: 0,
          totalPendingMinutes: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching overtime requests:', err);
      setError('Failed to load overtime requests');
    } finally {
      setLoading(false);
      fetchingOvertimeRef.current = false;
    }
  }, [activeTab, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (activeType === 'leave') {
      fetchApprovals();
    } else {
      fetchOvertimeRequests();
    }
    setSelectedItems([]);
  }, [activeType, activeTab, fetchApprovals, fetchOvertimeRequests]);

  const getTypeBadge = (type) => {
    switch (type) {
      case 'time-entry':
        return <Badge variant="info">Time Entry</Badge>;
      case 'overtime':
        return <Badge variant="warning">Overtime</Badge>;
      case 'leave':
        return <Badge variant="primary">Leave</Badge>;
      case 'adjustment':
        return <Badge variant="default">Adjustment</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const tabs = [
    {
      id: 'pending',
      label: 'Pending',
      count: activeType === 'leave' ? summary.pending : overtimeSummary.pending
    },
    {
      id: 'approved',
      label: 'Approved',
      count: activeType === 'leave' ? summary.approvedThisWeek : overtimeSummary.approved
    },
    {
      id: 'rejected',
      label: 'Rejected',
      count: activeType === 'leave' ? summary.rejectedThisWeek : overtimeSummary.rejected
    },
  ];

  const handleApprove = async (item) => {
    setSelectedItem(item);
    setShowApprovalModal(true);
  };

  const handleReject = (item) => {
    setSelectedItem(item);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      let response;
      if (activeType === 'overtime') {
        response = await overtimeService.approveOvertimeRequest(selectedItem.id);
      } else if (selectedItem.type === 'leave') {
        response = await clientPortalService.approveLeaveRequest(selectedItem.id);
      } else {
        response = await clientPortalService.approveTimeRecord(selectedItem.id);
      }

      if (response.success) {
        setShowApprovalModal(false);
        setSelectedItem(null);
        if (activeType === 'leave') {
          fetchApprovals();
        } else {
          fetchOvertimeRequests();
        }
      } else {
        alert(response.error || 'Failed to approve');
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmReject = async () => {
    if (!selectedItem || !rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      let response;
      if (activeType === 'overtime') {
        response = await overtimeService.rejectOvertimeRequest(selectedItem.id, rejectReason);
      } else {
        response = await clientPortalService.rejectLeaveRequest(selectedItem.id, rejectReason);
      }

      if (response.success) {
        setShowRejectModal(false);
        setSelectedItem(null);
        setRejectReason('');
        if (activeType === 'leave') {
          fetchApprovals();
        } else {
          fetchOvertimeRequests();
        }
      } else {
        alert(response.error || 'Failed to reject');
      }
    } catch (err) {
      console.error('Reject error:', err);
      alert('Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const items = activeType === 'leave'
      ? approvals
      : overtimeRequests;

    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(a => a.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) return;
    setActionLoading(true);
    try {
      if (activeType === 'leave') {
        // Bulk approve leave requests one by one
        for (const id of selectedItems) {
          await clientPortalService.approveLeaveRequest(id);
        }
        setSelectedItems([]);
        fetchApprovals();
      } else {
        // Bulk approve overtime requests one by one
        for (const id of selectedItems) {
          await overtimeService.approveOvertimeRequest(id);
        }
        setSelectedItems([]);
        fetchOvertimeRequests();
      }
    } catch (err) {
      console.error('Bulk approve error:', err);
      alert('Failed to bulk approve');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Handle date range strings like "2026-02-03 to 2026-02-05"
    if (typeof dateStr === 'string' && dateStr.includes(' to ')) {
      const [startStr, endStr] = dateStr.split(' to ');
      const formatSingleDate = (str) => {
        const [year, month, day] = str.trim().split('-').map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };
      const startFormatted = formatSingleDate(startStr);
      const endFormatted = formatSingleDate(endStr);
      // If same date, just show once
      if (startStr.trim() === endStr.trim()) {
        return startFormatted;
      }
      return `${startFormatted} - ${endFormatted}`;
    }
    const date = new Date(dateStr);
    // Check for Invalid Date
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatMinutesToHours = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Convert "HH:MM" (24h) to "h:MM AM/PM" (12h)
  const formatTime12 = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const selectableItems = activeType === 'leave'
    ? approvals
    : overtimeRequests;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approvals</h2>
          <p className="text-gray-500">Review leave requests and overtime pre-approvals</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'pending' && selectedItems.length > 0 && (
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={handleBulkApprove}
              disabled={actionLoading}
            >
              {actionLoading ? 'Approving...' : `Approve Selected (${selectedItems.length})`}
            </Button>
          )}
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

      {/* Filters */}
      {showFilters && (
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-4">
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
            <div className="flex items-end gap-2">
              <Button
                variant="primary"
                onClick={() => activeType === 'leave' ? fetchApprovals() : fetchOvertimeRequests()}
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDateRange({ startDate: '', endDate: '' })}
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => activeType === 'leave' ? fetchApprovals() : fetchOvertimeRequests()}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Type Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => { setActiveType('leave'); setSelectedItems([]); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeType === 'leave'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Leave Requests
        </button>
        <button
          onClick={() => { setActiveType('overtime'); setSelectedItems([]); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeType === 'overtime'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Overtime Requests
          {overtimeSummary.pending > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-warning text-warning-dark text-xs rounded-full">
              {overtimeSummary.pending}
            </span>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === 'leave' ? summary.pending : overtimeSummary.pending}
              </p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === 'leave'
                  ? summary.overtimePending
                  : formatMinutesToHours(overtimeSummary.totalPendingMinutes)
                }
              </p>
              <p className="text-sm text-gray-500">
                {activeType === 'leave' ? 'Overtime Requests' : 'Pending Hours'}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === 'leave'
                  ? summary.approvedThisWeek
                  : overtimeSummary.approved
                }
              </p>
              <p className="text-sm text-gray-500">
                {activeType === 'leave' ? 'Approved This Week' : 'Approved'}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === 'leave'
                  ? summary.rejectedThisWeek
                  : overtimeSummary.rejected
                }
              </p>
              <p className="text-sm text-gray-500">
                {activeType === 'leave' ? 'Rejected This Week' : 'Rejected'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              <span className={`
                ml-2 py-0.5 px-2 rounded-full text-xs
                ${activeTab === tab.id
                  ? 'bg-primary-100 text-primary'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Approval Items */}
      {loading ? (
        <Card padding="none">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </Card>
      ) : activeType === 'leave' ? (
        /* Leave Requests */
        <Card padding="none">
          {approvals.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Days</TableHeader>
                  <TableHeader>Submitted</TableHeader>
                  {activeTab === 'pending' && <TableHeader>Actions</TableHeader>}
                  {activeTab === 'approved' && <TableHeader>Approved On</TableHeader>}
                  {activeTab === 'rejected' && <TableHeader>Rejection Reason</TableHeader>}
                </TableRow>
              </TableHead>
              <TableBody>
                {approvals.map((item) => (
                  <TableRow key={`leave-${item.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={item.employee} src={item.profilePhoto} size="sm" />
                        <span className="font-medium">{item.employee}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(item.type)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-gray-900">{item.description}</p>
                        {item.reason && (
                          <p className="text-xs text-gray-500 mt-1">Reason: {item.reason}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell>{item.days} day{item.days !== 1 ? 's' : ''}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{formatDateTime(item.submittedAt)}</span>
                    </TableCell>
                    {activeTab === 'pending' && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="success" size="sm" icon={CheckCircle} onClick={() => handleApprove(item)} disabled={actionLoading}>
                            Approve
                          </Button>
                          <Button variant="ghost" size="sm" icon={XCircle} onClick={() => handleReject(item)} disabled={actionLoading}>
                            Deny
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    {activeTab === 'approved' && (
                      <TableCell>
                        <span className="text-sm text-green-600">{formatDateTime(item.approvedAt)}</span>
                      </TableCell>
                    )}
                    {activeTab === 'rejected' && (
                      <TableCell>
                        <span className="text-sm text-red-600">{item.rejectionReason || '-'}</span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No leave requests</h3>
              <p className="text-gray-500">
                {activeTab === 'pending'
                  ? 'All caught up! No pending leave requests.'
                  : `No ${activeTab} leave requests to show.`}
              </p>
            </div>
          )}
        </Card>
      ) : (
        /* Overtime Requests tab */
        <Card padding="none">
          {overtimeRequests.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  {activeTab === 'pending' && (
                    <TableHeader className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === selectableItems.length && selectableItems.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHeader>
                  )}
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Reason</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Hours</TableHeader>
                  <TableHeader>Submitted</TableHeader>
                  {activeTab === 'pending' && <TableHeader>Actions</TableHeader>}
                  {activeTab === 'approved' && <TableHeader>Approved On</TableHeader>}
                  {activeTab === 'rejected' && <TableHeader>Rejection Reason</TableHeader>}
                </TableRow>
              </TableHead>
              <TableBody>
                {overtimeRequests.map((request) => (
                  <TableRow key={request.id}>
                    {activeTab === 'pending' && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(request.id)}
                          onChange={() => handleSelectItem(request.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : 'Unknown'}
                          src={request.employee?.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium">
                          {request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant={request.type === 'OFF_SHIFT' ? 'info' : 'secondary'} size="xs">
                          {request.type === 'OFF_SHIFT' ? 'Off-Shift' : 'Extension'}
                        </Badge>
                        {request.type === 'OFF_SHIFT' && request.requestedStartTime && request.requestedEndTime && (
                          <p className="text-xs text-gray-500 mt-1">{formatTime12(request.requestedStartTime)} – {formatTime12(request.requestedEndTime)}</p>
                        )}
                        {request.type !== 'OFF_SHIFT' && request.estimatedEndTime && (
                          <p className="text-xs text-gray-500 mt-1">Until {formatTime12(request.estimatedEndTime)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-gray-900">{request.reason}</p>
                    </TableCell>
                    <TableCell>{formatDate(request.date)}</TableCell>
                    <TableCell>
                      <Badge variant="warning">
                        {formatMinutesToHours(request.requestedMinutes)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{formatDateTime(request.createdAt)}</span>
                    </TableCell>
                    {activeTab === 'pending' && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="success" size="sm" icon={CheckCircle} onClick={() => handleApprove(request)} disabled={actionLoading}>
                            Approve
                          </Button>
                          <Button variant="ghost" size="sm" icon={XCircle} onClick={() => handleReject(request)} disabled={actionLoading}>
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    {activeTab === 'approved' && (
                      <TableCell>
                        <div>
                          <span className="text-sm text-green-600">{formatDateTime(request.approvedAt)}</span>
                          {request.approver && (
                            <p className="text-xs text-gray-500">by {request.approver.name}</p>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {activeTab === 'rejected' && (
                      <TableCell>
                        <div>
                          <span className="text-sm text-red-600">{request.rejectionReason || '-'}</span>
                          {request.rejecter && (
                            <p className="text-xs text-gray-500">by {request.rejecter.name}</p>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No items</h3>
              <p className="text-gray-500">
                {activeTab === 'pending'
                  ? 'All caught up! No pending overtime requests.'
                  : `No ${activeTab} overtime requests to show.`}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Confirm Approval"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowApprovalModal(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="success" icon={CheckCircle} onClick={confirmApprove} disabled={actionLoading}>
              {actionLoading ? 'Approving...' : 'Approve'}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to approve this {activeType === 'overtime' ? 'overtime request' : 'leave request'}?
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">
                  {activeType === 'overtime'
                    ? `${selectedItem.employee?.firstName} ${selectedItem.employee?.lastName}`
                    : selectedItem.employee
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{formatDate(selectedItem.date)}</span>
              </div>
              {activeType === 'overtime' && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">
                    {selectedItem.type === 'OFF_SHIFT' ? 'Off-Shift Hours' : 'Shift Extension'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {activeType === 'overtime'
                    ? formatMinutesToHours(selectedItem.requestedMinutes)
                    : selectedItem.hours !== undefined
                      ? `${selectedItem.hours} hours`
                      : `${selectedItem.days} days`
                  }
                </span>
              </div>
              {activeType === 'overtime' && selectedItem.type === 'OFF_SHIFT' && selectedItem.requestedStartTime && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium">{formatTime12(selectedItem.requestedStartTime)} – {formatTime12(selectedItem.requestedEndTime)}</span>
                </div>
              )}
              {activeType === 'overtime' && selectedItem.reason && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Reason</span>
                  <span className="font-medium text-right max-w-xs">{selectedItem.reason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={activeType === 'overtime' ? 'Deny Overtime' : 'Deny Leave Request'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="danger" icon={XCircle} onClick={confirmReject} disabled={actionLoading || !rejectReason.trim()}>
              {actionLoading ? 'Submitting...' : 'Deny'}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <p className="text-gray-600">
              {activeType === 'overtime'
                ? 'Please provide a reason for denying this overtime request.'
                : 'Please provide a reason for denying this leave request. The employee will be notified.'}
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">
                  {activeType === 'overtime'
                    ? `${selectedItem.employee?.firstName} ${selectedItem.employee?.lastName}`
                    : selectedItem.employee
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{formatDate(selectedItem.date)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Denial Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for denial..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Approvals;
