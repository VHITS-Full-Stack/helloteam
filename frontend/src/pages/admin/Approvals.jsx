import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  Building2,
  Users,
  RefreshCw
} from 'lucide-react';
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

const Approvals = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalItems, setApprovalItems] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    clientApproved: 0,
    approvedToday: 0,
    rejectedToday: 0,
  });
  const [processing, setProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const params = {
        status: activeTab,
        page: 1,
        limit: 50,
      };
      if (selectedType !== 'all') {
        params.type = selectedType;
      }

      const response = await adminPortalService.getApprovals(params);
      if (response.data?.success) {
        setApprovalItems(response.data.data.approvals);
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeTab, selectedType]);

  const getTypeBadge = (type) => {
    switch (type) {
      case 'time-adjustment':
        return <Badge variant="primary">Adjustment</Badge>;
      case 'overtime':
        return <Badge variant="warning">Overtime</Badge>;
      case 'leave':
        return <Badge variant="info">Leave</Badge>;
      case 'timesheet':
        return <Badge variant="default">Timesheet</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const tabs = [
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'approved', label: 'Approved', count: stats.approvedToday },
    { id: 'rejected', label: 'Rejected', count: stats.rejectedToday },
  ];

  const handleApprove = (item) => {
    setSelectedItem(item);
    setShowApprovalModal(true);
  };

  const handleReject = (item) => {
    setSelectedItem(item);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const confirmApproval = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      let response;
      if (selectedItem.type === 'leave') {
        response = await adminPortalService.approveLeaveRequest(selectedItem.id);
      } else {
        response = await adminPortalService.approveTimeRecord(selectedItem.id);
      }
      if (response.data?.success) {
        setShowApprovalModal(false);
        fetchApprovals();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessing(false);
    }
  };

  const confirmRejection = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      let response;
      if (selectedItem.type === 'leave') {
        response = await adminPortalService.rejectLeaveRequest(selectedItem.id, rejectionReason);
      } else {
        response = await adminPortalService.rejectTimeRecord(selectedItem.id, rejectionReason);
      }
      if (response.data?.success) {
        setShowRejectModal(false);
        setRejectionReason('');
        fetchApprovals();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) return;
    setProcessing(true);
    try {
      // Filter out leave requests (they need individual approval)
      const timeRecordIds = selectedItems.filter(id => {
        const item = approvalItems.find(a => a.id === id);
        return item && item.type !== 'leave';
      });

      if (timeRecordIds.length > 0) {
        const response = await adminPortalService.bulkApproveTimeRecords(timeRecordIds);
        if (response.data?.success) {
          setSelectedItems([]);
          fetchApprovals();
        }
      }
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === approvalItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(approvalItems.map(item => item.id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approvals</h2>
          <p className="text-gray-500">Final approval for time entries, leave, and adjustments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={RefreshCw} onClick={fetchApprovals}>
            Refresh
          </Button>
          {activeTab === 'pending' && selectedItems.length > 0 && (
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={handleBulkApprove}
              disabled={processing}
            >
              Approve Selected ({selectedItems.length})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.clientApproved}</p>
              <p className="text-sm text-gray-500">Client Approved</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.approvedToday}</p>
              <p className="text-sm text-gray-500">Approved Today</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.rejectedToday}</p>
              <p className="text-sm text-gray-500">Rejected Today</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            className="input w-40"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="timesheet">Timesheet</option>
            <option value="overtime">Overtime</option>
            <option value="time-adjustment">Adjustments</option>
            <option value="leave">Leave</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedItems([]);
              }}
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
      <Card padding="none">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-gray-500 mt-2">Loading approvals...</p>
          </div>
        ) : approvalItems.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                {activeTab === 'pending' && (
                  <TableHeader>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedItems.length === approvalItems.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHeader>
                )}
                <TableHeader>Employee</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Client Status</TableHeader>
                {activeTab === 'pending' && <TableHeader>Actions</TableHeader>}
              </TableRow>
            </TableHead>
            <TableBody>
              {approvalItems.map((item) => (
                <TableRow key={item.id}>
                  {activeTab === 'pending' && (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={item.employee} size="sm" src={item.profilePhoto} />
                      <span className="font-medium">{item.employee}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600">{item.client}</span>
                  </TableCell>
                  <TableCell>{getTypeBadge(item.type)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-gray-900">{item.description}</p>
                      {item.details && (
                        <p className="text-xs text-gray-500">{item.details}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>
                    {item.clientApproved === true && (
                      <Badge variant="success">Approved</Badge>
                    )}
                    {item.clientApproved === false && (
                      <Badge variant="warning">Pending</Badge>
                    )}
                    {item.clientApproved === undefined && (
                      <Badge variant="default">N/A</Badge>
                    )}
                  </TableCell>
                  {activeTab === 'pending' && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => handleApprove(item)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={XCircle}
                          onClick={() => handleReject(item)}
                        >
                          Reject
                        </Button>
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
                ? 'All caught up! No pending approvals.'
                : `No ${activeTab} items to show.`}
            </p>
          </div>
        )}
      </Card>

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Confirm Final Approval"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={confirmApproval}
              disabled={processing}
            >
              {processing ? 'Approving...' : 'Approve'}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <p className="text-gray-600">
              This is the final approval. The item will be processed after your confirmation.
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">{selectedItem.employee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">{selectedItem.client}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium capitalize">{selectedItem.type?.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{selectedItem.date}</span>
              </div>
            </div>
            {selectedItem.clientApproved && (
              <div className="p-3 bg-green-50 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">
                  This item has been approved by the client.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Item"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={confirmRejection}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? 'Rejecting...' : 'Reject'}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-medium">{selectedItem.employee}</p>
              <p className="text-sm text-gray-500 mt-2">Description</p>
              <p className="font-medium">{selectedItem.description}</p>
            </div>
            <div>
              <label className="label">Rejection Reason *</label>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Please provide a reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                The employee will be notified of this rejection and the reason provided.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Approvals;
