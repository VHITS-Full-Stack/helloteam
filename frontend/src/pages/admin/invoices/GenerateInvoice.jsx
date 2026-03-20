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
  X,
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
  const [clients, setClients] = useState([]);

  // Form params
  const [frequency, setFrequency] = useState('monthly');
  const [half, setHalf] = useState(1); // 1 = 1st-15th, 2 = 16th-end
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(() => {
    const m = new Date().getMonth();
    return m === 0 ? 12 : m;
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
  const [step, setStep] = useState('params');
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

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
    } else if (frequency === 'bi-weekly') {
      params.month = month;
      params.half = half;
    } else {
      params.month = month;
    }
    if (clientId !== 'all') {
      params.clientId = clientId;
    }
    return params;
  }, [year, frequency, week, month, half, clientId]);

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
    : frequency === 'bi-weekly'
      ? `${monthNames[month - 1]} ${half === 1 ? '1st–15th' : '16th–' + new Date(year, month, 0).getDate() + 'th'}, ${year}`
      : `Week ${week}, ${year}`;

  const selectClass = "appearance-none pr-8 w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white";
  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 'preview' ? setStep('params') : navigate('/admin/invoices')}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'params' ? 'Generate Invoices' : `Preview — ${periodLabel}`}
            </h2>
            <p className="text-sm text-gray-500">
              {step === 'params'
                ? 'Select parameters and preview before generating'
                : clientId !== 'all'
                  ? clients.find(c => c.id === clientId)?.companyName || 'Selected Client'
                  : 'All Clients'}
            </p>
          </div>
        </div>
        {step === 'preview' && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setStep('params'); setPreviewData(null); }}>
              Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              onClick={handleGenerate}
              loading={generating}
              disabled={!previewData?.preview?.length}
            >
              Generate {previewData?.preview?.length > 0 ? `(${previewData.preview.length})` : ''}
            </Button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {step === 'params' ? (
        /* ======================== STEP 1: PARAMETERS ======================== */
        <Card className="max-w-md">
          <div className="space-y-4">
            {/* Frequency Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {[
                  { key: 'monthly', label: 'Monthly' },
                  { key: 'bi-weekly', label: 'Bi-Weekly' },
                  { key: 'weekly', label: 'Weekly' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFrequency(f.key)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      frequency === f.key
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
              <div className="relative">
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={selectClass}>
                  <option value="all">All Clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Period */}
            <div className={`grid gap-3 ${frequency === 'bi-weekly' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {frequency === 'weekly' ? 'Week' : 'Month'}
                </label>
                {frequency === 'weekly' ? (
                  <input
                    type="number"
                    value={week}
                    onChange={(e) => setWeek(parseInt(e.target.value))}
                    className={inputClass}
                    min={1}
                    max={(() => {
                      const now = new Date();
                      if (year < now.getFullYear()) return 53;
                      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
                      const dayNum = d.getUTCDay() || 7;
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                    })()}
                  />
                ) : (
                  <div className="relative">
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={selectClass}>
                      {monthNames.map((name, i) => {
                        const m = i + 1;
                        const now = new Date();
                        if (year === now.getFullYear() && m > now.getMonth() + 1) return null;
                        return <option key={m} value={m}>{name}</option>;
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>
              {frequency === 'bi-weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Period</label>
                  <div className="relative">
                    <select value={half} onChange={(e) => setHalf(parseInt(e.target.value))} className={selectClass}>
                      <option value={1}>1st – 15th</option>
                      <option value={2}>16th – End</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                <div className="relative">
                  <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={selectClass}>
                    <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Existing invoices for the same period will be skipped.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/invoices')}>Cancel</Button>
              <Button variant="primary" size="sm" icon={Eye} onClick={handlePreview} loading={previewing}>
                Preview
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* ======================== STEP 2: PREVIEW ======================== */
        <div className="space-y-4">
          {/* Summary Stats */}
          {previewData?.summary && (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm text-blue-600">Clients</span>
                <span className="text-sm font-bold text-blue-700">{previewData.summary.clientCount}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-green-500" />
                <span className="text-sm text-green-600">Hours</span>
                <span className="text-sm font-bold text-green-700">{Number(previewData.summary.totalHours || 0).toFixed(2)}</span>
              </div>
              {Number(previewData.summary.totalOvertimeHours || 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-sm text-orange-600">OT</span>
                  <span className="text-sm font-bold text-orange-700">{Number(previewData.summary.totalOvertimeHours).toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                <DollarSign className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm text-purple-600">Est. Total</span>
                <span className="text-sm font-bold text-purple-700">{formatCurrency(previewData.summary.totalEstimatedAmount)}</span>
              </div>
            </div>
          )}

          {/* Late OT warning */}
          {previewData?.preview?.some(item => item.lateOtRecords > 0) && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">
                Some invoices include late-approved overtime from previous periods.
              </p>
            </div>
          )}

          {/* Per-client preview */}
          {previewData?.preview?.length > 0 ? (
            <div className="space-y-3">
              {previewData.preview.map((item, idx) => (
                <Card key={idx} padding="none" className="overflow-hidden">
                  {/* Client header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.clientName}</p>
                      <span className="text-xs text-gray-400">{item.invoiceNumber}</span>
                      {item.alreadyExists && (
                        <Badge variant="warning">Exists</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div className="hidden sm:block">
                        <span className="text-xs text-gray-400 mr-1">Emp:</span>
                        <span className="text-xs font-semibold text-gray-700">{item.employeeCount}</span>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-xs text-gray-400 mr-1">Hrs:</span>
                        <span className="text-xs font-semibold text-gray-700">{Number(item.totalHours).toFixed(2)}</span>
                      </div>
                      {Number(item.overtimeHours) > 0 && (
                        <div className="hidden sm:block">
                          <span className="text-xs text-orange-400 mr-1">OT:</span>
                          <span className="text-xs font-semibold text-orange-600">{Number(item.overtimeHours).toFixed(2)}</span>
                        </div>
                      )}
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(item.estimatedTotal, item.currency)}</p>
                    </div>
                  </div>

                  {/* Employee table */}
                  {item.lineItems?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Employee</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Hours</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">OT</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Rate</th>
                            <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Amount</th>
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
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
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
