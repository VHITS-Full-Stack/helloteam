import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
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
  ExportButton,
  RefreshButton,
} from '../../../components/common';
import invoiceService from '../../../services/invoice.service';
import clientService from '../../../services/client.service';
import { formatDate } from '../../../utils/formatDateTime';

const Invoices = () => {
  const navigate = useNavigate();
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedClient !== 'all') params.clientId = selectedClient;
      if (dateFrom && dateTo) {
        params.startDate = dateFrom;
        params.endDate = dateTo;
      } else if (filterYear !== 'all' && filterMonth !== 'all') {
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
    }
  }, [pagination.page, pagination.limit, selectedStatus, selectedClient, filterYear, filterMonth, dateFrom, dateTo]);

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
  }, [selectedStatus, selectedClient, filterYear, filterMonth, dateFrom, dateTo]);

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
  const [markPaidInvoiceId, setMarkPaidInvoiceId] = useState(null);
  const [markSentInvoiceId, setMarkSentInvoiceId] = useState(null);

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
      case 'PAID': return <Badge variant="success">Confirmed Paid</Badge>;
      case 'CLIENT_PAID': return <Badge variant="warning">Payment Received</Badge>;
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
          <ExportButton onClick={() => {
            if (!invoices.length) return;
            const headers = ['Invoice #', 'Client', 'Period', 'Hours', 'OT Hours', 'Amount', 'Status', 'Due Date'];
            const rows = invoices.map(inv => [
              inv.invoiceNumber,
              inv.client?.companyName || '',
              formatPeriod(inv.periodStart),
              Number(inv.totalHours || 0).toFixed(2),
              Number(inv.overtimeHours || 0).toFixed(2),
              formatCurrency(inv.total, inv.currency),
              inv.status,
              formatDate(inv.dueDate, { emptyValue: '—' }),
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
          }} />
          <RefreshButton onClick={fetchInvoices} />
          <Button variant="primary" size="sm" icon={Play} onClick={() => navigate('/admin/invoices/generate')}>
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
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-sm font-bold text-gray-900">{stats.total}</span>
        </div>
        {stats.draft > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-sm text-yellow-600">Drafts</span>
            <span className="text-sm font-bold text-yellow-700">{stats.draft}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
          <DollarSign className="w-3.5 h-3.5 text-green-500" />
          <span className="text-sm text-green-600">Paid</span>
          <span className="text-sm font-bold text-green-700">{formatCurrency(stats.paidAmount)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
          <DollarSign className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-sm text-blue-600">Total</span>
          <span className="text-sm font-bold text-blue-700">{formatCurrency(stats.totalAmount)}</span>
        </div>
      </div>

      {/* Invoice Table with Filters */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-gray-500">Loading invoices...</p>
        </div>
      ) : (
        <Card padding="none">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none pr-8 pl-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white"
              >
                <option value="all">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="CLIENT_PAID">Payment Received</option>
                <option value="PAID">Confirmed Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="appearance-none pr-8 pl-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white"
              >
                <option value="all">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterMonth}
                onChange={(e) => { setFilterMonth(e.target.value); setDateFrom(''); setDateTo(''); }}
                className="appearance-none pr-8 pl-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white"
              >
                <option value="all">All Months</option>
                {monthNames.map((name, i) => {
                  const m = i + 1;
                  const now = new Date();
                  if (filterYear !== 'all' && parseInt(filterYear) === now.getFullYear() && m > now.getMonth() + 1) return null;
                  return <option key={m} value={m}>{name}</option>;
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterYear}
                onChange={(e) => { setFilterYear(e.target.value); setDateFrom(''); setDateTo(''); }}
                className="appearance-none pr-8 pl-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white"
              >
                <option value="all">All Years</option>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setFilterYear('all'); setFilterMonth('all'); }}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setDateTo(e.target.value); setFilterYear('all'); setFilterMonth('all'); }}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No invoices found</p>
              <p className="text-sm text-gray-400 mt-1">Generate invoices for a past billing period to get started</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Period</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Hours</th>
                  {/* <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rate</th> */}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{invoice.client?.companyName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{formatPeriod(invoice.periodStart)}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <p className="text-sm text-gray-900">{Number(invoice.totalHours || 0).toFixed(2)}</p>
                      {Number(invoice.overtimeHours) > 0 && (
                        <p className="text-xs text-orange-500">+{Number(invoice.overtimeHours).toFixed(2)} OT</p>
                      )}
                    </td>
                    {/* <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(() => {
                        const rates = [...new Set((invoice.lineItems || []).map(li => Number(li.rate)))].filter(r => r > 0);
                        if (rates.length === 0) return <span className="text-sm text-gray-400">-</span>;
                        if (rates.length === 1) return <p className="text-sm text-gray-600">{formatCurrency(rates[0])}</p>;
                        return <p className="text-sm text-gray-600">{formatCurrency(Math.min(...rates))} - {formatCurrency(Math.max(...rates))}</p>;
                      })()}
                    </td> */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.total, invoice.currency)}</p>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">
                        {formatDate(invoice.dueDate, { emptyValue: '—' })}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">
                        {formatDate(invoice.createdAt, { emptyValue: '—' })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/invoices/${invoice.id}`)}
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
                              onClick={() => setMarkSentInvoiceId(invoice.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Mark as Sent to client"
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
                        {invoice.status === 'CLIENT_PAID' && (
                          <button
                            onClick={() => setMarkPaidInvoiceId(invoice.id)}
                            className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors animate-pulse"
                            title="Confirm Payment Received"
                            disabled={updatingId === invoice.id}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'SENT' && (
                          <button
                            onClick={() => setMarkPaidInvoiceId(invoice.id)}
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
          )}
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
                      {monthNames.map((name, i) => {
                        const m = i + 1;
                        const now = new Date();
                        if (generateYear === now.getFullYear() && m > now.getMonth() + 1) return null;
                        return <option key={m} value={m}>{name}</option>;
                      })}
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
                    min={new Date().getFullYear()}
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
                    min={new Date().getFullYear()}
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
                              <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(li.rate)}</td>
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
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(selectedInvoice.dueDate, { emptyValue: '—' })}
                </p>
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
                          <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatCurrency(item.rate)}</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{Number(selectedInvoice.totalHours).toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{Number(selectedInvoice.overtimeHours).toFixed(2)}</td>
                        <td className="px-3 py-2" />
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
                    onClick={() => { setMarkSentInvoiceId(selectedInvoice.id); setShowDetailModal(false); }}
                    loading={updatingId === selectedInvoice.id}
                  >
                    Mark as Sent to client
                  </Button>
                </>
              )}
              {selectedInvoice.status === 'CLIENT_PAID' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle}
                  onClick={() => { setMarkPaidInvoiceId(selectedInvoice.id); setShowDetailModal(false); }}
                  loading={updatingId === selectedInvoice.id}
                >
                  Confirm Payment
                </Button>
              )}
              {selectedInvoice.status === 'SENT' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle}
                  onClick={() => { setMarkPaidInvoiceId(selectedInvoice.id); setShowDetailModal(false); }}
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

      {/* Mark as Sent Confirmation Modal */}
      <Modal
        isOpen={!!markSentInvoiceId}
        onClose={() => setMarkSentInvoiceId(null)}
        title="Send Invoice to Client"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium">Are you sure you want to send this invoice to the client?</p>
              <p className="text-sm text-gray-500 mt-1">The client will be notified via email and the invoice status will be updated to Sent.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setMarkSentInvoiceId(null)} disabled={updatingId === markSentInvoiceId}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Send}
              onClick={async () => {
                await handleStatusUpdate(markSentInvoiceId, 'SENT');
                setMarkSentInvoiceId(null);
              }}
              loading={updatingId === markSentInvoiceId}
            >
              Send Invoice
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Paid Confirmation Modal */}
      <Modal
        isOpen={!!markPaidInvoiceId}
        onClose={() => setMarkPaidInvoiceId(null)}
        title="Mark Invoice as Paid"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium">Are you sure you want to mark this invoice as paid?</p>
              <p className="text-sm text-gray-500 mt-1">This will update the invoice status to Paid. This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setMarkPaidInvoiceId(null)} disabled={updatingId === markPaidInvoiceId}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle}
              onClick={async () => {
                await handleStatusUpdate(markPaidInvoiceId, 'PAID');
                setMarkPaidInvoiceId(null);
              }}
              loading={updatingId === markPaidInvoiceId}
            >
              Confirm Paid
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Invoices;
