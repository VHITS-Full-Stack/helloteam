import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building,
  Users,
  Eye,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Clock,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Input,
  Avatar
} from '../../../components/common';
import { useClientData } from '../../../hooks/useClientData';

const Clients = () => {
  const navigate = useNavigate();

  const {
    clients,
    stats,
    pagination,
    searchQuery,
    loading,
    error,
    setSearchQuery,
    setError,
    setPagination,
    refresh,
  } = useClientData({ mode: 'list' });

  const getStatusBadge = (status) => {
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
          <Button variant="outline" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/admin/clients/add')}>
            Add Client
          </Button>
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
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
              <p className="text-sm text-gray-500">Total Clients</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.activeClients}</p>
              <p className="text-sm text-gray-500">Active Clients</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAssignedEmployees}</p>
              <p className="text-sm text-gray-500">Assigned Employees</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Users className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.activeAssignedEmployees}</p>
              <p className="text-sm text-gray-500">Active Assigned</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card padding="sm">
        <Input
          icon={Search}
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Card>

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
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave</th>
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
                          <p className="text-sm font-semibold text-gray-900 truncate">{client.companyName}</p>
                          <p className="text-xs text-gray-500 truncate">{client.contactPerson}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600 truncate max-w-[200px]">{client.user?.email}</p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(client.user?.status)}
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

                    {/* Leave Policy */}
                    <td className="px-4 py-3 text-center">
                      <Badge variant={client.clientPolicies?.allowPaidLeave ? 'success' : 'warning'} size="sm">
                        {client.clientPolicies?.allowPaidLeave ? 'Paid' : 'Unpaid'}
                      </Badge>
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clients;
