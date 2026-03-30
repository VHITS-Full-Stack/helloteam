import { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, Badge } from '../../components/common';
import overtimeService from '../../services/overtime.service';

const statusConfig = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
};

const OvertimeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const params = {};
        if (filter !== 'all') params.status = filter;
        const response = await overtimeService.getOvertimeRequests(params);
        if (response.success) {
          setRequests(response.data?.requests || []);
        }
      } catch (err) {
        console.error('Failed to fetch overtime requests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [filter]);

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

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: 'All' },
          { key: 'PENDING', label: 'Pending' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'REJECTED', label: 'Rejected' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === f.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
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
                {requests.map((req) => {
                  const cfg = statusConfig[req.status] || statusConfig.PENDING;
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{formatDate(req.date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">
                          {req.type === 'SHIFT_EXTENSION' ? 'Shift Extension' : req.type === 'EXTRA_TIME' ? 'Extra Time' : req.type || '—'}
                        </p>
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
                          {getStatusIcon(req.status)}
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
        </Card>
      )}
    </div>
  );
};

export default OvertimeRequests;
