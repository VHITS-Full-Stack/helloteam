import { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, XCircle, Loader2, Search } from 'lucide-react';
import { Card, Badge } from '../../components/common';
import { formatTime12 } from '../../utils/formatTime';
import overtimeService from '../../services/overtime.service';

const statusConfig = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
};

const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const OvertimeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const params = {};
        if (filter !== 'all') params.status = filter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const response = await overtimeService.getOvertimeRequests(params);
        if (response.success) {
          setRequests(response.data?.requests || []);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Failed to fetch overtime requests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [filter, startDate, endDate]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getStatusIcon = (status) => {
    if (status === 'APPROVED') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'REJECTED') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Overtime Requests</h2>
        <p className="text-sm text-gray-500">View your overtime request history and status</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'PENDING', label: 'Pending' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search reason..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-40 h-8 pl-8 pr-3 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      {(() => {
        const filteredRequests = searchQuery.trim()
          ? requests.filter((r) => {
              const q = searchQuery.toLowerCase();
              return (r.reason || '').toLowerCase().includes(q)
                || (r.type || '').toLowerCase().includes(q)
                || (r.rejectionReason || '').toLowerCase().includes(q);
            })
          : requests;

        const totalPages = Math.ceil(filteredRequests.length / pageSize);
        const startIdx = (currentPage - 1) * pageSize;
        const paginatedRequests = filteredRequests.slice(startIdx, startIdx + pageSize);

        return loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No overtime requests found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter !== 'all' ? 'Try changing the filter' : 'Overtime requests will appear here when you work past your shift'}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRequests.map((req) => {
                  const cfg = statusConfig[req.status] || statusConfig.PENDING;
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{formatDate(req.date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">
                          {req.type === 'SHIFT_EXTENSION'
                            ? 'Shift Extension'
                            : req.type === 'EXTRA_TIME'
                            ? 'Extra Time'
                            : req.type === 'OFF_SHIFT'
                            ? 'Off-Shift'
                            : req.type || '—'}
                        </p>
                        {req.type === 'OFF_SHIFT' && req.requestedStartTime && req.requestedEndTime && (
                          <p className="text-xs text-gray-400">
                            {formatTime12(req.requestedStartTime)} – {formatTime12(req.requestedEndTime)}
                          </p>
                        )}
                        {req.isAutoGenerated && (
                          <p className="text-xs text-gray-400">Auto-generated</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-sm font-medium text-gray-900">{formatMinutes(req.requestedMinutes)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600 max-w-[200px] truncate" title={req.reason}>
                          {req.reason || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'REJECTED' && req.rejectionReason ? (
                          <p className="text-sm text-red-600 max-w-[200px] truncate" title={req.rejectionReason}>
                            {req.rejectionReason}
                          </p>
                        ) : req.status === 'APPROVED' && req.approvedAt ? (
                          <p className="text-xs text-green-600">
                            Approved {formatDate(req.approvedAt)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">Awaiting client review</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Showing {startIdx + 1}–{Math.min(startIdx + pageSize, filteredRequests.length)} of {filteredRequests.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      currentPage === page
                        ? 'bg-primary text-white'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      );
      })()}
    </div>
  );
};

export default OvertimeRequests;
