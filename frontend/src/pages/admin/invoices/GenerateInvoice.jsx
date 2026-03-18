import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Play,
  ArrowLeft,
  ChevronDown,
  Users,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
} from '../../../components/common';
import invoiceService from '../../../services/invoice.service';
import clientService from '../../../services/client.service';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);
};

const GenerateInvoice = () => {
  const navigate = useNavigate();

  // Clients
  const [clients, setClients] = useState([]);

  // Form params
  const [frequency, setFrequency] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(() => {
    const m = new Date().getMonth(); // 0-indexed
    return m === 0 ? 12 : m; // Default to previous month
  });
  const [week, setWeek] = useState(() => {
    const now = new Date();
    const prevWeek = new Date(now);
    prevWeek.setDate(now.getDate() - 7);
    const d = new Date(Date.UTC(prevWeek.getFullYear(), prevWeek.getMonth(), prevWeek.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  });
  const [clientId, setClientId] = useState('all');

  // State
  const [step, setStep] = useState('params'); // 'params' | 'preview'
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await clientService.getClients({ limit: 100 });
        if (res.success) setClients(res.data.clients || []);
      } catch (err) {
        console.error('Failed to fetch clients:', err);
      }
    };
    fetchClients();
  }, []);

  const getParams = useCallback(() => {
    const params = { year, frequency };
    if (frequency === 'weekly') {
      params.week = week;
    } else {
      params.month = month;
    }
    if (clientId !== 'all') {
      params.clientId = clientId;
    }
    return params;
  }, [year, frequency, week, month, clientId]);

  const handlePreview = async () => {
    setPreviewing(true);
    setError('');
    try {
      const response = await invoiceService.previewInvoices(getParams());
      if (response.success) {
        setPreviewData(response.data);
        setStep('preview');
      } else {
        setError(response.error || 'Failed to preview invoices');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to preview invoices');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await invoiceService.generateInvoices(getParams());
      if (response.success) {
        navigate('/admin/invoices');
      } else {
        setError(response.error || 'Failed to generate invoices');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const periodLabel = frequency === 'monthly'
    ? `${monthNames[month - 1]} ${year}`
    : `Week ${week}, ${year}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/admin/invoices')} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Generate Invoices</h2>
          <p className="text-gray-500 text-sm">Preview and generate invoices for your clients</p>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {step === 'params' ? (
        /* ======================== STEP 1: PARAMETERS ======================== */
        <Card>
          <div className="space-y-5 max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900">Invoice Parameters</h3>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <div className="relative">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="appearance-none pr-9 w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Client */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <div className="relative">
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
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

            {/* Period */}
            {frequency === 'monthly' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <div className="relative">
                    <select
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
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
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
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
                    value={week}
                    onChange={(e) => setWeek(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    min={1}
                    max={53}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    min={2020}
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">
              {clientId !== 'all'
                ? 'Invoice will be generated for the selected client only. Existing invoices for the same period will be skipped.'
                : frequency === 'monthly'
                  ? 'Monthly invoices will be generated for all active clients. Existing invoices for the same period will be skipped.'
                  : 'Weekly invoices will be generated for all active clients (Mon-Sun period). Existing invoices will be skipped.'
              }
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => navigate('/admin/invoices')}>Cancel</Button>
              <Button variant="primary" icon={Eye} onClick={handlePreview} loading={previewing}>
                Preview Invoices
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* ======================== STEP 2: PREVIEW ======================== */
        <div className="space-y-6">
          {/* Period info bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('params')} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Preview — {periodLabel}</h3>
                <p className="text-sm text-gray-500">
                  {clientId !== 'all'
                    ? clients.find(c => c.id === clientId)?.companyName || 'Selected Client'
                    : 'All Clients'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setStep('params'); setPreviewData(null); }}>
                Change Parameters
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

          {/* Summary Stats */}
          {previewData?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{previewData.summary.clientCount}</p>
                    <p className="text-xs text-gray-500">Clients</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{Number(previewData.summary.totalHours || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Total Hours</p>
                  </div>
                </div>
              </Card>
              {Number(previewData.summary.totalOvertimeHours || 0) > 0 && (
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{Number(previewData.summary.totalOvertimeHours).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Overtime Hours</p>
                    </div>
                  </div>
                </Card>
              )}
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(previewData.summary.totalEstimatedAmount)}</p>
                    <p className="text-xs text-gray-500">Est. Total</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Late OT warning */}
          {previewData?.preview?.some(item => item.lateOtRecords > 0) && (
            <div className="flex items-start gap-2 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700">
                Some invoices include late-approved overtime from previous periods. These will be noted on the invoice line items.
              </p>
            </div>
          )}

          {/* Per-client preview cards */}
          {previewData?.preview?.length > 0 ? (
            <div className="space-y-4">
              {previewData.preview.map((item, idx) => (
                <Card key={idx} className="overflow-hidden !p-0">
                  {/* Client header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{item.clientName}</p>
                        {item.alreadyExists && (
                          <Badge variant="warning">Already Generated</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{item.invoiceNumber}</p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-400">Employees</p>
                        <p className="text-sm font-semibold text-gray-900">{item.employeeCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Hours</p>
                        <p className="text-sm font-semibold text-gray-900">{Number(item.totalHours).toFixed(2)}</p>
                      </div>
                      {Number(item.overtimeHours) > 0 && (
                        <div>
                          <p className="text-xs text-orange-400">OT Hours</p>
                          <p className="text-sm font-semibold text-orange-600">{Number(item.overtimeHours).toFixed(2)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400">Rate</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.rates?.length === 1
                            ? `${formatCurrency(item.rates[0])}/hr`
                            : item.rates?.length > 1
                              ? `${formatCurrency(Math.min(...item.rates))} - ${formatCurrency(Math.max(...item.rates))}/hr`
                              : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Est. Amount</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(item.estimatedTotal, item.currency)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Employee line items table */}
                  {item.lineItems?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-white">
                            <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Hours</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">OT Hours</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">OT Rate</th>
                            <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {item.lineItems.map((li, liIdx) => (
                            <tr key={liIdx} className="hover:bg-gray-50/50">
                              <td className="px-6 py-3 text-sm font-medium text-gray-900">{li.employeeName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{Number(li.hours).toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right">
                                {Number(li.overtimeHours) > 0
                                  ? <span className="text-orange-600 font-medium">{Number(li.overtimeHours).toFixed(2)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(li.rate)}/hr</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {Number(li.overtimeHours) > 0
                                  ? `${formatCurrency(li.overtimeRate)}/hr`
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(li.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-gray-50">
                            <td className="px-6 py-2.5 text-sm font-semibold text-gray-700">Total</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-700 text-right">{Number(item.totalHours).toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-orange-600 text-right">
                              {Number(item.overtimeHours) > 0 ? Number(item.overtimeHours).toFixed(2) : '—'}
                            </td>
                            <td colSpan={2}></td>
                            <td className="px-6 py-2.5 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.estimatedTotal, item.currency)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="p-10 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No invoices to generate for this period.</p>
                <p className="text-sm text-gray-400 mt-1">All clients may already have invoices or have no approved time records.</p>
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  );
};

export default GenerateInvoice;
