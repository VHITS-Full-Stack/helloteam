import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common';
import api from '../../services/api';

const formatTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusBadge = (status) => {
  if (status === 'ADMIN_ADJUSTED') return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">Reviewed</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">Needs Review</span>;
};

export default function LunchBreakReview() {
  const [activeTab, setActiveTab] = useState('auto-closed');
  const [breaks, setBreaks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });

  // Auto-Closed tab: adjust modal
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ paidMinutes: '', unpaidMinutes: '', notes: '' });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Auto-Approved tab: expand explanation inline
  const [expandedExplanation, setExpandedExplanation] = useState(null);

  const fetchBreaks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin-portal/lunch-breaks/review?date=${date}&tab=${activeTab}`);
      if (res.success) {
        setBreaks(res.data);
        setTotal(res.total);
      } else {
        setError(res.error || 'Failed to load review queue');
      }
    } catch (err) {
      setError(err.message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [date, activeTab]);

  useEffect(() => { fetchBreaks(); }, [fetchBreaks]);

  const openAdjust = (b) => {
    setAdjusting(b.id);
    setAdjustForm({ paidMinutes: b.paidMinutes, unpaidMinutes: b.unpaidMinutes, notes: '' });
    setAdjustError('');
  };

  const submitAdjust = async () => {
    setAdjustSubmitting(true);
    setAdjustError('');
    try {
      const res = await api.patch(`/admin-portal/lunch-breaks/${adjusting}/adjust`, {
        paidMinutes: parseInt(adjustForm.paidMinutes) || 0,
        unpaidMinutes: parseInt(adjustForm.unpaidMinutes) || 0,
        notes: adjustForm.notes,
      });
      if (res.success) {
        setAdjusting(null);
        fetchBreaks();
      } else {
        setAdjustError(res.error || 'Failed to save adjustment');
      }
    } catch (err) {
      setAdjustError(err.message || 'Failed to save adjustment');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const tabs = [
    { id: 'auto-closed', label: 'Auto-Closed' },
    { id: 'auto-approved', label: 'Auto-Approved' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lunch Break Review</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeTab === 'auto-closed'
              ? 'Lunch breaks that were auto-closed because the employee never pressed End Lunch Break'
              : 'Lunch breaks where the employee claimed they were working and got auto-approved'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors rounded-t-lg -mb-px border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Auto-Closed Tab */}
      {activeTab === 'auto-closed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-500" />
              Auto-Closed Lunch Breaks — {formatDate(date)}
              <span className="ml-2 text-sm font-normal text-gray-500">({total} record{total !== 1 ? 's' : ''})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : breaks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
                <p className="font-medium text-gray-500">No auto-closed lunch breaks for this date</p>
                <p className="text-sm mt-1">All employees resolved their lunch breaks normally.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Employee</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Client</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Lunch Start</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Lunch End</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Scheduled</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Paid</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Unpaid</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {breaks.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{b.employeeName}</p>
                          <p className="text-xs text-gray-400">{b.employeeEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{b.clientName}</td>
                        <td className="py-3 px-4 text-gray-700">{formatTime(b.startTime)}</td>
                        <td className="py-3 px-4 text-gray-700">{formatTime(b.endTime)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{b.scheduledDurationMinutes} min</td>
                        <td className="py-3 px-4 text-right text-green-700 font-medium">{b.paidMinutes} min</td>
                        <td className="py-3 px-4 text-right text-red-600 font-medium">{b.unpaidMinutes} min</td>
                        <td className="py-3 px-4">{statusBadge(b.lunchStatus)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openAdjust(b)}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium border border-primary-200 hover:border-primary-400 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto-Approved Tab */}
      {activeTab === 'auto-approved' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Auto-Approved "I Was Working" Submissions — {formatDate(date)}
              <span className="ml-2 text-sm font-normal text-gray-500">({total} record{total !== 1 ? 's' : ''})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : breaks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
                <p className="font-medium text-gray-500">No auto-approved submissions for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Employee</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Client</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Lunch Start</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Lunch End</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Scheduled</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Paid (total)</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Explanation</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Screenshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {breaks.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{b.employeeName}</p>
                          <p className="text-xs text-gray-400">{b.employeeEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{b.clientName}</td>
                        <td className="py-3 px-4 text-gray-700">{formatTime(b.startTime)}</td>
                        <td className="py-3 px-4 text-gray-700">{formatTime(b.endTime)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{b.scheduledDurationMinutes} min</td>
                        <td className="py-3 px-4 text-right text-green-700 font-medium">{b.paidMinutes} min</td>
                        <td className="py-3 px-4 max-w-xs">
                          {b.wasWorkingExplanation ? (
                            <div>
                              <p className={`text-gray-700 text-xs ${expandedExplanation === b.id ? '' : 'line-clamp-2'}`}>
                                {b.wasWorkingExplanation}
                              </p>
                              {b.wasWorkingExplanation.length > 80 && (
                                <button
                                  onClick={() => setExpandedExplanation(expandedExplanation === b.id ? null : b.id)}
                                  className="text-primary-500 text-xs mt-1 flex items-center gap-0.5"
                                >
                                  {expandedExplanation === b.id ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> More</>}
                                </button>
                              )}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          {b.wasWorkingScreenshotUrl ? (
                            <a
                              href={b.wasWorkingScreenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Adjust Modal (Auto-Closed tab only) */}
      {adjusting && (() => {
        const b = breaks.find((x) => x.id === adjusting);
        if (!b) return null;
        const totalMins = b.durationMinutes;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Adjust Lunch Break Record</h2>
                <p className="text-sm text-gray-500 mt-0.5">{b.employeeName} · {formatDate(b.startTime)}</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  Total break duration: <strong>{totalMins} min</strong>
                  {' '}({formatTime(b.startTime)} → {formatTime(b.endTime)}).
                  Scheduled: <strong>{b.scheduledDurationMinutes} min</strong>.
                  Paid + Unpaid must not exceed {totalMins} min.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max={totalMins}
                      value={adjustForm.paidMinutes}
                      onChange={(e) => setAdjustForm({ ...adjustForm, paidMinutes: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unpaid Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max={totalMins}
                      value={adjustForm.unpaidMinutes}
                      onChange={(e) => setAdjustForm({ ...adjustForm, unpaidMinutes: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note (optional)</label>
                  <textarea
                    rows={2}
                    value={adjustForm.notes}
                    onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                    placeholder="e.g. Employee reported internet outage"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  />
                </div>
                {adjustError && <p className="text-red-600 text-sm">{adjustError}</p>}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={submitAdjust}
                  disabled={adjustSubmitting}
                  className="flex-1 bg-primary hover:bg-primary-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Saving…' : 'Save Adjustment'}
                </button>
                <button
                  onClick={() => setAdjusting(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
