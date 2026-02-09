import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Download, FileText, Calendar, DollarSign, Clock, TrendingUp, Loader2 } from 'lucide-react';
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
import clientPortalService from '../../services/clientPortal.service';

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices');

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getBilling();
      if (response.success) {
        setBillingData(response.data);
      } else {
        setError(response.error || 'Failed to load billing data');
      }
    } catch (err) {
      console.error('Error fetching billing:', err);
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

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

  const handleExportStatement = () => {
    // Generate CSV statement
    if (!billingData?.invoices) return;

    const headers = ['Invoice ID', 'Period', 'Hours', 'Amount', 'Due Date', 'Status', 'Paid Date'];
    const rows = billingData.invoices.map(inv => [
      inv.id,
      inv.period,
      inv.hours,
      `$${inv.amount.toLocaleString()}`,
      inv.dueDate,
      inv.status,
      inv.paidDate || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-statement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPeriod = billingData?.currentPeriod || {
    period: 'Loading...',
    hoursWorked: 0,
    estimatedAmount: 0,
    daysRemaining: 0,
    employees: 0,
    hourlyRate: 0,
  };

  const billingStats = billingData?.stats || {
    ytdTotal: 0,
    avgMonthly: 0,
    totalHours: 0,
  };

  const invoices = billingData?.invoices || [];
  const billingInfo = billingData?.billingInfo || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
          <p className="text-gray-500">Manage invoices and payment methods</p>
        </div>
        <Button variant="outline" icon={Download} onClick={handleExportStatement}>
          Download Statement
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={fetchBilling} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Current Period Card */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-primary-200 text-sm">Current Billing Period</p>
            <h3 className="text-2xl font-bold mt-1">{currentPeriod.period}</h3>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-200" />
                <span>{currentPeriod.hoursWorked} hours worked</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-200" />
                <span>{currentPeriod.daysRemaining} days remaining</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary-200" />
                <span>${currentPeriod.hourlyRate}/hr rate</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary-200 text-sm">Estimated Amount</p>
            <p className="text-3xl font-bold">${currentPeriod.estimatedAmount.toLocaleString()}</p>
            <p className="text-primary-200 text-sm mt-1">{currentPeriod.employees} active employees</p>
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
          {invoices.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Invoice</TableHeader>
                  <TableHeader>Period</TableHeader>
                  <TableHeader>Hours</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Due Date</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader />
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
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No invoices</h3>
              <p className="text-gray-500">No invoice history available yet.</p>
            </div>
          )}
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
                    Credit Card ending in ****
                  </p>
                  <p className="text-sm text-gray-500">Contact support to update</p>
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
              <p className="font-medium text-gray-900">{billingInfo.companyName || 'Company Name'}</p>
              {billingInfo.billingAddress ? (
                <p className="text-gray-600 mt-1 whitespace-pre-line">{billingInfo.billingAddress}</p>
              ) : (
                <p className="text-gray-400 mt-1">No billing address on file</p>
              )}
              {billingInfo.billingEmail && (
                <p className="text-gray-600 mt-2">
                  <span className="text-gray-500">Email:</span> {billingInfo.billingEmail}
                </p>
              )}
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
