import { useState } from 'react';
import { Clock, Calendar, Download, Filter, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
  TableCell
} from '../../components/common';

const TimeRecords = () => {
  const [selectedWeek, setSelectedWeek] = useState('Dec 16 - Dec 22, 2025');
  const [searchQuery, setSearchQuery] = useState('');

  const timeRecords = [
    {
      id: 1,
      employee: 'John Doe',
      department: 'Engineering',
      mon: 8,
      tue: 8,
      wed: 8,
      thu: 8,
      fri: 8,
      sat: 0,
      sun: 0,
      total: 40,
      overtime: 0,
      status: 'approved',
    },
    {
      id: 2,
      employee: 'Jane Smith',
      department: 'Engineering',
      mon: 8,
      tue: 9,
      wed: 8,
      thu: 8,
      fri: 8,
      sat: 3,
      sun: 0,
      total: 44,
      overtime: 4,
      status: 'pending',
    },
    {
      id: 3,
      employee: 'Mike Johnson',
      department: 'Design',
      mon: 8,
      tue: 8,
      wed: 0,
      thu: 0,
      fri: 8,
      sat: 0,
      sun: 0,
      total: 24,
      overtime: 0,
      status: 'approved',
      note: 'Leave: Wed-Thu',
    },
    {
      id: 4,
      employee: 'Sarah Williams',
      department: 'Marketing',
      mon: 8,
      tue: 8,
      wed: 8,
      thu: 8,
      fri: 8,
      sat: 0,
      sun: 0,
      total: 40,
      overtime: 0,
      status: 'approved',
    },
    {
      id: 5,
      employee: 'David Brown',
      department: 'Engineering',
      mon: 8,
      tue: 8,
      wed: 8,
      thu: 8,
      fri: 8,
      sat: 4,
      sun: 0,
      total: 44,
      overtime: 4,
      status: 'pending',
    },
  ];

  const summary = {
    totalEmployees: 5,
    totalHours: 192,
    regularHours: 184,
    overtimeHours: 8,
    pendingApprovals: 2,
  };

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

  const getCellClass = (hours) => {
    if (hours === 0) return 'text-gray-300';
    if (hours > 8) return 'text-orange-600 font-medium';
    return 'text-gray-900';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-gray-500">View and manage employee time records</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Employees</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalEmployees}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalHours}h</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Regular Hours</p>
          <p className="text-2xl font-bold text-green-600">{summary.regularHours}h</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Overtime</p>
          <p className="text-2xl font-bold text-orange-600">{summary.overtimeHours}h</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.pendingApprovals}</p>
        </Card>
      </div>

      {/* Week Selector and Search */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900">{selectedWeek}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              className="input pl-10 w-full md:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Time Records Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader className="text-center">Mon</TableHeader>
                <TableHeader className="text-center">Tue</TableHeader>
                <TableHeader className="text-center">Wed</TableHeader>
                <TableHeader className="text-center">Thu</TableHeader>
                <TableHeader className="text-center">Fri</TableHeader>
                <TableHeader className="text-center">Sat</TableHeader>
                <TableHeader className="text-center">Sun</TableHeader>
                <TableHeader className="text-center">Total</TableHeader>
                <TableHeader className="text-center">OT</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {timeRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={record.employee} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{record.employee}</p>
                        <p className="text-xs text-gray-500">{record.department}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.mon)}`}>
                    {record.mon > 0 ? record.mon : '-'}
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.tue)}`}>
                    {record.tue > 0 ? record.tue : '-'}
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.wed)}`}>
                    {record.wed > 0 ? record.wed : '-'}
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.thu)}`}>
                    {record.thu > 0 ? record.thu : '-'}
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.fri)}`}>
                    {record.fri > 0 ? record.fri : '-'}
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.sat)}`}>
                    {record.sat > 0 ? record.sat : '-'}
                  </TableCell>
                  <TableCell className={`text-center ${getCellClass(record.sun)}`}>
                    {record.sun > 0 ? record.sun : '-'}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-gray-900">
                    {record.total}h
                  </TableCell>
                  <TableCell className="text-center">
                    {record.overtime > 0 ? (
                      <span className="text-orange-600 font-medium">+{record.overtime}h</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Overtime</span>
        </div>
      </div>
    </div>
  );
};

export default TimeRecords;
