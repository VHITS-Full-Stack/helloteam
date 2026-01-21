import { useState } from 'react';
import { CreditCard, Download, FileText, Calendar, DollarSign, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../components/common';

const Billing = () => {
  const [activeTab, setActiveTab] = useState('invoices');

  const invoices = [
    {
      id: 'INV-2024-012',
      period: 'December 1-15, 2025',
      amount: 15680.00,
      hours: 320,
      status: 'paid',
      dueDate: '2025-12-20',
      paidDate: '2025-12-18',
    },
    {
      id: 'INV-2024-011',
      period: 'November 16-30, 2025',
      amount: 14520.00,
      hours: 296,
      status: 'paid',
      dueDate: '2025-12-05',
      paidDate: '2025-12-03',
    },
    {
      id: 'INV-2024-010',
      period: 'November 1-15, 2025',
      amount: 15200.00,
      hours: 310,
      status: 'paid',
      dueDate: '2025-11-20',
      paidDate: '2025-11-19',
    },
  ];

  const currentPeriod = {
    period: 'December 16-31, 2025',
    hoursWorked: 192,
    estimatedAmount: 9408.00,
    daysRemaining: 7,
    employees: 5,
  };

  const paymentMethod = {
    type: 'Credit Card',
    last4: '4242',
    brand: 'Visa',
    expiry: '12/26',
  };

  const billingStats = {
    ytdTotal: 168420.00,
    avgMonthly: 14035.00,
    totalHours: 3440,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'overdue':
        return <Badge variant="danger">Overdue</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const tabs = [
    { id: 'invoices', label: 'Invoices' },
    { id: 'payment', label: 'Payment Method' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
          <p className="text-gray-500">Manage invoices and payment methods</p>
        </div>
        <Button variant="outline" icon={Download}>
          Download Statement
        </Button>
      </div>

      {/* Current Period Card */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-primary-200 text-sm">Current Billing Period</p>
            <h3 className="text-2xl font-bold mt-1">{currentPeriod.period}</h3>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-200" />
                <span>{currentPeriod.hoursWorked} hours worked</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-200" />
                <span>{currentPeriod.daysRemaining} days remaining</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary-200 text-sm">Estimated Amount</p>
            <p className="text-3xl font-bold">${currentPeriod.estimatedAmount.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">YTD Total</p>
              <p className="text-2xl font-bold text-gray-900">${billingStats.ytdTotal.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Monthly</p>
              <p className="text-2xl font-bold text-gray-900">${billingStats.avgMonthly.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Hours YTD</p>
              <p className="text-2xl font-bold text-gray-900">{billingStats.totalHours.toLocaleString()}h</p>
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
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'invoices' && (
        <Card padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Invoice</TableHeader>
                <TableHeader>Period</TableHeader>
                <TableHeader>Hours</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Due Date</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader></TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-500" />
                      </div>
                      <span className="font-medium text-gray-900">{invoice.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>{invoice.period}</TableCell>
                  <TableCell>{invoice.hours}h</TableCell>
                  <TableCell>
                    <span className="font-semibold text-gray-900">
                      ${invoice.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" icon={Download}>
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Payment Method</h3>
            <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {paymentMethod.brand} ending in {paymentMethod.last4}
                  </p>
                  <p className="text-sm text-gray-500">Expires {paymentMethod.expiry}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Add New Payment Method
            </Button>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Address</h3>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="font-medium text-gray-900">ABC Corporation</p>
              <p className="text-gray-600 mt-1">123 Business Ave, Suite 500</p>
              <p className="text-gray-600">New York, NY 10001</p>
              <p className="text-gray-600">United States</p>
            </div>
            <Button variant="ghost" className="w-full mt-4">
              Update Address
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Billing;
