import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
  RefreshCw,
  AlertCircle,
  X,
  Eye,
  Send,
  Trash2,
  Play,
  Loader2,
  Download,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
} from '../../../components/common';
import invoiceService from '../../../services/invoice.service';
import clientService from '../../../services/client.service';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateFrequency, setGenerateFrequency] = useState('monthly');
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  const [generateWeek, setGenerateWeek] = useState(() => {
    // Calculate current ISO week number
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  });
  const [generating, setGenerating] = useState(false);

  // Status update
  const [updatingId, setUpdatingId] = useState(null);
  const [stats, setStats] = useState({ total: 0, draft: 0, totalAmount: 0, paidAmount: 0 });

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchingRef = useRef(false);

  const fetchInvoices = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedClient !== 'all') params.clientId = selectedClient;

      const response = await invoiceService.getInvoices(params);
      if (response.success) {
        setInvoices(response.data.invoices || []);
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.data.pagination.total,
            totalPages: response.data.pagination.totalPages,
          }));
        }
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [pagination.page, pagination.limit, selectedStatus, selectedClient]);

  const fetchClients = useCallback(async () => {
    try {
      const response = await clientService.getClients({ limit: 100 });
      if (response.success) {
        setClients(response.data.clients || []);
      }
    } catch (err) {
      // Non-critical, silently fail
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [selectedStatus, selectedClient]);

  const handleViewInvoice = async (invoiceId) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const response = await invoiceService.getInvoice(invoiceId);
      if (response.success) {
        setSelectedInvoice(response.data);
      } else {
        setError(response.error || 'Failed to load invoice');
        setShowDetailModal(false);
      }
    } catch (err) {
      setError(err.error || 'Failed to load invoice');
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStatusUpdate = async (invoiceId, newStatus) => {
    setUpdatingId(invoiceId);
    try {
      const response = await invoiceService.updateInvoiceStatus(invoiceId, newStatus);
      if (response.success) {
        setSuccess(`Invoice marked as ${newStatus.toLowerCase()}`);
        setTimeout(() => setSuccess(''), 3000);
        fetchInvoices();
        if (selectedInvoice?.id === invoiceId) {
          setSelectedInvoice(prev => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        setError(response.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (invoiceId) => {
    if (!confirm('Delete this draft invoice?')) return;
    try {
      const response = await invoiceService.deleteInvoice(invoiceId);
      if (response.success) {
        setSuccess('Invoice deleted');
        setTimeout(() => setSuccess(''), 3000);
        fetchInvoices();
      } else {
        setError(response.error || 'Failed to delete invoice');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete invoice');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const params = { year: generateYear, frequency: generateFrequency };
      if (generateFrequency === 'weekly') {
        params.week = generateWeek;
      } else {
        params.month = generateMonth;
      }
      const response = await invoiceService.generateInvoices(params);
      if (response.success) {
        setShowGenerateModal(false);
        setSuccess(response.message || 'Invoices generated successfully');
        setTimeout(() => setSuccess(''), 5000);
        fetchInvoices();
      } else {
        setError(response.error || 'Failed to generate invoices');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadPdf = async (invoiceId, invoiceNumber) => {
    setDownloadingId(invoiceId);
    try {
      await invoiceService.downloadInvoicePdf(invoiceId, invoiceNumber);
    } catch (err) {
      setError(err.error || 'Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID': return <Badge variant="success">Paid</Badge>;
      case 'SENT': return <Badge variant="info">Sent</Badge>;
      case 'OVERDUE': return <Badge variant="warning">Overdue</Badge>;
      case 'CANCELLED': return <Badge variant="danger">Cancelled</Badge>;
      case 'DRAFT':
      default: return <Badge variant="default">Draft</Badge>;
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatPeriod = (start) => {
    if (!start) return '—';
    const s = new Date(start);
    return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="text-gray-500">Manage client invoices and billing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={fetchInvoices}>
            Refresh
          </Button>
          <Button variant="primary" icon={Play} onClick={() => setShowGenerateModal(true)}>
            Generate Invoices
          </Button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Invoices</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
              <p className="text-sm text-gray-500">Drafts</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.paidAmount)}</p>
              <p className="text-sm text-gray-500">Paid</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
              <p className="text-sm text-gray-500">Total Amount</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm flex-1"
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Invoice Table */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-gray-500">Loading invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No invoices found</p>
            <p className="text-sm text-gray-400 mt-1">Generate invoices for a past billing period to get started</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{invoice.client?.companyName || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{formatPeriod(invoice.periodStart)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-gray-900">{Number(invoice.totalHours || 0).toFixed(1)}</p>
                      {Number(invoice.overtimeHours) > 0 && (
                        <p className="text-xs text-orange-500">+{Number(invoice.overtimeHours).toFixed(1)} OT</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.total, invoice.currency)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{formatDate(invoice.dueDate)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewInvoice(invoice.id)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
                        {invoice.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(invoice.id, 'SENT')}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Mark as Sent"
                              disabled={updatingId === invoice.id}
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(invoice.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {invoice.status === 'SENT' && (
                          <button
                            onClick={() => handleStatusUpdate(invoice.id, 'PAID')}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Mark as Paid"
                            disabled={updatingId === invoice.id}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Generate Invoices Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Invoices" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate invoices for clients based on approved time records for the selected period.
          </p>

          {/* Frequency Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setGenerateFrequency('monthly')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  generateFrequency === 'monthly'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setGenerateFrequency('weekly')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  generateFrequency === 'weekly'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          {generateFrequency === 'monthly' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {monthNames.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  min={2020}
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week Number</label>
                <input
                  type="number"
                  value={generateWeek}
                  onChange={(e) => setGenerateWeek(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  min={1}
                  max={53}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  min={2020}
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            {generateFrequency === 'monthly'
              ? 'Monthly invoices will be generated for Monthly agreement clients only. Existing invoices for the same period will be skipped.'
              : 'Weekly invoices will be generated for Weekly and Bi-Weekly agreement clients only (Mon-Sun period). Existing invoices will be skipped.'
            }
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleGenerate} loading={generating}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedInvoice(null); }}
        title={selectedInvoice ? `Invoice ${selectedInvoice.invoiceNumber}` : 'Invoice Details'}
        size="lg"
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : selectedInvoice ? (
          <div className="space-y-5">
            {/* Invoice header info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="text-sm font-medium text-gray-900">{selectedInvoice.client?.companyName}</p>
                {selectedInvoice.client?.contactPerson && (
                  <p className="text-xs text-gray-500">{selectedInvoice.client.contactPerson}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Status</p>
                <div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">Period</p>
                <p className="text-sm font-medium text-gray-900">{formatPeriod(selectedInvoice.periodStart)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Due Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(selectedInvoice.dueDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</p>
              </div>
            </div>

            {/* Line Items */}
            {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Line Items</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
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
                      {selectedInvoice.lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.employeeName}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.hours).toFixed(1)}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.overtimeHours).toFixed(1)}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(item.rate)}/hr</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{Number(selectedInvoice.totalHours).toFixed(1)}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{Number(selectedInvoice.overtimeHours).toFixed(1)}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {selectedInvoice.notes && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">{selectedInvoice.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                icon={downloadingId === selectedInvoice.id ? Loader2 : Download}
                onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoiceNumber)}
                disabled={downloadingId === selectedInvoice.id}
              >
                Download PDF
              </Button>
              {selectedInvoice.status === 'DRAFT' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => { handleDelete(selectedInvoice.id); setShowDetailModal(false); }}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    onClick={() => handleStatusUpdate(selectedInvoice.id, 'SENT')}
                    loading={updatingId === selectedInvoice.id}
                  >
                    Mark as Sent
                  </Button>
                </>
              )}
              {selectedInvoice.status === 'SENT' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle}
                  onClick={() => handleStatusUpdate(selectedInvoice.id, 'PAID')}
                  loading={updatingId === selectedInvoice.id}
                >
                  Mark as Paid
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default Invoices;
