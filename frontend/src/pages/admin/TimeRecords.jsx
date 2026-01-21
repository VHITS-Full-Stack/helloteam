import { useState } from 'react';
import { Clock, Calendar, Download, Filter, Search, Building2, ChevronDown, Edit, AlertCircle } from 'lucide-react';
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

const TimeRecords = () => {
  const [selectedClient, setSelectedClient] = useState('all');
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const clients = [
    { id: 'all', name: 'All Clients' },
    { id: 'abc', name: 'ABC Corporation' },
    { id: 'xyz', name: 'XYZ Industries' },
    { id: 'tech', name: 'Tech Solutions' },
  ];

  const timeRecords = [
    {
      id: 1,
      employee: 'John Doe',
      client: 'ABC Corporation',
      date: '2025-12-18',
      clockIn: '09:00 AM',
      clockOut: '06:05 PM',
      hours: 9.08,
      breaks: 1,
      status: 'approved',
    },
    {
      id: 2,
      employee: 'Jane Smith',
      client: 'ABC Corporation',
      date: '2025-12-18',
      clockIn: '08:30 AM',
      clockOut: '05:30 PM',
      hours: 9,
      breaks: 1,
      status: 'pending',
    },
    {
      id: 3,
      employee: 'Mike Johnson',
      client: 'XYZ Industries',
      date: '2025-12-18',
      clockIn: '10:00 AM',
      clockOut: null,
      hours: null,
      breaks: 0,
      status: 'active',
    },
    {
      id: 4,
      employee: 'Sarah Williams',
      client: 'Tech Solutions',
      date: '2025-12-18',
      clockIn: '09:15 AM',
      clockOut: '06:20 PM',
      hours: 9.08,
      breaks: 1,
      status: 'adjusted',
      adjustmentNote: 'Forgot to clock out - adjusted by admin',
    },
    {
      id: 5,
      employee: 'David Brown',
      client: 'ABC Corporation',
      date: '2025-12-17',
      clockIn: '09:00 AM',
      clockOut: '09:00 PM',
      hours: 12,
      breaks: 1,
      status: 'flagged',
      flag: 'Overtime not pre-approved',
    },
  ];

  const stats = {
    totalRecords: 156,
    pendingReview: 12,
    adjustments: 5,
    flagged: 3,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'active':
        return <Badge variant="info">Active</Badge>;
      case 'adjusted':
        return <Badge variant="primary">Adjusted</Badge>;
      case 'flagged':
        return <Badge variant="danger">Flagged</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleAdjust = (record) => {
    setSelectedRecord(record);
    setShowAdjustment(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-gray-500">View and manage all employee time records</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
          <Button variant="outline" icon={Download}>
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
              <p className="text-sm text-gray-500">Total Records</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingReview}</p>
              <p className="text-sm text-gray-500">Pending Review</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Edit className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.adjustments}</p>
              <p className="text-sm text-gray-500">Adjustments</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.flagged}</p>
              <p className="text-sm text-gray-500">Flagged</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-400" />
            <select
              className="input w-48"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input type="date" className="input w-40" defaultValue="2025-12-18" />
            <span className="text-gray-400">to</span>
            <input type="date" className="input w-40" defaultValue="2025-12-18" />
          </div>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input pl-10 w-full"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Time Records Table */}
      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Employee</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Clock In</TableHeader>
              <TableHeader>Clock Out</TableHeader>
              <TableHeader>Hours</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {timeRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={record.employee} size="sm" />
                    <span className="font-medium text-gray-900">{record.employee}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-gray-600">{record.client}</span>
                </TableCell>
                <TableCell>{record.date}</TableCell>
                <TableCell>{record.clockIn}</TableCell>
                <TableCell>
                  {record.clockOut || (
                    <span className="text-green-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Active
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {record.hours ? (
                    <span className={record.hours > 8 ? 'text-orange-600 font-medium' : ''}>
                      {record.hours}h
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    {getStatusBadge(record.status)}
                    {record.flag && (
                      <p className="text-xs text-red-500 mt-1">{record.flag}</p>
                    )}
                    {record.adjustmentNote && (
                      <p className="text-xs text-gray-500 mt-1">{record.adjustmentNote}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    onClick={() => handleAdjust(record)}
                  >
                    Adjust
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustment}
        onClose={() => setShowAdjustment(false)}
        title="Adjust Time Record"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdjustment(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowAdjustment(false)}>
              Save Adjustment
            </Button>
          </>
        }
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-medium text-gray-900">{selectedRecord.employee}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Clock In</label>
                <input
                  type="time"
                  className="input"
                  defaultValue={selectedRecord.clockIn?.replace(' AM', '').replace(' PM', '')}
                />
              </div>
              <div>
                <label className="label">Clock Out</label>
                <input
                  type="time"
                  className="input"
                  defaultValue={selectedRecord.clockOut?.replace(' AM', '').replace(' PM', '')}
                />
              </div>
            </div>
            <div>
              <label className="label">Adjustment Reason</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Reason for adjustment..."
              />
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                This adjustment will be logged and visible to the client for approval.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimeRecords;
