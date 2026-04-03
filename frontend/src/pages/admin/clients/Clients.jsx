import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building,
  Users,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  RefreshButton,
  AddButton,
} from '../../../components/common';
import { useClientData } from '../../../hooks/useClientData';

const TIMEZONE_LABELS = {
  'UTC': 'UTC',
  'America/New_York': 'Eastern Time',
  'America/Chicago': 'Central Time',
  'America/Denver': 'Mountain Time',
  'America/Los_Angeles': 'Pacific Time',
  'Asia/Kolkata': 'India Standard Time',
  'Europe/London': 'London (GMT)',
  'Australia/Sydney': 'Sydney (AEST)',
  'Asia/Dubai': 'Dubai (GST)',
};

const Clients = () => {
  const navigate = useNavigate();

  const {
    clients,
    stats,
    pagination,
    searchQuery,
    filters,
    loading,
    error,
    setSearchQuery,
    setFilters,
    setError,
    setPagination,
    refresh,
  } = useClientData({ mode: 'list' });

  const getStatusBadge = (client) => {
    if (client.onboardingStatus !== 'COMPLETED') {
      return <Badge variant="default">Inactive</Badge>;
    }
    const status = client.user?.status;
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="default">Inactive</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getOnboardingBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'PENDING_AGREEMENT':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
          <p className="text-gray-500">Manage client accounts and configurations</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={refresh} />
          <AddButton onClick={() => navigate('/admin/clients/add')}>
            Add Client
          </AddButton>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Building className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-700">{stats.totalClients}</p>
            <p className="text-xs text-blue-600">Total Clients</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-700">{stats.activeClients}</p>
            <p className="text-xs text-green-600">Active Clients</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-purple-700">{stats.totalAssignedEmployees}</p>
            <p className="text-xs text-purple-600">Assigned Employees</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Users className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700">{stats.activeAssignedEmployees}</p>
            <p className="text-xs text-amber-600">Active Assigned</p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="appearance-none pl-4 pr-9 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            title="From date"
          />
        </div>
        <div>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            title="To date"
          />
        </div>
        {(filters.status || filters.startDate || filters.endDate) && (
          <button
            onClick={() => setFilters({ status: '', startDate: '', endDate: '' })}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Client Table */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-gray-500">Loading clients...</p>
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No clients found</p>
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => navigate('/admin/clients/add')}>
              Add First Client
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Onboarding</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Groups</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Invoicing</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/clients/${client.id}`)}
                  >
                    {/* Client name + contact */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {client.logoUrl ? (
                          <Avatar src={client.logoUrl} name={client.companyName} size="sm" />
                        ) : (
                          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{client.companyName}</p>
                            {client.timezone && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                {TIMEZONE_LABELS[client.timezone] || client.timezone.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{client.contacts?.[0]?.name || client.contactPerson}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600 truncate max-w-[200px]">{client.user?.email}</p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(client)}
                    </td>

                    {/* Onboarding */}
                    <td className="px-4 py-3 text-center">
                      {getOnboardingBadge(client.onboardingStatus)}
                    </td>

                    {/* Employees */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900">{client.activeEmployeeCount || 0}</span>
                      <span className="text-xs text-gray-400">/{client.employeeCount || 0}</span>
                    </td>

                    {/* Groups */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900">{client.groupCount || 0}</span>
                    </td>

                    {/* Invoicing */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium whitespace-nowrap text-gray-700">
                        {client.clientPolicies?.invoiceByGroup ? 'Group-wise' : 'Single'}
                      </span>
                    </td>

                    {/* Leave Policy */}
                    <td className="px-4 py-3 text-center">
                      <Badge variant={client.clientPolicies?.allowPaidLeave ? 'success' : 'warning'} size="sm">
                        {client.clientPolicies?.allowPaidLeave ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {client.createdAt
                          ? new Date(client.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/admin/clients/${client.id}`)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {(() => {
              const pages = [];
              const total = pagination.totalPages;
              const current = pagination.page;

              const addPage = (p) => {
                pages.push(
                  <button
                    key={p}
                    onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                      p === current
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              };

              const addEllipsis = (key) => {
                pages.push(
                  <span key={key} className="w-9 h-9 flex items-center justify-center text-sm text-gray-400">
                    ...
                  </span>
                );
              };

              if (total <= 7) {
                for (let i = 1; i <= total; i++) addPage(i);
              } else {
                addPage(1);
                if (current > 3) addEllipsis('start');
                for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
                  addPage(i);
                }
                if (current < total - 2) addEllipsis('end');
                addPage(total);
              }
              return pages;
            })()}
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clients;
