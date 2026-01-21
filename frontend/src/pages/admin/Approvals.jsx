import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  Building2,
  Users
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

const Approvals = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const approvalItems = {
    pending: [
      {
        id: 1,
        type: 'time-adjustment',
        employee: 'John Doe',
        client: 'ABC Corporation',
        description: 'Clock-out time correction',
        date: '2025-12-18',
        details: 'Original: 5:00 PM, Adjusted: 6:05 PM',
        submitted: '2025-12-18 6:30 PM',
        submittedBy: 'System',
      },
      {
        id: 2,
        type: 'leave',
        employee: 'Jane Smith',
        client: 'ABC Corporation',
        description: 'Paid Leave Request',
        date: '2025-12-25 - 2025-12-26',
        details: '2 days - Christmas Holiday',
        submitted: '2025-12-15 10:00 AM',
        submittedBy: 'Employee',
        clientApproved: true,
      },
      {
        id: 3,
        type: 'overtime',
        employee: 'Mike Johnson',
        client: 'XYZ Industries',
        description: 'Overtime Request',
        date: '2025-12-17',
        details: '4 hours - Project deadline',
        submitted: '2025-12-17 9:00 PM',
        submittedBy: 'Employee',
        clientApproved: true,
      },
      {
        id: 4,
        type: 'timesheet',
        employee: 'Sarah Williams',
        client: 'Tech Solutions',
        description: 'Weekly Timesheet',
        date: 'Dec 9-15, 2025',
        details: '40 hours total',
        submitted: '2025-12-16 9:00 AM',
        submittedBy: 'Employee',
        clientApproved: false,
      },
    ],
    approved: [
      {
        id: 5,
        type: 'leave',
        employee: 'David Brown',
        client: 'ABC Corporation',
        description: 'Unpaid Leave',
        date: '2025-12-20',
        details: '1 day - Personal',
        submitted: '2025-12-10 11:00 AM',
        approvedOn: '2025-12-11 9:00 AM',
      },
    ],
    rejected: [
      {
        id: 6,
        type: 'overtime',
        employee: 'Emily Davis',
        client: 'XYZ Industries',
        description: 'Overtime Request',
        date: '2025-12-14',
        details: '6 hours - Not pre-approved',
        submitted: '2025-12-14 10:00 PM',
        rejectedOn: '2025-12-15 9:00 AM',
        reason: 'Overtime exceeds weekly limit',
      },
    ],
  };

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
    { id: 'pending', label: 'Pending', count: approvalItems.pending.length },
    { id: 'approved', label: 'Approved', count: approvalItems.approved.length },
    { id: 'rejected', label: 'Rejected', count: approvalItems.rejected.length },
  ];

  const handleApprove = (item) => {
    setSelectedItem(item);
    setShowApprovalModal(true);
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
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
          {activeTab === 'pending' && approvalItems.pending.length > 0 && (
            <Button variant="primary" icon={CheckCircle}>
              Approve All
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {approvalItems.pending.filter(i => i.clientApproved).length}
              </p>
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
              <p className="text-2xl font-bold text-gray-900">{approvalItems.approved.length}</p>
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
              <p className="text-2xl font-bold text-gray-900">{approvalItems.rejected.length}</p>
              <p className="text-sm text-gray-500">Rejected Today</p>
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
                <TableHeader>Client</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Client Status</TableHeader>
                {activeTab === 'pending' && <TableHeader>Actions</TableHeader>}
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
                  <TableCell>
                    <span className="text-gray-600">{item.client}</span>
                  </TableCell>
                  <TableCell>{getTypeBadge(item.type)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-gray-900">{item.description}</p>
                      <p className="text-xs text-gray-500">{item.details}</p>
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
                        >
                          Reject
                        </Button>
                      </div>
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
        title="Confirm Final Approval"
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
                <span className="font-medium">{selectedItem.type}</span>
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
    </div>
  );
};

export default Approvals;
