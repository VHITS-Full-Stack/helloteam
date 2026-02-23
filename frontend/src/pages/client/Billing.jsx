import { useState, useEffect, useCallback, Fragment } from 'react';
import { CreditCard, Download, FileText, Calendar, DollarSign, Clock, TrendingUp, Loader2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

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
      case 'PAID': return <Badge variant="success">Paid</Badge>;
      case 'SENT': return <Badge variant="info">Sent</Badge>;
      case 'OVERDUE': return <Badge variant="warning">Overdue</Badge>;
      case 'CANCELLED': return <Badge variant="danger">Cancelled</Badge>;
      case 'DRAFT': return <Badge variant="default">Draft</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatPeriod = (periodStart) => {
    if (!periodStart) return '—';
    const d = new Date(periodStart);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const tabs = [
    { id: 'invoices', label: 'Invoices' },
    { id: 'payment', label: 'Payment Method' },
  ];

  const handleExportStatement = () => {
    if (!billingData?.invoices) return;

    const headers = ['Invoice #', 'Period', 'Hours', 'Overtime Hours', 'Amount', 'Due Date', 'Status'];
    const rows = billingData.invoices.map(inv => [
      inv.invoiceNumber,
      formatPeriod(inv.periodStart),
      Number(inv.totalHours || 0).toFixed(1),
      Number(inv.overtimeHours || 0).toFixed(1),
      formatCurrency(inv.total, inv.currency),
      formatDate(inv.dueDate),
      inv.status,
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-statement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (invoiceId, invoiceNumber) => {
    setDownloadingId(invoiceId);
    try {
      await clientPortalService.downloadInvoicePdf(invoiceId, invoiceNumber);
    } catch (err) {
      setError(err.error || 'Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
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
              {currentPeriod.hourlyRate > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary-200" />
                  <span>${currentPeriod.hourlyRate}/hr rate</span>
                </div>
              )}
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
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(billingStats.ytdTotal)}</p>
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
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(billingStats.avgMonthly)}</p>
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
                  <Fragment key={invoice.id}>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <FileText className="w-5 h-5 text-gray-500" />
                          </div>
                          <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatPeriod(invoice.periodStart)}</TableCell>
                      <TableCell>
                        <span>{Number(invoice.totalHours || 0).toFixed(1)}h</span>
                        {Number(invoice.overtimeHours) > 0 && (
                          <span className="text-xs text-orange-500 ml-1">+{Number(invoice.overtimeHours).toFixed(1)} OT</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownloadPdf(invoice.id, invoice.invoiceNumber)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download PDF"
                            disabled={downloadingId === invoice.id}
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          {invoice.lineItems && invoice.lineItems.length > 0 && (
                            <button
                              onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              {expandedInvoice === invoice.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Expanded line items */}
                    {expandedInvoice === invoice.id && invoice.lineItems && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50">
                          <div className="ml-12">
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</p>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Employee</th>
                                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Hours</th>
                                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">OT Hours</th>
                                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Rate</th>
                                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {invoice.lineItems.map((item) => (
                                    <tr key={item.id}>
                                      <td className="px-3 py-2 text-sm text-gray-900">{item.employeeName}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.hours).toFixed(1)}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.overtimeHours).toFixed(1)}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(item.rate)}/hr</td>
                                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
            <div className="p-6 bg-gray-50 rounded-xl text-center">
              <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-900">Coming Soon</p>
              <p className="text-sm text-gray-500 mt-1">
                Online payment management will be available soon. Please contact support to update your payment method.
              </p>
            </div>
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
          </Card>
        </div>
      )}
    </div>
  );
};

export default Billing;
