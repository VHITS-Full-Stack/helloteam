import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Send, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { Card, Button, Badge } from '../../../components/common';
import invoiceService from '../../../services/invoice.service';
import { formatDate, formatHours } from '../../../utils/formatDateTime';

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);

const formatPeriod = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingTimesheet, setDownloadingTimesheet] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showPaidConfirm, setShowPaidConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const response = await invoiceService.getInvoice(id);
        if (response.success) {
          setInvoice(response.data);
        } else {
          setError(response.error || 'Failed to load invoice');
        }
      } catch (err) {
        setError(err.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await invoiceService.downloadInvoicePdf(id, invoice.invoiceNumber);
    } catch (err) {
      setError(err.message || 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadTimesheet = async () => {
    setDownloadingTimesheet(true);
    try {
      await invoiceService.downloadTimesheetPdf(id, invoice.invoiceNumber);
    } catch (err) {
      setError(err.message || 'Failed to download timesheet');
    } finally {
      setDownloadingTimesheet(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const response = await invoiceService.updateInvoiceStatus(id, newStatus);
      if (response.success) {
        setInvoice(prev => ({ ...prev, status: newStatus }));
        setSuccess(`Invoice marked as ${newStatus.toLowerCase()}`);
        setShowSendConfirm(false);
        setShowPaidConfirm(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await invoiceService.deleteInvoice(id);
      if (response.success) {
        navigate('/admin/invoices');
      } else {
        setError(response.error || 'Failed to delete invoice');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      DRAFT: 'bg-gray-100 text-gray-600',
      SENT: 'bg-blue-100 text-blue-700',
      CLIENT_PAID: 'bg-green-100 text-green-700',
      PAID: 'bg-green-100 text-green-700',
      OVERDUE: 'bg-orange-100 text-orange-700',
      CANCELLED: 'bg-red-100 text-red-700',
    };
    const labels = {
      DRAFT: 'Draft',
      SENT: 'Sent',
      CLIENT_PAID: 'Payment Received',
      PAID: 'Confirmed Paid',
      OVERDUE: 'Overdue',
      CANCELLED: 'Cancelled',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.DRAFT}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/admin/invoices')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/invoices')}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invoice {invoice.invoiceNumber}</h2>
            <p className="text-sm text-gray-500">{invoice.client?.companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={downloadingPdf ? Loader2 : Download} onClick={handleDownloadPdf} disabled={downloadingPdf}>
            Invoice PDF
          </Button>
          <Button variant="outline" size="sm" icon={downloadingTimesheet ? Loader2 : FileText} onClick={handleDownloadTimesheet} disabled={downloadingTimesheet}>
            Timesheet PDF
          </Button>
          {invoice.status === 'DRAFT' && (
            <>
              <Button variant="outline" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
                Delete
              </Button>
              <Button variant="primary" size="sm" icon={Send} onClick={() => setShowSendConfirm(true)} loading={updatingStatus}>
                Send to Client
              </Button>
            </>
          )}
          {invoice.status === 'CLIENT_PAID' && (
            <Button variant="primary" size="sm" icon={CheckCircle} onClick={() => setShowPaidConfirm(true)} loading={updatingStatus}>
              Confirm Payment
            </Button>
          )}
          {invoice.status === 'SENT' && (
            <Button variant="primary" size="sm" icon={CheckCircle} onClick={() => setShowPaidConfirm(true)} loading={updatingStatus}>
              Mark as Paid
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 font-medium text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>
      )}

      {/* Invoice Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Client</p>
          <p className="text-sm font-semibold text-gray-900">{invoice.client?.companyName}</p>
          {invoice.client?.contactPerson && (
            <p className="text-xs text-gray-500 mt-0.5">{invoice.client.contactPerson}</p>
          )}
        </Card>
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Period</p>
              <p className="text-sm font-semibold text-gray-900">{formatPeriod(invoice.periodStart)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Due Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatDate(invoice.dueDate, { emptyValue: "—" })}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.total, invoice.currency)}</p>
            </div>
            <div>{getStatusBadge(invoice.status)}</div>
          </div>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-600">Total Hours</span>
          <span className="text-sm font-bold text-blue-700">{formatHours(Number(invoice.totalHours || 0))}</span>
        </div>
        {Number(invoice.overtimeHours) > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg">
            <span className="text-sm text-orange-600">OT Hours</span>
            <span className="text-sm font-bold text-orange-700">{formatHours(Number(invoice.overtimeHours))}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
          <span className="text-sm text-green-600">Subtotal</span>
          <span className="text-sm font-bold text-green-700">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
        </div>
      </div>

      {/* Line Items */}
      {invoice.lineItems && invoice.lineItems.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Line Items ({invoice.lineItems.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Regular Hours</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">OT Hours</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">OT Rate</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-medium text-gray-900">{item.employeeName}</span>
                      {item.notes && (
                        <p className="text-xs text-orange-500 mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 text-right">{formatHours(Number(item.hours))}</td>
                    <td className="px-4 py-2.5 text-sm text-right">
                      {Number(item.overtimeHours || 0) > 0
                        ? <span className="text-orange-600">{formatHours(Number(item.overtimeHours))}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 text-right">{formatCurrency(item.rate)}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 text-right">
                      {Number(item.overtimeHours || 0) > 0 && Number(item.overtimeRate) > 0
                        ? formatCurrency(item.overtimeRate)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">Total</td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatHours(Number(invoice.totalHours))}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatHours(Number(invoice.overtimeHours))}</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-sm font-bold text-gray-900 text-right">{formatCurrency(invoice.total, invoice.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <p className="text-xs text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </Card>
      )}

      {/* Confirmation Modals */}
      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowSendConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg"><Send className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-gray-900 font-medium">Send this invoice to the client?</p>
                <p className="text-sm text-gray-500 mt-1">The client will be notified via email.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSendConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleStatusUpdate('SENT')} disabled={updatingStatus} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 inline-flex items-center gap-2">
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />} Send Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaidConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowPaidConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-gray-900 font-medium">Mark this invoice as paid?</p>
                <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPaidConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleStatusUpdate('PAID')} disabled={updatingStatus} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2">
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-50 rounded-lg"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-gray-900 font-medium">Delete this invoice?</p>
                <p className="text-sm text-gray-500 mt-1">This will permanently delete the invoice and release associated time records.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;
