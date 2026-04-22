import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Clock,
  Calendar,
  Search,
  Filter,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Building2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock3,
  MoreVertical,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
  StatCard,
  Table,
  RefreshButton,
} from '../../components/common';
import adminPortalService from '../../services/adminPortal.service';
import clientService from '../../services/client.service';

const RELIABILITY_TIERS = {
  'On Time': { color: 'success', label: 'On Time', icon: CheckCircle, bg: 'bg-green-50', text: 'text-green-700' },
  'Occasionally Late': { color: 'warning', label: 'Occasionally Late', icon: Clock, bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'Frequently Late': { color: 'orange', label: 'Frequently Late', icon: Clock3, bg: 'bg-orange-50', text: 'text-orange-700' },
  'Chronic Issue': { color: 'danger', label: 'Chronic Issue', icon: XCircle, bg: 'bg-red-50', text: 'text-red-700' },
};

const PunctualityAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    clientId: '',
    reliabilityLabel: 'all',
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Drill-down
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'reliabilityLabel', direction: 'desc' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminPortalService.getPunctualityAnalytics(filters);
      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleRowClick = async (employee) => {
    setSelectedEmployee(employee);
    setDetailsLoading(true);
    try {
      const response = await adminPortalService.getEmployeePunctualityDetails(employee.employeeId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      if (response.success) {
        setEmployeeDetails(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch employee details', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    // Special handling for reliability label order
    if (sortConfig.key === 'reliabilityLabel') {
      const order = ['On Time', 'Occasionally Late', 'Frequently Late', 'Chronic Issue'];
      aVal = order.indexOf(a.reliabilityLabel);
      bVal = order.indexOf(b.reliabilityLabel);
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getReliabilityBadge = (label) => {
    const tier = RELIABILITY_TIERS[label] || RELIABILITY_TIERS['On Time'];
    const Icon = tier.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${tier.bg} ${tier.text} border border-current/10 shadow-sm`}>
        <Icon className="w-3.5 h-3.5" />
        {tier.label}
      </span>
    );
  };

  // Stats calculation
  const stats = {
    chronic: data.filter(r => r.reliabilityLabel === 'Chronic Issue').length,
    frequent: data.filter(r => r.reliabilityLabel === 'Frequently Late').length,
    avgLate: data.length > 0 ? Math.round(data.reduce((acc, r) => acc + r.avgMinutesLate, 0) / data.length) : 0,
    totalEmployees: data.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Punctuality Analytics</h1>
          <p className="text-gray-500 mt-1">Track employee attendance reliability and clock-in patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={fetchData} loading={loading} />
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={() => setFilters({
            clientId: '',
            reliabilityLabel: 'all',
            startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
          })}>Reset</Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-red-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Chronic Issues</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.chronic}</p>
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Needs immediate attention
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Frequently Late</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.frequent}</p>
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                <Clock3 className="w-3 h-3" /> Monitor closely
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-xl">
              <Clock3 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Minutes Late</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgLate}m</p>
              <p className="text-xs text-blue-600 mt-2">Per late clock-in</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">On Time Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {data.filter(r => r.reliabilityLabel === 'On Time').length}
              </p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Doing great!
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-50/50 border-dashed">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Client</label>
            <div className="relative">
              <select
                value={filters.clientId}
                onChange={(e) => setFilters(f => ({ ...f, clientId: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reliability</label>
            <div className="relative">
              <select
                value={filters.reliabilityLabel}
                onChange={(e) => setFilters(f => ({ ...f, reliabilityLabel: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="all">All Tiers</option>
                <option value="issues">All Issues (Chronic/Frequent)</option>
                {Object.keys(RELIABILITY_TIERS).map(tier => <option key={tier} value={tier}>{tier}</option>)}
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">From Date</label>
            <div className="relative">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">To Date</label>
            <div className="relative">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('employeeName')}
                >
                  <div className="flex items-center gap-2">
                    Employee Name
                    {sortConfig.key === 'employeeName' && (sortConfig.direction === 'asc' ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />)}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-primary"
                  onClick={() => handleSort('totalScheduled')}
                >
                  Shifts
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-green-600">On Time</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-orange-600">Late</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-red-600">Absent</th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-primary"
                  onClick={() => handleSort('avgMinutesLate')}
                >
                  Avg Late
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-primary"
                  onClick={() => handleSort('reliabilityLabel')}
                >
                  Reliability
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">AI Insight</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-20 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto" />
                    <p className="mt-4 text-gray-500 font-medium">Crunching attendance data...</p>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-900 font-bold">No data found</p>
                    <p className="text-gray-500">Try adjusting your filters or date range</p>
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => (
                  <tr 
                    key={row.employeeId} 
                    className="group hover:bg-primary-50/30 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.employeeName} size="sm" className="ring-2 ring-white shadow-sm" />
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">{row.employeeName}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-tighter">ID: {row.employeeId.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/admin/clients/${row.clientId}`, '_blank');
                        }}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {row.clientName}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap font-medium text-gray-900">{row.totalScheduled}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap text-green-600 font-semibold">{row.onTimeCount}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap text-orange-600 font-semibold">{row.lateCount}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap text-red-600 font-semibold">{row.absentCount}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-bold ${row.avgMinutesLate > 15 ? 'text-red-600' : 'text-gray-900'}`}>
                        {row.avgMinutesLate}m
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getReliabilityBadge(row.reliabilityLabel)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 max-w-[250px]">
                        <TrendingUp className="w-3.5 h-3.5 text-primary/50 flex-shrink-0" />
                        <p className="text-xs text-gray-600 line-clamp-1 italic group-hover:line-clamp-none transition-all">
                          {row.insight}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" icon={ChevronRight} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drill-down Modal */}
      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title={selectedEmployee ? `Shift History: ${selectedEmployee.employeeName}` : ''}
        size="xl"
      >
        <div className="space-y-6 py-2">
          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Late</p>
              <p className="text-xl font-bold text-gray-900">{selectedEmployee?.avgMinutesLate}m</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Latest Start</p>
              <p className="text-xl font-bold text-gray-900">
                {selectedEmployee?.latestClockIn ? new Date(selectedEmployee.latestClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Absent Rate</p>
              <p className="text-xl font-bold text-gray-900">
                {selectedEmployee?.totalScheduled > 0 ? Math.round((selectedEmployee.absentCount / selectedEmployee.totalScheduled) * 100) : 0}%
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Label</p>
              <div className="mt-1">
                {selectedEmployee && getReliabilityBadge(selectedEmployee.reliabilityLabel)}
              </div>
            </div>
          </div>

          {/* AI Insight Placeholder */}
          <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl flex gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-widest">AI Attendance Insight</p>
              <p className="text-sm text-primary-900 mt-0.5 leading-relaxed">
                {employeeDetails?.insight || "Analyzing pattern..."}
              </p>
            </div>
          </div>

          {/* History Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-bold text-gray-500">Date</th>
                  <th className="px-4 py-3 font-bold text-gray-500">Scheduled</th>
                  <th className="px-4 py-3 font-bold text-gray-500">Actual Clock-In</th>
                  <th className="px-4 py-3 font-bold text-gray-500">Status</th>
                  <th className="px-4 py-3 font-bold text-gray-500 text-right">Delay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailsLoading ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary mx-auto" />
                    </td>
                  </tr>
                ) : employeeDetails?.history?.map((h, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {new Date(h.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{h.scheduledStart} - {h.scheduledEnd}</td>
                    <td className="px-4 py-3">
                      {h.actualClockIn ? new Date(h.actualClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-3">
                      {h.status === 'On Time' || h.status === 'Early' ? (
                        <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {h.status}</span>
                      ) : h.status === 'Late' ? (
                        <span className="text-orange-600 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Late</span>
                      ) : h.status === 'Absent' ? (
                        <span className="text-red-600 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> Absent</span>
                      ) : (
                        <span className="text-gray-400">{h.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {h.lateMinutes > 0 ? (
                        <span className="text-red-600">+{h.lateMinutes}m</span>
                      ) : h.status === 'On Time' || h.status === 'Early' ? (
                        <span className="text-green-600">0m</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setSelectedEmployee(null)}>Close</Button>
            {selectedEmployee?.clientId && (
              <Button variant="outline" icon={Building2} onClick={() => window.open(`/admin/clients/${selectedEmployee.clientId}`, '_blank')}>
                View Client Profile
              </Button>
            )}
            <Button variant="primary" icon={ExternalLink} onClick={() => window.open(`/admin/employees/${selectedEmployee.employeeId}`, '_blank')}>
              View Employee Profile
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PunctualityAnalytics;
