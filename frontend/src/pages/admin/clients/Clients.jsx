import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building,
  Users,
  Settings,
  Eye,
  Edit,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  FolderOpen
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
  Avatar
} from '../../../components/common';
import { useClientData } from '../../../hooks/useClientData';
import ClientGroupsModal from '../../../components/admin/ClientGroupsModal';

const Clients = () => {
  const navigate = useNavigate();

  const {
    clients,
    stats,
    pagination,
    searchQuery,
    selectedClient,
    groupsModalClient,
    loading,
    error,
    submitting,
    showDeleteModal,
    showGroupsModal,
    setSearchQuery,
    setError,
    setPagination,
    openDeleteModal,
    closeDeleteModal,
    openGroupsModal,
    closeGroupsModal,
    handleDeleteClient,
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

      {/* Client Cards */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => (
            <Card key={client.id} padding="sm" className="hover:border-primary-200 border border-transparent">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {client.logoUrl ? (
                    <Avatar src={client.logoUrl} name={client.companyName} size="md" />
                  ) : (
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{client.companyName}</h3>
                    <p className="text-xs text-gray-500">{client.contactPerson}</p>
                  </div>
                </div>
                {getStatusBadge(client.user?.status)}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-xs">Employees</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {client.activeEmployeeCount || 0}/{client.employeeCount || 0} active
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="text-xs">Groups</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {client.groupCount || 0} assigned
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
                    <Settings className="w-3.5 h-3.5" />
                    <span className="text-xs">Leave Policy</span>
                  </div>
                  <Badge variant={client.clientPolicies?.allowPaidLeave ? 'success' : 'warning'} size="sm">
                    {client.clientPolicies?.allowPaidLeave ? 'Paid Leave' : 'Unpaid Only'}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Eye}
                  onClick={() => navigate(`/admin/clients/${client.id}`)}
                >
                  View
                </Button>
                <Button variant="ghost" size="sm" icon={Edit} onClick={() => navigate(`/admin/clients/${client.id}/edit`)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FolderPlus}
                  onClick={() => openGroupsModal(client)}
                >
                  Manage Groups
                </Button>
                <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => openDeleteModal(client)} />
              </div>
            </Card>
          ))}
        </div>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedClient?.companyName}</strong>?
            This will deactivate the client account.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDeleteClient} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Groups Management Modal */}
      <ClientGroupsModal
        isOpen={showGroupsModal}
        onClose={closeGroupsModal}
        clientId={groupsModalClient?.id}
        clientName={groupsModalClient?.companyName}
        onGroupsChanged={refresh}
      />
    </div>
  );
};

export default Clients;
