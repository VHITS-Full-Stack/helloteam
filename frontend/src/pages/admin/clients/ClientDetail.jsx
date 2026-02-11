import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  MapPin,
  Clock,
  Users,
  Calendar,
  Edit,
  Trash2,
  UserPlus,
  X,
  Plus,
  AlertCircle,
  RefreshCw,
  Settings,
  DollarSign,
  FolderOpen,
  FolderPlus
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
} from '../../../components/common';
import { useClientData } from '../../../hooks/useClientData';
import ClientGroupsModal from '../../../components/admin/ClientGroupsModal';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    client,
    clientEmployees,
    connectedGroups,
    loading,
    error,
    submitting,
    showDeleteModal,
    showAssignModal,
    showRateModal,
    showGroupsModal,
    selectedEmployee,
    rateFormData,
    setError,
    setRateFormData,
    setShowDeleteModal,
    setShowAssignModal,
    setShowGroupsModal,
    handleDeleteClient,
    handleAssignEmployee,
    handleRemoveEmployee,
    handleOpenRateModal,
    handleUpdateEmployeeRate,
    getUnassignedEmployees,
    closeDeleteModal,
    closeAssignModal,
    closeRateModal,
    refresh,
  } = useClientData({ mode: 'detail', id });

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

  const onDeleteClient = async () => {
    const success = await handleDeleteClient();
    if (success) {
      navigate('/admin/clients');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-500">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Client Not Found</h3>
          <p className="text-gray-500 mb-4">The client you're looking for doesn't exist.</p>
          <Button variant="primary" onClick={() => navigate('/admin/clients')}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/admin/clients')}>
            Back
          </Button>
          <div className="flex items-center gap-4">
            {client.logoUrl ? (
              <Avatar src={client.logoUrl} name={client.companyName} size="xl" />
            ) : (
              <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building className="w-8 h-8 text-primary" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{client.companyName}</h2>
              <p className="text-gray-500">{client.contactPerson}</p>
            </div>
            {getStatusBadge(client.user?.status)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
          <Button variant="outline" icon={Edit} onClick={() => navigate(`/admin/clients/${id}/edit`)}>
            Edit
          </Button>
          <Button variant="outline" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
            Delete
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{client.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{client.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">{client.address || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Timezone</p>
                  <p className="font-medium text-gray-900">{client.timezone || 'UTC'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-medium text-gray-900">
                    {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Employees</p>
                  <p className="font-medium text-gray-900">{clientEmployees.length} assigned</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Policies */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Policies</h3>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Paid Leave</span>
                  <Badge variant={client.clientPolicies?.allowPaidLeave ? 'success' : 'warning'}>
                    {client.clientPolicies?.allowPaidLeave ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
                {client.clientPolicies?.allowPaidLeave && (
                  <p className="text-sm text-gray-500">
                    {client.clientPolicies.annualPaidLeaveDays} days/year ({client.clientPolicies.paidLeaveType})
                  </p>
                )}
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Unpaid Leave</span>
                  <Badge variant={client.clientPolicies?.allowUnpaidLeave ? 'success' : 'warning'}>
                    {client.clientPolicies?.allowUnpaidLeave ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Overtime</span>
                  <Badge variant={client.clientPolicies?.allowOvertime ? 'success' : 'warning'}>
                    {client.clientPolicies?.allowOvertime ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
                {client.clientPolicies?.allowOvertime && (
                  <p className="text-sm text-gray-500">
                    {client.clientPolicies.overtimeRequiresApproval ? 'Requires approval' : 'No approval needed'}
                  </p>
                )}
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Notice Period</span>
                  <Badge variant={client.clientPolicies?.requireTwoWeeksNotice ? 'info' : 'default'}>
                    {client.clientPolicies?.requireTwoWeeksNotice ? '2 Weeks Required' : 'Flexible'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Billing Rates */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Billing Rates</h3>
              <DollarSign className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">Default Hourly Rate</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  ${Number(client.clientPolicies?.defaultHourlyRate || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Per hour</p>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-gray-600">Overtime Rate</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">
                  ${Number(client.clientPolicies?.defaultOvertimeRate || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Number(client.clientPolicies?.defaultOvertimeRate || 0) === 0
                    ? 'Uses 1.5x hourly rate'
                    : 'Per overtime hour'}
                </p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-600">Currency</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {client.clientPolicies?.currency || 'USD'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Billing currency</p>
              </div>
            </div>
            {Number(client.clientPolicies?.defaultHourlyRate || 0) === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm text-yellow-700">
                    No billing rates configured. Click Edit to set up rates for payroll calculations.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Connected Groups */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Connected Groups</h3>
              <Button variant="outline" size="sm" icon={FolderPlus} onClick={() => setShowGroupsModal(true)}>
                Manage
              </Button>
            </div>
            {connectedGroups.length === 0 ? (
              <div className="text-center py-6">
                <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No groups connected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {connectedGroups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{group.name}</p>
                        <p className="text-xs text-gray-500">
                          {group.assignedToClientCount}/{group.employeeCount} employees assigned
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(group.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Assigned Employees */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Employees</h3>
              <Button variant="outline" size="sm" icon={UserPlus} onClick={() => setShowAssignModal(true)}>
                Assign
              </Button>
            </div>

            {clientEmployees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No employees assigned</p>
                <Button variant="primary" size="sm" icon={UserPlus} className="mt-4" onClick={() => setShowAssignModal(true)}>
                  Assign Employee
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {clientEmployees.map((employee) => (
                  <div key={employee.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar src={employee.profilePhoto} name={`${employee.firstName} ${employee.lastName}`} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</p>
                        <p className="text-sm text-gray-500">{employee.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(employee.user?.status)}
                      <button
                        onClick={() => handleOpenRateModal(employee)}
                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                        disabled={submitting}
                        title="Set custom rate"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveEmployee(employee.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        disabled={submitting}
                        title="Remove from client"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{client.companyName}</strong>?
            This will deactivate the client account and remove all employee assignments.
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
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={onDeleteClient} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Employee Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={closeAssignModal}
        title="Assign Employee"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Select an employee to assign to <strong>{client.companyName}</strong></p>

          {getUnassignedEmployees().length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No available employees to assign</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {getUnassignedEmployees().map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Avatar src={employee.profilePhoto} name={`${employee.firstName} ${employee.lastName}`} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</p>
                      <p className="text-sm text-gray-500">{employee.user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => handleAssignEmployee(employee.id)}
                    disabled={submitting}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="primary" onClick={closeAssignModal}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Employee Rate Modal */}
      <Modal
        isOpen={showRateModal}
        onClose={closeRateModal}
        title="Set Employee Rate"
        size="sm"
      >
        {selectedEmployee && (
          <form onSubmit={handleUpdateEmployeeRate} className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Avatar src={selectedEmployee.profilePhoto} name={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} size="sm" />
              <div>
                <p className="font-medium text-gray-900">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                <p className="text-sm text-gray-500">{selectedEmployee.user?.email}</p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-1">Client Default Rates</p>
              <p className="text-sm text-blue-600">
                Hourly: ${Number(rateFormData.defaultHourlyRate || 0).toFixed(2)} |
                Overtime: ${Number(rateFormData.defaultOvertimeRate || 0).toFixed(2) || '1.5x hourly'}
              </p>
            </div>

            <p className="text-sm text-gray-500">
              Set custom rates for this employee. Leave blank to use the client default rates.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Use default"
                  value={rateFormData.hourlyRate}
                  onChange={(e) => setRateFormData({ ...rateFormData, hourlyRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Use default"
                  value={rateFormData.overtimeRate}
                  onChange={(e) => setRateFormData({ ...rateFormData, overtimeRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" type="button" onClick={closeRateModal}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Save Rate
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Groups Management Modal */}
      <ClientGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        clientId={id}
        clientName={client?.companyName}
        onGroupsChanged={refresh}
      />
    </div>
  );
};

export default ClientDetail;
