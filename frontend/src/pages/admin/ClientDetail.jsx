import { useState, useEffect } from 'react';
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
  DollarSign
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
  Input
} from '../../components/common';
import clientService from '../../services/client.service';
import employeeService from '../../services/employee.service';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [clientEmployees, setClientEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [rateFormData, setRateFormData] = useState({
    hourlyRate: '',
    overtimeRate: '',
  });

  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    address: '',
    timezone: 'UTC',
    status: 'ACTIVE',
    allowPaidLeave: false,
    paidLeaveType: 'fixed',
    annualPaidLeaveDays: 0,
    allowUnpaidLeave: true,
    requireTwoWeeksNotice: true,
    allowOvertime: true,
    overtimeRequiresApproval: true,
    defaultHourlyRate: 0,
    defaultOvertimeRate: 0,
    currency: 'USD',
  });

  // Fetch client details
  const fetchClient = async () => {
    try {
      setLoading(true);
      const response = await clientService.getClient(id);
      if (response.success) {
        setClient(response.data);
        // Set form data for editing
        setFormData({
          email: response.data.user?.email || '',
          companyName: response.data.companyName,
          contactPerson: response.data.contactPerson,
          phone: response.data.phone || '',
          address: response.data.address || '',
          timezone: response.data.timezone || 'UTC',
          status: response.data.user?.status || 'ACTIVE',
          allowPaidLeave: response.data.clientPolicies?.allowPaidLeave || false,
          paidLeaveType: response.data.clientPolicies?.paidLeaveType || 'fixed',
          annualPaidLeaveDays: response.data.clientPolicies?.annualPaidLeaveDays || 0,
          allowUnpaidLeave: response.data.clientPolicies?.allowUnpaidLeave ?? true,
          requireTwoWeeksNotice: response.data.clientPolicies?.requireTwoWeeksNotice ?? true,
          allowOvertime: response.data.clientPolicies?.allowOvertime ?? true,
          overtimeRequiresApproval: response.data.clientPolicies?.overtimeRequiresApproval ?? true,
          defaultHourlyRate: response.data.clientPolicies?.defaultHourlyRate || 0,
          defaultOvertimeRate: response.data.clientPolicies?.defaultOvertimeRate || 0,
          currency: response.data.clientPolicies?.currency || 'USD',
        });
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch client');
    } finally {
      setLoading(false);
    }
  };

  // Fetch client's employees
  const fetchClientEmployees = async () => {
    try {
      const response = await clientService.getClientEmployees(id);
      if (response.success) {
        setClientEmployees(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch client employees:', err);
    }
  };

  // Fetch all employees for assignment
  const fetchAllEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 100 });
      if (response.success) {
        setAllEmployees(response.data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  useEffect(() => {
    fetchClient();
    fetchClientEmployees();
    fetchAllEmployees();
  }, [id]);

  const handleEditClient = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.updateClient(id, {
        email: formData.email,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        address: formData.address,
        timezone: formData.timezone,
        status: formData.status,
        allowPaidLeave: formData.allowPaidLeave,
        paidLeaveType: formData.paidLeaveType,
        annualPaidLeaveDays: parseInt(formData.annualPaidLeaveDays),
        allowUnpaidLeave: formData.allowUnpaidLeave,
        requireTwoWeeksNotice: formData.requireTwoWeeksNotice,
        allowOvertime: formData.allowOvertime,
        overtimeRequiresApproval: formData.overtimeRequiresApproval,
        defaultHourlyRate: parseFloat(formData.defaultHourlyRate) || 0,
        defaultOvertimeRate: parseFloat(formData.defaultOvertimeRate) || 0,
        currency: formData.currency,
      });

      if (response.success) {
        setShowEditModal(false);
        setError('');
        fetchClient();
      } else {
        setError(response.error || 'Failed to update client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.deleteClient(id);
      if (response.success) {
        navigate('/admin/clients');
      } else {
        setError(response.error || 'Failed to delete client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignEmployee = async (employeeId) => {
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.assignEmployees(id, [employeeId]);
      if (response.success) {
        fetchClientEmployees();
        setError('');
      } else {
        setError(response.error || 'Failed to assign employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to assign employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveEmployee = async (employeeId) => {
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.removeEmployee(id, employeeId);
      if (response.success) {
        fetchClientEmployees();
        setError('');
      } else {
        setError(response.error || 'Failed to remove employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRateModal = async (employee) => {
    setSelectedEmployee(employee);
    setError('');
    try {
      const response = await clientService.getEmployeeRate(id, employee.id);
      if (response.success) {
        setRateFormData({
          hourlyRate: response.data.hourlyRate !== null ? response.data.hourlyRate : '',
          overtimeRate: response.data.overtimeRate !== null ? response.data.overtimeRate : '',
          defaultHourlyRate: response.data.defaultHourlyRate,
          defaultOvertimeRate: response.data.defaultOvertimeRate,
        });
      }
    } catch (err) {
      setRateFormData({
        hourlyRate: '',
        overtimeRate: '',
        defaultHourlyRate: Number(client.clientPolicies?.defaultHourlyRate || 0),
        defaultOvertimeRate: Number(client.clientPolicies?.defaultOvertimeRate || 0),
      });
    }
    setShowRateModal(true);
  };

  const handleUpdateEmployeeRate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.updateEmployeeRate(id, selectedEmployee.id, {
        hourlyRate: rateFormData.hourlyRate,
        overtimeRate: rateFormData.overtimeRate,
      });

      if (response.success) {
        setShowRateModal(false);
        setSelectedEmployee(null);
        setRateFormData({ hourlyRate: '', overtimeRate: '' });
        setError('');
      } else {
        setError(response.error || 'Failed to update employee rate');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update employee rate');
    } finally {
      setSubmitting(false);
    }
  };

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

  const getUnassignedEmployees = () => {
    const assignedIds = clientEmployees.map(e => e.id);
    return allEmployees.filter(e => !assignedIds.includes(e.id) && e.user?.status === 'ACTIVE');
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
          <Button variant="outline" icon={RefreshCw} onClick={() => { fetchClient(); fetchClientEmployees(); }}>
            Refresh
          </Button>
          <Button variant="outline" icon={Edit} onClick={() => setShowEditModal(true)}>
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

        {/* Assigned Employees */}
        <div className="space-y-6">
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

      {/* Edit Client Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setError(''); }}
        title="Edit Client"
        size="lg"
      >
        <form onSubmit={handleEditClient} className="space-y-4">
          <Input
            label="Company Name"
            placeholder="Enter company name"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              placeholder="Primary contact name"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="Contact email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              placeholder="Contact phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          <Input
            label="Address"
            placeholder="Company address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-4">Policy Configuration</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Paid Leave</label>
                <input
                  type="checkbox"
                  checked={formData.allowPaidLeave}
                  onChange={(e) => setFormData({ ...formData, allowPaidLeave: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              {formData.allowPaidLeave && (
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <select
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                      value={formData.paidLeaveType}
                      onChange={(e) => setFormData({ ...formData, paidLeaveType: e.target.value })}
                    >
                      <option value="fixed">Fixed Annual</option>
                      <option value="fixed-half-yearly">Fixed Half-Yearly</option>
                      <option value="accrued">Accrued</option>
                      <option value="milestone">Milestone Based</option>
                    </select>
                  </div>
                  <Input
                    label="Annual Days"
                    type="number"
                    min="0"
                    value={formData.annualPaidLeaveDays}
                    onChange={(e) => setFormData({ ...formData, annualPaidLeaveDays: e.target.value })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Unpaid Leave</label>
                <input
                  type="checkbox"
                  checked={formData.allowUnpaidLeave}
                  onChange={(e) => setFormData({ ...formData, allowUnpaidLeave: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Overtime</label>
                <input
                  type="checkbox"
                  checked={formData.allowOvertime}
                  onChange={(e) => setFormData({ ...formData, allowOvertime: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-4">Billing Rates</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.defaultHourlyRate}
                  onChange={(e) => setFormData({ ...formData, defaultHourlyRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.defaultOvertimeRate}
                  onChange={(e) => setFormData({ ...formData, defaultOvertimeRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-gray-500 mt-1">Leave as 0 to use 1.5x hourly rate</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowEditModal(false); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setError(''); }}
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
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDeleteClient} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Employee Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setError(''); }}
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
            <Button variant="primary" onClick={() => { setShowAssignModal(false); setError(''); }}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Employee Rate Modal */}
      <Modal
        isOpen={showRateModal}
        onClose={() => { setShowRateModal(false); setSelectedEmployee(null); setError(''); }}
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
              <Button variant="ghost" type="button" onClick={() => { setShowRateModal(false); setSelectedEmployee(null); setError(''); }}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Save Rate
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ClientDetail;
