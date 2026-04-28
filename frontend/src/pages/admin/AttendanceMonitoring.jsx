import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  Bell,
  MessageSquare,
  Building2,
  RefreshCw,
  MoreVertical,
  X,
  Phone,
  UtensilsCrossed,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
  Table,
  RefreshButton,
} from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';
import clientService from '../../services/client.service';

const AttendanceMonitoring = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [lunchOverdue, setLunchOverdue] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [toasts, setToasts] = useState([]);
  
  const refreshInterval = useRef(null);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchData = useCallback(async (isAuto = false) => {
    try {
      if (!isAuto) setLoading(true);
      const response = await adminPortalService.getRealTimeAttendanceMonitoring({ clientId });
      if (response.success) {
        setData(response.data);
        setLunchOverdue(response.lunchOverdue || []);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data', err);
    } finally {
      if (!isAuto) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(() => {
        fetchData(true);
      }, 30000); // Refresh every 30 seconds
    } else {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    }
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await clientService.getClients({ limit: 100 });
        if (response.success) {
          setClients(response.data.clients);
        }
      } catch (err) {
        console.error('Failed to fetch clients', err);
      }
    };
    fetchClients();
  }, []);

  const handleNotify = (employee) => {
    showToast(`Notification sent to ${employee.employeeName}`);
  };

  const handleMarkContacted = (employee) => {
    showToast(`Marked ${employee.employeeName} as contacted`);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notifications */}
      <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className="animate-slide-up pointer-events-auto bg-gray-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-800"
          >
            {t.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
            <span className="text-sm font-bold tracking-tight">{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))}>
              <X className="w-4 h-4 text-gray-500 hover:text-white" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading flex items-center gap-2">
            Real-Time Attendance Monitoring
            <Badge variant="danger" className="animate-pulse">LIVE</Badge>
          </h1>
          <p className="text-gray-500 mt-1">
            Employees who should be clocked in right now but are missing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
            Auto-refresh: 
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`font-bold transition-colors ${autoRefresh ? 'text-primary' : 'text-gray-400'}`}
            >
              {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Last update: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <RefreshButton 
            onClick={() => fetchData()}
            loading={loading && !autoRefresh}
          />
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-50/50 border-dashed">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter by Client</label>
            <div className="relative">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary appearance-none transition-all"
              >
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="flex-shrink-0 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="text-center px-4 border-r border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Missing Now</p>
              <p className="text-xl font-bold text-red-600">{data.length}</p>
            </div>
            <div className="text-center px-4 border-r border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lunch Overdue</p>
              <p className="text-xl font-bold text-amber-600">{lunchOverdue.length}</p>
            </div>
            <div className="flex items-center gap-2 pr-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <p className="text-xs text-gray-500 max-w-[150px] leading-tight">
                Employees are removed automatically once they resolve their break.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card padding="none" className="overflow-hidden shadow-xl ring-1 ring-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Schedule Info</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sub-State</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && data.length === 0 && lunchOverdue.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto" />
                    <p className="mt-4 text-gray-500 font-medium tracking-tight">Scanning schedules...</p>
                  </td>
                </tr>
              ) : data.length === 0 && lunchOverdue.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-24 text-center">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">All Clear!</h3>
                    <p className="text-gray-500 mt-1">Everyone is clocked in and all lunch breaks are on time.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Lunch Overdue rows — shown first as they need immediate attention */}
                  {lunchOverdue.map((row) => {
                    const lunchEndTime = new Date(row.scheduledLunchEnd).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    const subStateColor =
                      row.lunchSubState === 'Time Entry Required' ? 'bg-red-100 text-red-700' :
                      row.lunchSubState === 'Unauthorized' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700';
                    return (
                      <tr key={`lunch-${row.employeeId}`} className="group hover:bg-amber-50/40 transition-colors bg-amber-50/20">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Avatar name={row.employeeName} size="sm" className="ring-2 ring-amber-200 shadow-sm" />
                            <div>
                              <p className="text-sm font-bold text-gray-900">{row.employeeName}</p>
                              <p className="text-[10px] text-gray-400 uppercase tracking-tighter">ID: {row.employeeId.slice(-8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            {row.clientName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-gray-900">Lunch should end: {lunchEndTime}</p>
                            <p className="text-[10px] text-amber-600 uppercase font-bold">{row.minutesPast} min past scheduled end</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 w-fit">
                            <UtensilsCrossed className="w-3 h-3" /> In Lunch Break - Past Schedule
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold w-fit ${subStateColor}`}>
                            {row.lunchSubState}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleMarkContacted(row)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-all"
                              title="Mark as Contacted"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleNotify(row)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-all"
                              title="Send Message"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Missing / not clocked in rows */}
                  {data.map((row) => (
                    <tr key={row.employeeId} className="group hover:bg-red-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.employeeName} size="sm" className="ring-2 ring-white shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{row.employeeName}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">ID: {row.employeeId.slice(-8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {row.clientName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-gray-900">{row.scheduledStart} – {row.scheduledEnd}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Shift Start Passed</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 w-fit">
                          <AlertCircle className="w-3 h-3" /> Not Clocked In
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600 w-fit">
                          {row.overdueMinutes} min overdue
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleMarkContacted(row)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-all"
                            title="Mark as Contacted"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleNotify(row)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-all"
                            title="Send Message"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="ml-2 shadow-lg shadow-primary/20"
                            onClick={() => handleNotify(row)}
                          >
                            Remind
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] py-4">
        Automated for Hello Team Internal Attendance Monitoring
      </p>
    </div>
  );
};

export default AttendanceMonitoring;
