import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, AlertCircle, ExternalLink, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
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
  if (status === 'ADMIN_ADJUSTED') return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">Reviewed</span>;
  if (status === 'AUTO_CLOSED') return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Auto-Closed</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">{status ?? 'Unknown'}</span>;
};

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function LunchBreakReview() {
  const [activeTab, setActiveTab] = useState('auto-closed');
  const [breaks, setBreaks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'needs-review' | 'reviewed'

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setDate(todayLocal());
    setStatusFilter('all');
    setBreaks([]);
  };

  // Auto-Closed tab: adjust modal
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ paidMinutes: '', unpaidMinutes: '', notes: '', markAsReviewed: false });
  const [adjustOriginal, setAdjustOriginal] = useState({ paidMinutes: 0, unpaidMinutes: 0 });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Auto-Approved / Needs Approval: expand explanation inline
  const [expandedExplanation, setExpandedExplanation] = useState(null);

  // Needs Approval tab: approve/deny modal
  const [reviewingBreak, setReviewingBreak] = useState(null); // { break, action: 'approve'|'deny' }
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const fetchBreaks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ tab: activeTab });
      if (date) params.set('date', date);
      if (activeTab === 'auto-closed' && statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/admin-portal/lunch-breaks/review?${params.toString()}`);
      if (res.success) {
        const responseData = res.data || {};
        const breaksArray = Array.isArray(responseData) ? responseData : (responseData.breaks || []);
        setBreaks(breaksArray);
        setTotal(responseData.total || res.total || 0);
      } else {
        setError(res.error || 'Failed to load review queue');
        setBreaks([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load review queue');
      setBreaks([]);
    } finally {
      setLoading(false);
    }
  }, [date, activeTab, statusFilter]);

  useEffect(() => { fetchBreaks(); }, [fetchBreaks]);

  const openAdjust = (b) => {
    setAdjusting(b.id);
    setAdjustOriginal({ paidMinutes: b.paidMinutes, unpaidMinutes: b.unpaidMinutes });
    setAdjustForm({ paidMinutes: b.paidMinutes, unpaidMinutes: b.unpaidMinutes, notes: '', markAsReviewed: b.lunchStatus === 'ADMIN_ADJUSTED' });
    setAdjustError('');
  };

  const submitAdjust = async () => {
    setAdjustSubmitting(true);
    setAdjustError('');
    try {
      const newPaid = parseInt(adjustForm.paidMinutes) || 0;
      const newUnpaid = parseInt(adjustForm.unpaidMinutes) || 0;
      const valuesChanged = newPaid !== adjustOriginal.paidMinutes || newUnpaid !== adjustOriginal.unpaidMinutes;
      const res = await api.patch(`/admin-portal/lunch-breaks/${adjusting}/adjust`, {
        paidMinutes: newPaid,
        unpaidMinutes: newUnpaid,
        notes: adjustForm.notes,
        markAsReviewed: adjustForm.markAsReviewed || valuesChanged,
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

  const openReview = (b, action) => {
    setReviewingBreak({ break: b, action });
    setReviewNotes('');
    setReviewError('');
  };

  const submitReview = async () => {
    if (!reviewingBreak) return;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const { break: b, action } = reviewingBreak;
      const res = await api.post(`/admin-portal/lunch-breaks/${b.id}/${action}`, { notes: reviewNotes });
      if (res.success) {
        setReviewingBreak(null);
        fetchBreaks();
      } else {
        setReviewError(res.error || `Failed to ${action}`);
      }
    } catch (err) {
      setReviewError(err.message || `Failed to ${reviewingBreak.action}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const tabs = [
    { id: 'auto-closed', label: 'Auto-Closed' },
    { id: 'auto-approved', label: 'Auto-Approved' },
    { id: 'needs-approval', label: 'Needs Approval' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lunch Break Review</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeTab === 'auto-closed'
              ? 'Lunch breaks that were auto-closed because the employee never pressed End Lunch Break'
              : activeTab === 'auto-approved'
                ? 'Lunch breaks where the employee claimed they were working and got auto-approved'
                : 'Submissions pending Hello Team admin review — timesheet cannot be finalised until resolved'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'auto-closed' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
            >
              <option value="all">All status</option>
              <option value="needs-review">Needs Review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
          {date && (
            <button
              onClick={() => setDate('')}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
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
              Auto-Closed Lunch Breaks — {date ? formatDate(date) : 'All Dates'}
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
                <p className="font-medium text-gray-500">No auto-closed lunch breaks{date ? ' for this date' : ''}</p>
                <p className="text-sm mt-1">All employees resolved their lunch breaks normally.</p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Employee</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Client</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">Lunch Start</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">Lunch End</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Scheduled</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Paid</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Unpaid</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">Admin Note</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {breaks.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900 whitespace-nowrap">{b.employeeName}</p>
                          <p className="text-xs text-gray-400 whitespace-nowrap">{b.employeeEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{b.clientName}</td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{formatTime(b.startTime)}</td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{formatTime(b.endTime)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{b.scheduledDurationMinutes} min</td>
                        <td className="py-3 px-4 text-right text-green-700 font-medium whitespace-nowrap">{b.paidMinutes} min</td>
                        <td className="py-3 px-4 text-right text-red-600 font-medium">{b.unpaidMinutes} min</td>
                        <td className="py-3 px-4">{statusBadge(b.lunchStatus)}</td>
                        <td className="py-3 px-4 max-w-[180px]">
                          {b.adminNotes
                            ? <p className="text-xs text-gray-600 line-clamp-2" title={b.adminNotes}>{b.adminNotes}</p>
                            : <span className="text-gray-300">—</span>}
                        </td>
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
              Auto-Approved "I Was Working" Submissions — {date ? formatDate(date) : 'All Dates'}
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
                <p className="font-medium text-gray-500">No auto-approved submissions{date ? ' for this date' : ''}</p>
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
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Admin Note</th>
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
                        <td className="py-3 px-4 max-w-[180px]">
                          {b.adminNotes
                            ? <p className="text-xs text-gray-600 line-clamp-2" title={b.adminNotes}>{b.adminNotes}</p>
                            : <span className="text-gray-300">—</span>}
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

      {/* Needs Approval Tab */}
      {activeTab === 'needs-approval' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Pending Admin Review
              <span className="ml-2 text-sm font-normal text-gray-500">({total} record{total !== 1 ? 's' : ''})</span>
              {!date && <span className="ml-1 text-xs text-gray-400 font-normal">— all time</span>}
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
                <p className="font-medium text-gray-500">No pending submissions</p>
                <p className="text-sm mt-1">All late lunch bypass submissions have been resolved.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Employee</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Client</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Lunch Start</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Lunch End</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Scheduled</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Late</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Explanation</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Screenshot</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Admin Note</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {breaks.map((b) => (
                      <tr key={b.id} className="hover:bg-amber-50/40">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{b.employeeName}</p>
                          <p className="text-xs text-gray-400">{b.employeeEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{b.clientName}</td>
                        <td className="py-3 px-4 text-gray-700">{formatDate(b.startTime)}</td>
                        <td className="py-3 px-4 text-gray-700">{formatTime(b.startTime)}</td>
                        <td className="py-3 px-4 text-gray-700">{formatTime(b.endTime)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{b.scheduledDurationMinutes} min</td>
                        <td className="py-3 px-4 text-right">
                          {b.resumeTime ? (() => {
                            const scheduledEnd = new Date(new Date(b.startTime).getTime() + b.scheduledDurationMinutes * 60000);
                            const resumeDate = new Date(b.resumeTime);
                            const endDate = new Date(b.endTime);
                            const gapMin = Math.max(0, Math.round((resumeDate - scheduledEnd) / 60000));
                            const lateWorkMin = Math.max(0, Math.round((endDate - resumeDate) / 60000));
                            return (
                              <div className="text-right text-xs space-y-0.5">
                                <p className="text-red-500">{gapMin} min unpaid gap</p>
                                <p className="text-amber-600 font-medium">{lateWorkMin} min claimed work</p>
                                <p className="text-gray-400">resume: {formatTime(b.resumeTime)}</p>
                              </div>
                            );
                          })() : (
                            <span className="text-amber-600 font-medium">{b.unpaidMinutes} min</span>
                          )}
                        </td>
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
                        <td className="py-3 px-4 max-w-[180px]">
                          {b.adminNotes
                            ? <p className="text-xs text-gray-600 line-clamp-2" title={b.adminNotes}>{b.adminNotes}</p>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => openReview(b, 'approve')}
                              className="text-xs text-green-700 hover:text-green-900 font-medium border border-green-200 hover:border-green-400 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openReview(b, 'deny')}
                              className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              Deny
                            </button>
                          </div>
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

      {/* Approve/Deny Confirmation Modal */}
      {reviewingBreak && (() => {
        const { break: b, action } = reviewingBreak;
        const isApprove = action === 'approve';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              <div className={`px-6 py-4 border-b border-gray-100 rounded-t-xl ${isApprove ? 'bg-green-50' : 'bg-red-50'}`}>
                <h2 className="font-semibold text-gray-900">
                  {isApprove ? 'Approve Lunch Bypass' : 'Deny Lunch Bypass'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">{b.employeeName} · {formatDate(b.startTime)}</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className={`rounded-lg p-3 text-sm ${isApprove ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {b.resumeTime ? (() => {
                    const scheduledEnd = new Date(new Date(b.startTime).getTime() + b.scheduledDurationMinutes * 60000);
                    const resumeDate = new Date(b.resumeTime);
                    const endDate = new Date(b.endTime);
                    const gapMin = Math.max(0, Math.round((resumeDate - scheduledEnd) / 60000));
                    const lateWorkMin = Math.max(0, Math.round((endDate - resumeDate) / 60000));
                    return isApprove
                      ? <><strong>{b.scheduledDurationMinutes} min</strong> paid lunch + <strong>{lateWorkMin} min</strong> claimed work → reclassified as paid hours. Gap ({gapMin} min, {formatTime(scheduledEnd.toISOString())}–{formatTime(b.resumeTime)}) stays unpaid.</>
                      : <><strong>{lateWorkMin} min</strong> of claimed work is denied — becomes Unpaid Break. Gap ({gapMin} min) is already unpaid. Only the scheduled {b.scheduledDurationMinutes} min lunch is paid.</>;
                  })() : isApprove
                    ? <>All <strong>{b.durationMinutes} min</strong> will be reclassified as worked hours (paid, billable). Scheduled: {b.scheduledDurationMinutes} min + {b.unpaidMinutes} min late time.</>
                    : <>The <strong>{b.unpaidMinutes} min</strong> of late time will remain as Unpaid Break. Only the scheduled {b.scheduledDurationMinutes} min will be paid.</>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note (optional)</label>
                  <textarea
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={isApprove ? 'e.g. Screenshot verified, clock and work app visible' : 'e.g. Screenshot did not show required proof'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  />
                </div>
                {reviewError && <p className="text-red-600 text-sm">{reviewError}</p>}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={submitReview}
                  disabled={reviewSubmitting}
                  className={`flex-1 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {reviewSubmitting ? 'Saving…' : isApprove ? 'Confirm Approve' : 'Confirm Deny'}
                </button>
                <button
                  onClick={() => setReviewingBreak(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={adjustForm.markAsReviewed}
                    onChange={(e) => setAdjustForm({ ...adjustForm, markAsReviewed: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Mark as reviewed</span>
                  <span className="text-xs text-gray-400">(auto-checked when you change the values)</span>
                </label>
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
