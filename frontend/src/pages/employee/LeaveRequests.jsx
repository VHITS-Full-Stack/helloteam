import { useState } from 'react';
import { Plus, Calendar, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../components/common';

const LeaveRequests = () => {
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [requestType, setRequestType] = useState('unpaid');

  const leaveBalance = {
    paid: { used: 5, total: 15, available: 10 },
    unpaid: { used: 2, total: 'Unlimited', available: 'Unlimited' },
  };

  const leaveRequests = [
    {
      id: 1,
      type: 'Paid Leave',
      startDate: '2025-12-25',
      endDate: '2025-12-26',
      days: 2,
      reason: 'Christmas Holiday',
      status: 'approved',
      submittedOn: '2025-12-10',
    },
    {
      id: 2,
      type: 'Unpaid Leave',
      startDate: '2025-12-30',
      endDate: '2025-12-31',
      days: 2,
      reason: 'Personal Work',
      status: 'pending',
      submittedOn: '2025-12-15',
    },
    {
      id: 3,
      type: 'Paid Leave',
      startDate: '2025-11-15',
      endDate: '2025-11-15',
      days: 1,
      reason: 'Medical Appointment',
      status: 'approved',
      submittedOn: '2025-11-10',
    },
    {
      id: 4,
      type: 'Unpaid Leave',
      startDate: '2025-10-20',
      endDate: '2025-10-20',
      days: 1,
      reason: 'Family Emergency',
      status: 'rejected',
      submittedOn: '2025-10-18',
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'rejected':
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
          <h2 className="text-2xl font-bold text-gray-900">Leave Requests</h2>
          <p className="text-gray-500">Manage your availability and leave</p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowNewRequest(true)}
        >
          New Request
        </Button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Paid Leave Balance</h3>
              <p className="text-sm text-gray-500 mt-1">Annual paid leave entitlement</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-gray-900">{leaveBalance.paid.available}</span>
              <span className="text-gray-500 mb-1">days available</span>
            </div>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${(leaveBalance.paid.available / leaveBalance.paid.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>Used: {leaveBalance.paid.used} days</span>
              <span>Total: {leaveBalance.paid.total} days</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Unpaid Leave</h3>
              <p className="text-sm text-gray-500 mt-1">Availability requests (2 weeks notice)</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-gray-900">{leaveBalance.unpaid.used}</span>
              <span className="text-gray-500 mb-1">days used this year</span>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Unpaid leave requests require 2 weeks advance notice. Shorter notice
                  requests will be flagged for review.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Leave Requests Table */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Request History</h3>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Type</TableHeader>
              <TableHeader>Dates</TableHeader>
              <TableHeader>Days</TableHeader>
              <TableHeader>Reason</TableHeader>
              <TableHeader>Created At</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaveRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <span className="font-medium">{request.type}</span>
                </TableCell>
                <TableCell>
                  {request.startDate === request.endDate
                    ? request.startDate
                    : `${request.startDate} - ${request.endDate}`}
                </TableCell>
                <TableCell>{request.days}</TableCell>
                <TableCell>
                  <span className="truncate max-w-xs block">{request.reason}</span>
                </TableCell>
                <TableCell>{request.submittedOn}</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Approval Flow Info */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Process</h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary font-semibold">1</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Submit Request</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <span className="text-yellow-600 font-semibold">2</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Client Review</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 font-semibold">3</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Hello Team Approval</span>
            </div>
          </div>
        </div>
      </Card>

      {/* New Request Modal */}
      <Modal
        isOpen={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        title="New Leave Request"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewRequest(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowNewRequest(false)}>
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Leave Type */}
          <div>
            <label className="label">Leave Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRequestType('paid')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  requestType === 'paid'
                    ? 'border-primary bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">Paid Leave</p>
                <p className="text-sm text-gray-500">{leaveBalance.paid.available} days available</p>
              </button>
              <button
                onClick={() => setRequestType('unpaid')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  requestType === 'unpaid'
                    ? 'border-primary bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">Unpaid Leave</p>
                <p className="text-sm text-gray-500">Availability request</p>
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              placeholder="Select date"
              min={new Date().toISOString().split('T')[0]}
            />
            <Input
              label="End Date"
              type="date"
              placeholder="Select date"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Reason */}
          <div>
            <label className="label">Reason</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Please provide a reason for your leave request..."
            />
          </div>

          {/* Notice Warning */}
          {requestType === 'unpaid' && (
            <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Standard notice is 2 weeks. Requests with shorter notice will be flagged
                and may take longer to process.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default LeaveRequests;
