import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Download, FileText, DollarSign, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
} from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingData, setBillingData] = useState(null);
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
      case 'PAID': return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Paid</span>;
      case 'SENT': return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Sent</span>;
      case 'OVERDUE': return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">Overdue</span>;
      case 'CANCELLED': return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Declined</span>;
      case 'DRAFT': return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Draft</span>;
      default: return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(amount) || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleExportStatement = () => {
    if (!billingData?.invoices) return;
    const headers = ['Invoice #', 'Period', 'Hours', 'Overtime Hours', 'Amount', 'Due Date', 'Status'];
    const rows = billingData.invoices.map(inv => [
      inv.invoiceNumber,
      formatDate(inv.periodStart),
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

  const billingStats = billingData?.stats || { ytdTotal: 0, avgMonthly: 0, totalHours: 0 };
  const invoices = billingData?.invoices || [];
  const billingInfo = billingData?.billingInfo || {};

  // Calculate breakdown for upcoming invoice
  const regularHours = Math.max(0, currentPeriod.hoursWorked);
  const regularAmount = regularHours * (currentPeriod.hourlyRate || 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Billing & Invoices</h2>
        <Button variant="outline" size="sm" icon={Download} onClick={handleExportStatement}>
          Export CSV
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={fetchBilling} className="text-sm text-red-500 underline">Retry</button>
        </div>
      )}

      {/* Top Row: Payment Method + Upcoming Invoice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment Method Card */}
        <Card>
          <h3 className="text-base font-bold text-gray-900 mb-4">Payment Method</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Coming Soon</p>
                  <p className="text-xs text-gray-400">Contact support to update</p>
                </div>
              </div>
            </div>
          </div>
          {/* Billing Info */}
          {(billingInfo.companyName || billingInfo.billingAddress) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Billing Address</p>
              <p className="text-sm font-medium text-gray-900">{billingInfo.companyName || ''}</p>
              {billingInfo.billingAddress && (
                <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-line">{billingInfo.billingAddress}</p>
              )}
              {billingInfo.billingEmail && (
                <p className="text-sm text-gray-500 mt-1">{billingInfo.billingEmail}</p>
              )}
            </div>
          )}
        </Card>

        {/* Upcoming Invoice Card */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-gray-900">Current Period</h3>
            <span className="text-xs text-gray-400">{currentPeriod.period}</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">{currentPeriod.daysRemaining} days remaining</p>

          <p className="text-3xl font-bold text-gray-900 mb-4">
            {formatCurrency(currentPeriod.estimatedAmount)}
          </p>

          <div className="space-y-2.5">
            {currentPeriod.hourlyRate > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Regular Hours ({regularHours}h x ${currentPeriod.hourlyRate}/hr)
                </span>
                <span className="text-sm text-gray-900">{formatCurrency(regularAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Active Employees</span>
              <span className="text-sm text-gray-900">{currentPeriod.employees}</span>
            </div>
            <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Estimated Total</span>
              <span className="text-sm font-bold text-primary-600">{formatCurrency(currentPeriod.estimatedAmount)}</span>
            </div>
          </div>

          {/* YTD stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6">
            <div>
              <p className="text-xs text-gray-400">This Year</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(billingStats.ytdTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg/Month</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(billingStats.avgMonthly)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Hours</p>
              <p className="text-sm font-bold text-gray-900">{billingStats.totalHours.toLocaleString()}h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Invoice History */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Invoice History</h3>
        </div>

        {invoices.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => (
              <div key={invoice.id}>
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  {/* Left: Invoice info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="text-sm font-semibold text-primary-600">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-gray-400">{formatDate(invoice.periodStart)}</p>
                    </div>
                    {invoice.status === 'PAID'
                      ? getStatusBadge('PAID')
                      : invoice.status === 'CANCELLED'
                        ? getStatusBadge('CANCELLED')
                        : <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Pending</span>
                    }
                  </div>

                  {/* Right: Amount + Actions */}
                  <div className="flex items-center gap-4">
                    <p className={`text-sm font-bold ${invoice.status === 'CANCELLED' ? 'text-red-500' : 'text-gray-900'}`}>
                      {formatCurrency(invoice.total, invoice.currency)}
                    </p>
                    <div className="flex items-center gap-2">
                      {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.status !== 'DRAFT' && (
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Pay Now
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadPdf(invoice.id, invoice.invoiceNumber)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        disabled={downloadingId === invoice.id}
                      >
                        {downloadingId === invoice.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </>
                        )}
                      </button>
                      {invoice.lineItems && invoice.lineItems.length > 0 && (
                        <button
                          onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                        >
                          {expandedInvoice === invoice.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded line items */}
                {expandedInvoice === invoice.id && invoice.lineItems && (
                  <div className="px-5 pb-4">
                    <div className="ml-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Employee</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Hours</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">OT</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Rate</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {invoice.lineItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-sm text-gray-900">{item.employeeName}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.hours).toFixed(1)}</td>
                              <td className="px-3 py-2 text-sm text-right">
                                {Number(item.overtimeHours) > 0
                                  ? <span className="text-orange-600">{Number(item.overtimeHours).toFixed(1)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(item.rate)}/hr</td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No invoices yet</p>
            <p className="text-sm text-gray-400 mt-1">Invoice history will appear here once generated.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Billing;
