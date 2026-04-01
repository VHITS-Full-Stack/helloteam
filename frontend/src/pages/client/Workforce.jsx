import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  Clock,
  Activity,
  MoreVertical,
  RefreshCw,
  Users,
  Coffee,
  UserX,
  Mail,
  Calendar,
  ChevronDown
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Modal
} from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';

const Workforce = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    working: 0,
    onBreak: 0,
    offline: 0,
  });
  const [error, setError] = useState(null);

  // Employee detail modal
  const [detailModal, setDetailModal] = useState({ show: false, employee: null });

  const fetchWorkforce = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const response = await clientPortalService.getWorkforce({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });

      if (response.success) {
        setEmployees(response.data.employees || []);
        setSummary(response.data.summary || {
          total: 0,
          working: 0,
          onBreak: 0,
          offline: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching workforce:', err);
      setError('Failed to load workforce data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchWorkforce();

    // Auto-refresh every 15 seconds for live data
    const interval = setInterval(() => {
      fetchWorkforce(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchWorkforce]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWorkforce();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'working':
        return <Badge variant="success" dot>Working</Badge>;
      case 'break':
        return <Badge variant="warning" dot>On Break</Badge>;
      case 'offline':
        return <Badge variant="default" dot>Offline</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getAvatarStatus = (status) => {
    switch (status) {
      case 'working':
        return 'online';
      case 'break':
        return 'away';
      default:
        return 'offline';
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = searchQuery === '' ||
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workforce</h2>
          <p className="text-gray-500">Monitor your team's activity in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={() => fetchWorkforce(true)}
            disabled={refreshing}
            size="sm"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Search and Filter */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search employees by name, role, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white appearance-none pr-9"
              >
                <option value="all">All Status</option>
                <option value="working">Working</option>
                <option value="break">On Break</option>
                <option value="offline">Offline</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              <p className="text-sm text-gray-500">Total Employees</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.working}</p>
              <p className="text-sm text-gray-500">Working Now</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Coffee className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.onBreak}</p>
              <p className="text-sm text-gray-500">On Break</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <UserX className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.offline}</p>
              <p className="text-sm text-gray-500">Offline</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Grid/List */}
      {filteredEmployees.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No employees found</p>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'No employees are assigned to your organization'}
            </p>
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="hover:border-primary-200 border border-transparent transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={employee.name}
                    src={employee.profilePhoto}
                    size="lg"
                    status={getAvatarStatus(employee.status)}
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{employee.name}</p>
                    <p className="text-sm text-gray-500">{employee.role}</p>
                  </div>
                </div>
                <button
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={() => setDetailModal({ show: true, employee })}
                >
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Status</span>
                  {getStatusBadge(employee.status)}
                </div>
                {employee.status !== 'offline' && employee.startTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Clocked In</span>
                    <span className="font-medium text-gray-900">
                      {new Date(employee.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Today</span>
                  <span className="font-semibold text-gray-900">{employee.todayHours}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">This Week</span>
                  <span className="font-semibold text-gray-900">{employee.weeklyHours}</span>
                </div>
                {employee.currentBreak && (
                  <div className="p-2 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-600 font-medium">
                      On {employee.currentBreak.breakType || 'break'} since{' '}
                      {new Date(employee.currentBreak.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  icon={Eye}
                  onClick={() => setDetailModal({ show: true, employee })}
                >
                  View Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  icon={Clock}
                  onClick={() => navigate(`/client/time-records/${employee.id}`, { state: { employeeName: employee.name, employeePhoto: employee.profilePhoto } })}
                >
                  Time Records
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Clock In</TableHeader>
                <TableHeader>Today</TableHeader>
                <TableHeader>This Week</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={employee.name}
                        src={employee.profilePhoto}
                        size="sm"
                        status={getAvatarStatus(employee.status)}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{employee.name}</p>
                        <p className="text-sm text-gray-500">{employee.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                  <TableCell>
                    {employee.status !== 'offline' && employee.startTime
                      ? new Date(employee.startTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </TableCell>
                  <TableCell>{employee.todayHours}</TableCell>
                  <TableCell>{employee.weeklyHours}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Eye}
                      onClick={() => setDetailModal({ show: true, employee })}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Live Update Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>Live updates every 15 seconds</span>
      </div>

      {/* Employee Detail Modal */}
      <Modal
        isOpen={detailModal.show}
        onClose={() => setDetailModal({ show: false, employee: null })}
        title="Employee Details"
        size="md"
      >
        {detailModal.employee && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <Avatar
                name={detailModal.employee.name}
                src={detailModal.employee.profilePhoto}
                size="xl"
                status={getAvatarStatus(detailModal.employee.status)}
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {detailModal.employee.name}
                </h3>
                <p className="text-gray-500">{detailModal.employee.role}</p>
                {getStatusBadge(detailModal.employee.status)}
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600">
                <Mail className="w-5 h-5" />
                <span>{detailModal.employee.email}</span>
              </div>
            </div>

            {/* Work Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Today's Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {detailModal.employee.todayHours}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Weekly Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {detailModal.employee.weeklyHours}
                </p>
              </div>
            </div>

            {/* Current Session */}
            {detailModal.employee.status !== 'offline' && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">Current Session</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600">Clocked In</span>
                    <span className="font-medium text-green-800">
                      {detailModal.employee.startTime
                        ? new Date(detailModal.employee.startTime).toLocaleTimeString()
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Status</span>
                    <span className="font-medium text-green-800">
                      {detailModal.employee.status === 'working' ? 'Working' : 'On Break'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Break Info */}
            {detailModal.employee.currentBreak && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">Current Break</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-yellow-600">Type</span>
                    <span className="font-medium text-yellow-800">
                      {detailModal.employee.currentBreak.breakType || 'Break'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-600">Started</span>
                    <span className="font-medium text-yellow-800">
                      {new Date(detailModal.employee.currentBreak.startTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                fullWidth
                icon={Clock}
                onClick={() => {
                  setDetailModal({ show: false, employee: null });
                  navigate(`/client/time-records/${detailModal.employee.id}`, { state: { employeeName: detailModal.employee.name, employeePhoto: detailModal.employee.profilePhoto } });
                }}
              >
                Time Records
              </Button>
              <Button
                variant="outline"
                fullWidth
                icon={Activity}
                onClick={() => {
                  setDetailModal({ show: false, employee: null });
                  navigate('/client/analytics');
                }}
              >
                Analytics
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Workforce;
