import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Phone,
  Building,
  Edit,
  Trash2,
  Eye,
  X,
  AlertCircle,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../../components/common';
import { useEmployeeData } from '../../../hooks/useEmployeeData';

const Employees = () => {
  const navigate = useNavigate();

  const {
    employees,
    clients,
    clientGroups,
    stats,
    pagination,
    searchQuery,
    selectedEmployee,
    selectedClientId,
    selectedGroupId,
    loading,
    error,
    submitting,
    showDeleteModal,
    showAssignModal,
    setSearchQuery,
    setError,
    setPagination,
    setSelectedGroupId,
    openDeleteModal,
    closeDeleteModal,
    openAssignModal,
    closeAssignModal,
    handleSelectClient,
    handleDeleteEmployee,
    handleAssignToClient,
    refresh,
  } = useEmployeeData({ mode: 'list' });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="default">Inactive</Badge>;
      case 'SUSPENDED':
        return <Badge variant="error">Suspended</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getEmployeeClient = (employee) => {
    if (!employee.clientAssignments || employee.clientAssignments.length === 0) {
      return <span className="text-gray-400">Unassigned</span>;
    }
    return employee.clientAssignments[0]?.client?.companyName || <span className="text-gray-400">Unassigned</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
          <p className="text-gray-500">Manage employee profiles and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/admin/employees/add')}>
            Add Employee
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
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">On Leave</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.onLeave}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
        </div>
      </Card>

      {/* Employees Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-gray-500">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No employees found</p>
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => navigate('/admin/employees/add')}>
              Add First Employee
            </Button>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Contact</TableHeader>
                <TableHeader>Payable Rate ($/hr)</TableHeader>
                <TableHeader>Billing Rate ($/hr)</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Group</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Joined</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={employee.profilePhoto} name={`${employee.firstName} ${employee.lastName}`} size="md" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{employee.user?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {employee.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4" />
                          {employee.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                   <TableCell>
                    <span className="text-sm text-gray-700">
                      {employee.payableRate ?? 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {employee.billingRate ? (
                      <span className="text-sm text-gray-700">
                        {employee.billingRate}
                      </span>
                    ) : employee.clientGroupBillingRate ? (
                      <span className="text-sm text-gray-700">
                        {Number(employee.clientGroupBillingRate).toFixed(2)}
                        <span className="text-xs text-gray-400 ml-1">(client group)</span>
                      </span>
                    ) : employee.groupAssignments?.[0]?.group?.billingRate ? (
                      <span className="text-sm text-gray-700">
                        {Number(employee.groupAssignments[0].group.billingRate).toFixed(2)}
                        <span className="text-xs text-gray-400 ml-1">(group)</span>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{getEmployeeClient(employee)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {employee.groupAssignments?.[0]?.group?.name || <span className="text-gray-400">None</span>}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.user?.status)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {employee.hireDate
                        ? new Date(employee.hireDate).toLocaleDateString()
                        : 'N/A'
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/employees/${employee.id}`}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Link>
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={() => openAssignModal(employee)}
                        title="Assign to Client"
                      >
                        <UserPlus className="w-4 h-4 text-blue-500" />
                      </button>
                      <Link
                        to={`/admin/employees/${employee.id}/edit`}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </Link>
                      <button
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => openDeleteModal(employee)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
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
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Employee"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedEmployee?.firstName} {selectedEmployee?.lastName}</strong>?
            This action will deactivate their account.
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
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDeleteEmployee} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign to Client Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={closeAssignModal}
        title="Assign to Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Assign <strong>{selectedEmployee?.firstName} {selectedEmployee?.lastName}</strong> to a client:
          </p>
          {selectedEmployee?.clientAssignments?.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                Currently assigned to <strong>{selectedEmployee.clientAssignments[0]?.client?.companyName}</strong>. Assigning to a new client will remove the existing assignment.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
            <select
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              value={selectedClientId}
              onChange={(e) => handleSelectClient(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
          </div>

          {selectedClientId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Group (Optional)</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">No group</option>
                {clientGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.employees?.length || 0} employees)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Optionally add this employee to a group under the selected client</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={closeAssignModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignToClient}
              disabled={!selectedClientId}
              loading={submitting}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Employees;
