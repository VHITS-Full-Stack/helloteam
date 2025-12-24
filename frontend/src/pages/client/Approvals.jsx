import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  ChevronDown
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
  Modal
} from '../../components/common';

const Approvals = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const approvalItems = {
    pending: [
      {
        id: 1,
        type: 'time-entry',
        employee: 'John Doe',
        description: 'Regular work hours',
        date: '2025-12-18',
        hours: 8,
        submitted: '2025-12-18 6:05 PM',
      },
      {
        id: 2,
        type: 'overtime',
        employee: 'Jane Smith',
        description: 'Project deadline work',
        date: '2025-12-17',
        hours: 3,
        submitted: '2025-12-17 9:30 PM',
      },
      {
        id: 3,
        type: 'leave',
        employee: 'Mike Johnson',
        description: 'Vacation leave',
        date: '2025-12-25 - 2025-12-26',
        days: 2,
        submitted: '2025-12-15 10:00 AM',
      },
      {
        id: 4,
        type: 'adjustment',
        employee: 'Sarah Williams',
        description: 'Clock-out correction by Hello Team',
        date: '2025-12-16',
        hours: 0.5,
        submitted: '2025-12-17 9:00 AM',
        adjustedBy: 'Admin',
      },
    ],
    approved: [
      {
        id: 5,
        type: 'time-entry',
        employee: 'David Brown',
        description: 'Regular work hours',
        date: '2025-12-16',
        hours: 8,
        submitted: '2025-12-16 6:00 PM',
        approvedOn: '2025-12-17 9:00 AM',
      },
      {
        id: 6,
        type: 'overtime',
        employee: 'Emily Davis',
        description: 'Client meeting preparation',
        date: '2025-12-15',
        hours: 2,
        submitted: '2025-12-15 8:00 PM',
        approvedOn: '2025-12-16 10:00 AM',
      },
    ],
    rejected: [
      {
        id: 7,
        type: 'overtime',
        employee: 'John Doe',
        description: 'Unscheduled overtime',
        date: '2025-12-14',
        hours: 4,
        submitted: '2025-12-14 10:00 PM',
        rejectedOn: '2025-12-15 9:00 AM',
        reason: 'Not pre-approved',
      },
    ],
  };

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
    { id: 'pending', label: 'Pending', count: approvalItems.pending.length },
    { id: 'approved', label: 'Approved', count: approvalItems.approved.length },
    { id: 'rejected', label: 'Rejected', count: approvalItems.rejected.length },
  ];

  const handleApprove = (item) => {
    setSelectedItem(item);
    setShowApprovalModal(true);
  };

  const handleReject = (item) => {
    setSelectedItem(item);
    // Show rejection modal
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approvals</h2>
          <p className="text-gray-500">Review and approve time entries, overtime, and leave requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
          {activeTab === 'pending' && approvalItems.pending.length > 0 && (
            <Button variant="primary" icon={CheckCircle}>
              Approve All ({approvalItems.pending.length})
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
              <p className="text-2xl font-bold text-gray-900">{approvalItems.pending.length}</p>
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
                {approvalItems.pending.filter(i => i.type === 'overtime').length}
              </p>
              <p className="text-sm text-gray-500">Overtime Requests</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{approvalItems.approved.length}</p>
              <p className="text-sm text-gray-500">Approved This Week</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{approvalItems.rejected.length}</p>
              <p className="text-sm text-gray-500">Rejected This Week</p>
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
      <Card padding="none">
        {approvalItems[activeTab].length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Hours/Days</TableHeader>
                <TableHeader>Submitted</TableHeader>
                {activeTab === 'pending' && <TableHeader>Actions</TableHeader>}
                {activeTab === 'approved' && <TableHeader>Approved On</TableHeader>}
                {activeTab === 'rejected' && <TableHeader>Reason</TableHeader>}
              </TableRow>
            </TableHead>
            <TableBody>
              {approvalItems[activeTab].map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={item.employee} size="sm" />
                      <span className="font-medium">{item.employee}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(item.type)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-gray-900">{item.description}</p>
                      {item.adjustedBy && (
                        <p className="text-xs text-gray-500">Adjusted by: {item.adjustedBy}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>
                    {item.hours !== undefined ? `${item.hours}h` : `${item.days} days`}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">{item.submitted}</span>
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
                  {activeTab === 'approved' && (
                    <TableCell>
                      <span className="text-sm text-green-600">{item.approvedOn}</span>
                    </TableCell>
                  )}
                  {activeTab === 'rejected' && (
                    <TableCell>
                      <span className="text-sm text-red-600">{item.reason}</span>
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
        title="Confirm Approval"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </Button>
            <Button variant="success" icon={CheckCircle} onClick={() => setShowApprovalModal(false)}>
              Approve
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to approve this {selectedItem.type.replace('-', ' ')}?
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">{selectedItem.employee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{selectedItem.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {selectedItem.hours !== undefined
                    ? `${selectedItem.hours} hours`
                    : `${selectedItem.days} days`}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Approvals;
