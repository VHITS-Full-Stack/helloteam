import { useState } from 'react';
import {
  DollarSign,
  Download,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Send
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

const Payroll = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('Dec 1-15, 2025');
  const [showProcessModal, setShowProcessModal] = useState(false);

  const payrollSummary = {
    totalEmployees: 45,
    totalHours: 3520,
    regularHours: 3360,
    overtimeHours: 160,
    grossPay: 172480.00,
    status: 'pending',
  };

  const employeePayroll = [
    {
      id: 1,
      employee: 'John Doe',
      client: 'ABC Corporation',
      regularHours: 80,
      overtimeHours: 4,
      rate: 45.00,
      grossPay: 3870.00,
      status: 'ready',
    },
    {
      id: 2,
      employee: 'Jane Smith',
      client: 'ABC Corporation',
      regularHours: 80,
      overtimeHours: 8,
      rate: 50.00,
      grossPay: 4600.00,
      status: 'ready',
    },
    {
      id: 3,
      employee: 'Mike Johnson',
      client: 'XYZ Industries',
      regularHours: 64,
      overtimeHours: 0,
      rate: 42.00,
      grossPay: 2688.00,
      status: 'pending',
      note: 'Leave hours pending approval',
    },
    {
      id: 4,
      employee: 'Sarah Williams',
      client: 'Tech Solutions',
      regularHours: 80,
      overtimeHours: 0,
      rate: 48.00,
      grossPay: 3840.00,
      status: 'ready',
    },
    {
      id: 5,
      employee: 'David Brown',
      client: 'ABC Corporation',
      regularHours: 80,
      overtimeHours: 12,
      rate: 52.00,
      grossPay: 5096.00,
      status: 'flagged',
      note: 'Overtime exceeds limit',
    },
  ];

  const payrollHistory = [
    { period: 'Nov 16-30, 2025', employees: 45, gross: 168420.00, status: 'processed', paidOn: '2025-12-05' },
    { period: 'Nov 1-15, 2025', employees: 44, gross: 165200.00, status: 'processed', paidOn: '2025-11-20' },
    { period: 'Oct 16-31, 2025', employees: 43, gross: 162800.00, status: 'processed', paidOn: '2025-11-05' },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <Badge variant="success">Ready</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'flagged':
        return <Badge variant="danger">Flagged</Badge>;
      case 'processed':
        return <Badge variant="primary">Processed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll</h2>
          <p className="text-gray-500">Process and manage employee payroll</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={Download}>
            Export
          </Button>
          <Button variant="primary" icon={Send} onClick={() => setShowProcessModal(true)}>
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-primary-200 text-sm">Payroll Period</p>
            <div className="flex items-center gap-3 mt-2">
              <Calendar className="w-5 h-5" />
              <select
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white font-medium"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="Dec 1-15, 2025">Dec 1-15, 2025</option>
                <option value="Nov 16-30, 2025">Nov 16-30, 2025</option>
                <option value="Nov 1-15, 2025">Nov 1-15, 2025</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-primary-200 text-sm">Employees</p>
              <p className="text-2xl font-bold">{payrollSummary.totalEmployees}</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Total Hours</p>
              <p className="text-2xl font-bold">{payrollSummary.totalHours}h</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Overtime</p>
              <p className="text-2xl font-bold">{payrollSummary.overtimeHours}h</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Gross Pay</p>
              <p className="text-2xl font-bold">${payrollSummary.grossPay.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {employeePayroll.filter(e => e.status === 'ready').length}
              </p>
              <p className="text-sm text-gray-500">Ready to Process</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {employeePayroll.filter(e => e.status === 'pending').length}
              </p>
              <p className="text-sm text-gray-500">Pending Approval</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {employeePayroll.filter(e => e.status === 'flagged').length}
              </p>
              <p className="text-sm text-gray-500">Flagged</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(payrollSummary.grossPay / payrollSummary.totalEmployees).toFixed(0)}
              </p>
              <p className="text-sm text-gray-500">Avg Per Employee</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Payroll Table */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Payroll Details</h3>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Employee</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader className="text-right">Regular Hours</TableHeader>
              <TableHeader className="text-right">Overtime</TableHeader>
              <TableHeader className="text-right">Rate</TableHeader>
              <TableHeader className="text-right">Gross Pay</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {employeePayroll.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={emp.employee} size="sm" />
                    <span className="font-medium text-gray-900">{emp.employee}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-gray-600">{emp.client}</span>
                </TableCell>
                <TableCell className="text-right">{emp.regularHours}h</TableCell>
                <TableCell className="text-right">
                  {emp.overtimeHours > 0 ? (
                    <span className="text-orange-600 font-medium">{emp.overtimeHours}h</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">${emp.rate.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold text-gray-900">
                  ${emp.grossPay.toLocaleString()}
                </TableCell>
                <TableCell>
                  <div>
                    {getStatusBadge(emp.status)}
                    {emp.note && (
                      <p className="text-xs text-gray-500 mt-1">{emp.note}</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Payroll History */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll History</h3>
        <div className="space-y-3">
          {payrollHistory.map((record, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{record.period}</p>
                  <p className="text-sm text-gray-500">{record.employees} employees</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${record.gross.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Paid {record.paidOn}</p>
                </div>
                {getStatusBadge(record.status)}
                <Button variant="ghost" size="sm" icon={Download}>
                  Report
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Process Modal */}
      <Modal
        isOpen={showProcessModal}
        onClose={() => setShowProcessModal(false)}
        title="Process Payroll"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowProcessModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={Send} onClick={() => setShowProcessModal(false)}>
              Process Payroll
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-primary-50 rounded-xl">
            <p className="text-sm text-primary-600 font-medium">Period</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{selectedPeriod}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{payrollSummary.totalEmployees}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Total Gross Pay</p>
              <p className="text-2xl font-bold text-gray-900">${payrollSummary.grossPay.toLocaleString()}</p>
            </div>
          </div>

          {employeePayroll.some(e => e.status === 'pending' || e.status === 'flagged') && (
            <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Some items need attention
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {employeePayroll.filter(e => e.status === 'pending').length} pending approval,{' '}
                  {employeePayroll.filter(e => e.status === 'flagged').length} flagged for review.
                  These will be excluded from this payroll run.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Add any notes for this payroll run..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Payroll;
