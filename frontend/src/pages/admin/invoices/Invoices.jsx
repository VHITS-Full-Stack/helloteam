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
  ChevronDown,
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
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateFrequency, setGenerateFrequency] = useState('monthly');
  const [generateYear, setGenerateYear] = useState(() => {
    const now = new Date();
    // Default to previous month's year (handles January → December of previous year)
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [generateMonth, setGenerateMonth] = useState(() => {
    const now = new Date();
    // Default to previous month (handles January → December)
    return now.getMonth() === 0 ? 12 : now.getMonth();
  });
  const [generateWeek, setGenerateWeek] = useState(() => {
    // Default to previous week's ISO week number
    const now = new Date();
    const prevWeek = new Date(now);
    prevWeek.setDate(now.getDate() - 7);
    const d = new Date(Date.UTC(prevWeek.getFullYear(), prevWeek.getMonth(), prevWeek.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  });
  const [generateClientId, setGenerateClientId] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [generateStep, setGenerateStep] = useState('params'); // 'params' | 'preview'
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);

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
      if (filterYear !== 'all' && filterMonth !== 'all') {
        params.month = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
      } else if (filterYear !== 'all') {
        params.year = filterYear;
      }

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
  }, [pagination.page, pagination.limit, selectedStatus, selectedClient, filterYear, filterMonth]);

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
  }, [selectedStatus, selectedClient, filterYear, filterMonth]);

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

  const [deleteInvoiceId, setDeleteInvoiceId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteInvoiceId) return;
    setDeleting(true);
    try {
      const response = await invoiceService.deleteInvoice(deleteInvoiceId);
      if (response.success) {
        setSuccess('Invoice deleted');
        setTimeout(() => setSuccess(''), 3000);
        setDeleteInvoiceId(null);
        fetchInvoices();
      } else {
        setError(response.error || 'Failed to delete invoice');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  const getGenerateParams = () => {
    const params = { year: generateYear, frequency: generateFrequency };
    if (generateFrequency === 'weekly') {
      params.week = generateWeek;
    } else {
      params.month = generateMonth;
    }
    if (generateClientId !== 'all') {
      params.clientId = generateClientId;
    }
    return params;
  };

  const [generateError, setGenerateError] = useState('');

  const handlePreview = async () => {
    setPreviewing(true);
    setGenerateError('');
    try {
      const response = await invoiceService.previewInvoices(getGenerateParams());
      if (response.success) {
        setPreviewData(response.data);
        setGenerateStep('preview');
      } else {
        setGenerateError(response.error || 'Failed to preview invoices');
      }
    } catch (err) {
      setGenerateError(err.error || err.message || 'Failed to preview invoices');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      const response = await invoiceService.generateInvoices(getGenerateParams());
      if (response.success) {
        setShowGenerateModal(false);
        setGenerateStep('params');
        setPreviewData(null);
        setGenerateError('');
        setGenerateClientId('all');
        setSuccess(response.message || 'Invoices generated successfully');
        setTimeout(() => setSuccess(''), 5000);
        fetchInvoices();
      } else {
        setGenerateError(response.error || 'Failed to generate invoices');
      }
    } catch (err) {
      setGenerateError(err.error || err.message || 'Failed to generate invoices');
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

  const [downloadingTimesheetId, setDownloadingTimesheetId] = useState(null);

  const handleDownloadTimesheetPdf = async (invoiceId, invoiceNumber) => {
    setDownloadingTimesheetId(invoiceId);
    try {
      await invoiceService.downloadTimesheetPdf(invoiceId, invoiceNumber);
    } catch (err) {
      setError(err.error || 'Failed to download timesheet PDF');
    } finally {
      setDownloadingTimesheetId(null);
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
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="appearance-none pr-9 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            >
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative flex-1">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="appearance-none pr-9 w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="appearance-none pr-9 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            >
              <option value="all">All Years</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="appearance-none pr-9 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            >
              <option value="all">All Months</option>
              {[
                { value: 1, label: 'January' },
                { value: 2, label: 'February' },
                { value: 3, label: 'March' },
                { value: 4, label: 'April' },
                { value: 5, label: 'May' },
                { value: 6, label: 'June' },
                { value: 7, label: 'July' },
                { value: 8, label: 'August' },
                { value: 9, label: 'September' },
                { value: 10, label: 'October' },
                { value: 11, label: 'November' },
                { value: 12, label: 'December' },
              ].map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
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
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
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
                      <p className="text-sm text-gray-900">{Number(invoice.totalHours || 0).toFixed(2)}</p>
                      {Number(invoice.overtimeHours) > 0 && (
                        <p className="text-xs text-orange-500">+{Number(invoice.overtimeHours).toFixed(2)} OT</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const rates = [...new Set((invoice.lineItems || []).map(li => Number(li.rate)))].filter(r => r > 0);
                        if (rates.length === 0) return <span className="text-sm text-gray-400">-</span>;
                        if (rates.length === 1) return <p className="text-sm text-gray-600">{formatCurrency(rates[0])}/hr</p>;
                        return <p className="text-sm text-gray-600">{formatCurrency(Math.min(...rates))} - {formatCurrency(Math.max(...rates))}/hr</p>;
                      })()}
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
                          title="Download Invoice PDF"
                          disabled={downloadingId === invoice.id}
                        >
                          {downloadingId === invoice.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownloadTimesheetPdf(invoice.id, invoice.invoiceNumber)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Download Timesheet PDF"
                          disabled={downloadingTimesheetId === invoice.id}
                        >
                          {downloadingTimesheetId === invoice.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
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
                              onClick={() => setDeleteInvoiceId(invoice.id)}
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
      <Modal
        isOpen={showGenerateModal}
        onClose={() => { setShowGenerateModal(false); setGenerateStep('params'); setPreviewData(null); setGenerateError(''); setGenerateClientId('all'); }}
        title={generateStep === 'params' ? 'Generate Invoices' : 'Preview — Invoices to Generate'}
        size={generateStep === 'params' ? 'sm' : 'md'}
      >
        {generateError && (
          <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 flex-1">{generateError}</p>
            <button onClick={() => setGenerateError('')} className="text-red-400 hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {generateStep === 'params' ? (
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

            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <div className="relative">
                <select
                  value={generateClientId}
                  onChange={(e) => setGenerateClientId(e.target.value)}
                  className="appearance-none pr-9 w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="all">All Clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {generateFrequency === 'monthly' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <div className="relative">
                    <select
                      value={generateMonth}
                      onChange={(e) => setGenerateMonth(parseInt(e.target.value))}
                      className="appearance-none pr-9 w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      {monthNames.map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
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
              {generateClientId !== 'all'
                ? `Invoice will be generated for the selected client only. Existing invoices for the same period will be skipped.`
                : generateFrequency === 'monthly'
                  ? 'Monthly invoices will be generated for Monthly agreement clients only. Existing invoices for the same period will be skipped.'
                  : 'Weekly invoices will be generated for Weekly and Bi-Weekly agreement clients only (Mon-Sun period). Existing invoices will be skipped.'
              }
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
              <Button variant="primary" icon={Eye} onClick={handlePreview} loading={previewing}>
                Preview
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            {previewData?.summary && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{previewData.summary.clientCount}</p>
                  <p className="text-xs text-blue-600">Clients</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{Number(previewData.summary.totalHours || 0).toFixed(2)}</p>
                  <p className="text-xs text-green-600">Total Hours</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(previewData.summary.totalEstimatedAmount)}</p>
                  <p className="text-xs text-purple-600">Est. Total</p>
                </div>
              </div>
            )}

            {/* Per-client preview with employee line items */}
            {previewData?.preview?.length > 0 ? (
              <div className="space-y-3">
                {previewData.preview.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Client header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{item.clientName}</p>
                          {item.alreadyExists && (
                            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Already Generated
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{item.invoiceNumber}</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-xs text-gray-400">Hours</p>
                          <p className="text-sm font-semibold text-gray-900">{Number(item.totalHours).toFixed(2)}</p>
                        </div>
                        {Number(item.overtimeHours) > 0 && (
                          <div>
                            <p className="text-xs text-orange-400">OT</p>
                            <p className="text-sm font-semibold text-orange-600">{Number(item.overtimeHours).toFixed(2)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-400">Est. Amount</p>
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(item.estimatedTotal, item.currency)}</p>
                        </div>
                      </div>
                    </div>
                    {/* Employee line items */}
                    {item.lineItems?.length > 0 && (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">Employee</th>
                            <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">Hours</th>
                            <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">OT</th>
                            <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">Rate</th>
                            <th className="text-right px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {item.lineItems.map((li, liIdx) => (
                            <tr key={liIdx} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2 text-sm text-gray-900">{li.employeeName}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(li.hours).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-right">
                                {Number(li.overtimeHours) > 0
                                  ? <span className="text-orange-600">{Number(li.overtimeHours).toFixed(2)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(li.rate)}/hr</td>
                              <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(li.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50 rounded-xl">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No invoices to generate for this period.</p>
                <p className="text-xs text-gray-400 mt-1">All clients may already have invoices or have no approved time records.</p>
              </div>
            )}

            {/* Late OT warning */}
            {previewData?.preview?.some(item => item.lateOtRecords > 0) && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                  Some invoices include late-approved overtime from previous periods. These will be noted on the invoice line items.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setGenerateStep('params')}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setShowGenerateModal(false); setGenerateStep('params'); setPreviewData(null); setGenerateClientId('all'); }}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  icon={Play}
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={!previewData?.preview?.length}
                >
                  Confirm & Generate
                </Button>
              </div>
            </div>
          </div>
        )}
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
                          <td className="px-3 py-2">
                            <span className="text-sm text-gray-900">{item.employeeName}</span>
                            {item.notes && (
                              <p className="text-xs text-orange-500 mt-0.5">{item.notes}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.hours).toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{Number(item.overtimeHours || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(item.rate)}/hr</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{Number(selectedInvoice.totalHours).toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{Number(selectedInvoice.overtimeHours).toFixed(2)}</td>
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
              <Button
                variant="outline"
                size="sm"
                icon={downloadingTimesheetId === selectedInvoice.id ? Loader2 : FileText}
                onClick={() => handleDownloadTimesheetPdf(selectedInvoice.id, selectedInvoice.invoiceNumber)}
                disabled={downloadingTimesheetId === selectedInvoice.id}
              >
                Download Timesheet
              </Button>
              {selectedInvoice.status === 'DRAFT' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => { setDeleteInvoiceId(selectedInvoice.id); setShowDetailModal(false); }}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteInvoiceId}
        onClose={() => setDeleteInvoiceId(null)}
        title="Delete Draft Invoice"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium">Are you sure you want to delete this draft invoice?</p>
              <p className="text-sm text-gray-500 mt-1">This will release all associated time records so they can be re-invoiced. This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setDeleteInvoiceId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="!bg-red-600 hover:!bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Invoice'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Invoices;
